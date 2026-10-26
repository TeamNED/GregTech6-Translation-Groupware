import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('..', import.meta.url));
const outdir = resolve(root, '.build');

await mkdir(outdir, { recursive: true });
await build({
  entryPoints: [resolve(root, 'src/worker/main.ts')],
  outfile: resolve(outdir, 'worker.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node24',
  // jsonc-parser 的 UMD 版本内部使用动态 require，bundler 无法静态打包；
  // 作为运行时依赖保留，由 Node 从 packages/node/node_modules 解析。
  external: ['jsonc-parser'],
  sourcemap: 'inline',
  logLevel: 'error',
});
console.log('[node] worker bundle -> .build/worker.cjs');
