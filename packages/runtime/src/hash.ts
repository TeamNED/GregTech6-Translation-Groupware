/**
 * 输出指纹的 hash 能力由宿主注入：
 * - Node 用 node:crypto；
 * - 浏览器 Worker 用 Web Crypto；
 * - 测试用假实现。
 *
 * runtime/core 本身不 import 任何加密实现，保持同构。
 */
export interface HashProvider {
  /** 返回完整 sha256 hex；调用方决定截断长度。 */
  sha256Hex(parts: Iterable<string>): Promise<string>;
}

/** 与 legacy 脚本一致：按 Map 顺序拼接 key\0value\n，取 sha256 前 16 位。 */
export async function hashOutput(
  hash: HashProvider,
  output: ReadonlyMap<string, string>,
): Promise<string> {
  const hex = await hash.sha256Hex(canonicalParts(output));
  return hex.slice(0, 16);
}

function* canonicalParts(output: ReadonlyMap<string, string>): Generator<string> {
  for (const [key, value] of output) {
    yield key;
    yield '\u0000';
    yield value;
    yield '\n';
  }
}
