import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const serverCli = resolve(root, 'packages/server/node_modules/tsx/dist/cli.mjs');
const viteCli = resolve(root, 'packages/web/node_modules/vite/bin/vite.js');

for (const [label, path] of [
  ['tsx（server）', serverCli],
  ['vite（web）', viteCli],
]) {
  if (!existsSync(path)) {
    console.error(`[dev] 找不到 ${label}：${path}`);
    console.error('[dev] 请先运行 node common/scripts/install-run-rush.js update');
    process.exit(1);
  }
}

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) child.kill('SIGINT');
  setTimeout(() => process.exit(code), 300);
}

function start(name, cwd, args) {
  console.log(`[dev] 启动 ${name}`);
  const child = spawn(process.execPath, args, {
    cwd: resolve(root, cwd),
    stdio: 'inherit',
    env: process.env,
  });
  children.push(child);
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[dev] ${name} 退出：code=${code} signal=${signal}`);
    shutdown(code ?? 1);
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

start('server（WebSocket RPC :5175）', 'packages/server', [serverCli, 'watch', 'src/index.ts']);
start('web（Vite :5173）', 'packages/web', [viteCli, '--host', '127.0.0.1']);
