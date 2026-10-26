import type { HashProvider } from '@gt6tg/runtime';

/** 浏览器 Worker 的 sha256 实现；输出与 node:crypto 相同。 */
export const webCryptoHash: HashProvider = {
  async sha256Hex(parts: Iterable<string>): Promise<string> {
    const text = [...parts].join('');
    const data = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  },
};
