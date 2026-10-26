import { createHash } from 'node:crypto';

/**
 * 迁移期脚本的本地 hash 实现。
 *
 * core 已不再依赖 node:crypto；这个文件只服务当前的 CLI 脚本，
 * 等 scripts 迁到 packages/node 后会由 node 的 HashProvider 取代。
 */
export function hashOutput(output: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [key, value] of output) hash.update(key).update('\u0000').update(value).update('\n');
  return hash.digest('hex').slice(0, 16);
}
