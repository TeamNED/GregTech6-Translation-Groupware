import { randomUUID } from 'node:crypto';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

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

/**
 * Node dev web 的文件通道：HTTP 只处理大文件，控制/进度仍走 WS。
 * 只绑定 localhost，供 Vite dev server 跨端口调用。
 */
export function createHttpFileServer(): Server {
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

  sendJson(response, 404, { error: 'not-found', message: '未知路径' });
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
