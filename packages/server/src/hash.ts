import { createHash } from 'node:crypto';

/** Node 侧临时 hash 实现；runtime 接入后由 HashProvider 取代。 */
export function hashOutput(output: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [key, value] of output) hash.update(key).update('\u0000').update(value).update('\n');
  return hash.digest('hex').slice(0, 16);
}
