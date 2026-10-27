import { randomUUID } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { webDistRoot } from './paths';

interface StoredFile {
  id: string;
  name: string;
  role: string;
  data: Buffer;
  createdAt: number;
}

const MAX_BODY_BYTES = 32 * 1024 * 1024;
const MAX_FILES = 16;
const files = new Map<string, StoredFile>();

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/**
 * Node dev server：同源托管 web 构建产物，并保留 HTTP 文件通道。
 * 控制/进度走挂在这个 server 上的 WS；只绑定 localhost。
 */
export function createHttpServer(): Server {
  return createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      sendJson(response, 500, {
        error: 'internal',
        message: error instanceof Error ? error.message : String(error),
      });
    });
  });
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  setCors(response);
  if (request.method === 'OPTIONS') {
    response.writeHead(204).end();
    return;
  }

  const url = new URL(request.url ?? '/', 'http://127.0.0.1');
  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, { ok: true, files: files.size });
    return;
  }

  if (request.method === 'POST' && url.pathname === '/api/files') {
    const data = await readBody(request);
    const id = randomUUID();
    const file: StoredFile = {
      id,
      name: url.searchParams.get('name') ?? 'upload.bin',
      role: url.searchParams.get('role') ?? 'source',
      data,
      createdAt: Date.now(),
    };
    files.set(id, file);
    while (files.size > MAX_FILES) {
      const oldest = files.keys().next().value;
      if (oldest === undefined) break;
      files.delete(oldest);
    }
    sendJson(response, 200, { id, name: file.name, role: file.role, size: data.length });
    return;
  }

  const match = /^\/api\/files\/([A-Za-z0-9-]+)$/.exec(url.pathname);
  if (match) {
    const file = files.get(match[1]!);
    if (!file) {
      sendJson(response, 404, { error: 'not-found', message: '文件不存在' });
      return;
    }
    if (request.method === 'GET') {
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.data.length),
        'Content-Disposition': `attachment; filename="${encodeURIComponent(file.name)}"`,
      });
      response.end(file.data);
      return;
    }
    if (request.method === 'DELETE') {
      files.delete(file.id);
      sendJson(response, 200, { ok: true });
      return;
    }
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'not-found', message: '未知路径' });
    return;
  }

  await serveStatic(url.pathname, request, response);
}

async function serveStatic(pathname: string, request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendJson(response, 405, { error: 'method-not-allowed', message: '只支持 GET/HEAD' });
    return;
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    sendJson(response, 400, { error: 'bad-request', message: '非法 URL' });
    return;
  }
  if (decoded.includes('\0')) {
    sendJson(response, 400, { error: 'bad-request', message: '非法 URL' });
    return;
  }

  const relativePath = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const requestedPath = resolve(webDistRoot, relativePath);
  if (!isInside(webDistRoot, requestedPath)) {
    sendJson(response, 404, { error: 'not-found', message: '静态文件不存在' });
    return;
  }

  let filePath = requestedPath;
  let data = await readStaticFile(filePath);
  if (!data && extname(relativePath) === '') {
    filePath = resolve(webDistRoot, 'index.html');
    data = await readStaticFile(filePath);
  }

  if (!data) {
    if (!(await readStaticFile(resolve(webDistRoot, 'index.html')))) {
      response.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('web 产物不存在：请先运行 npm run dev（会构建 packages/web/dist）。\n');
      return;
    }
    sendJson(response, 404, { error: 'not-found', message: '静态文件不存在' });
    return;
  }

  const extension = extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
    'Content-Length': String(data.length),
    'Cache-Control': relativePath.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (request.method === 'HEAD') response.end();
  else response.end(data);
}

async function readStaticFile(path: string): Promise<Buffer | null> {
  try {
    const info = await stat(path);
    if (!info.isFile()) return null;
    return await readFile(path);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') return null;
    throw error;
  }
}

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('文件超过 32 MB 限制'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve(Buffer.concat(chunks)));
    request.on('error', reject);
  });
}

function setCors(response: ServerResponse): void {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  response.end(text);
}
