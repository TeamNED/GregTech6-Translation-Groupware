import { createHash } from 'node:crypto';
import type { HashProvider } from '@gt6tg/runtime';

/** Node runtime 的 HashProvider；与浏览器 Web Crypto 输出相同的 sha256 hex。 */
export const nodeHashProvider: HashProvider = {
  async sha256Hex(parts: Iterable<string>): Promise<string> {
    const hash = createHash('sha256');
    for (const part of parts) hash.update(part);
    return hash.digest('hex');
  },
};

/** 同步便捷函数；用于 CLI 在已经拿到 Map 时做本地校验。 */
export function hashOutput(output: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [key, value] of output) hash.update(key).update('\u0000').update(value).update('\n');
  return hash.digest('hex').slice(0, 16);
}
