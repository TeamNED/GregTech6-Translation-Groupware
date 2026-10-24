import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const files = [
  'workplace/en/GregTech.lang',
  'workplace/zh/GregTech.fallback.lang',
  'workplace/zh/GregTech.lang',
  'workplace/zh/GregTech.unknown.lang',
];

let failed = false;
for (const relativePath of files) {
  const absolutePath = resolve(root, relativePath);
  if (!existsSync(absolutePath)) {
    console.error(`[legacy] 缺少 golden 文件: ${relativePath}`);
    failed = true;
    continue;
  }
  const content = readFileSync(absolutePath);
  const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
  const lines = content.toString('utf8').split(/\r?\n/).length;
  console.log(`[legacy] ${relativePath}: ${lines} 行, sha256=${hash}`);
}

if (failed) process.exit(1);
console.log('[legacy] golden 文件齐全。C++ 构建请在本目录使用 CMake（见 README.md）。');
