import { createHash } from 'node:crypto';
import type { LangDocument } from '../types/lang';

/** 迁移期 parity 需要的最小生成结果；内存结果和回读的 dist 产物都满足它。 */
export interface ParityInput {
  output: Map<string, string>;
  unknown: Set<string>;
}

export interface ParityValueSample {
  key: string;
  expected: string | null;
  actual: string | null;
}

export interface ParityUnknownSample {
  key: string;
  /** true 表示期望未知但实际已翻译；false 表示期望已翻译但实际未知。 */
  expected: boolean;
}

export interface ParityReport {
  goldenKeys: number;
  mismatch: number;
  samples: ParityValueSample[];
  expectedUnknownKeys: number;
  unknownMismatch: number;
  unknownSamples: ParityUnknownSample[];
  hash: string;
  ok: boolean;
}

/** 输出指纹：按 Map 顺序拼接 key\0value\n 后取 sha256 前 16 位。 */
export function hashOutput(output: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [key, value] of output) hash.update(key).update('\u0000').update(value).update('\n');
  return hash.digest('hex').slice(0, 16);
}

/**
 * 把生成结果与 legacy golden 逐 key 比较。
 *
 * 口径与迁移期脚本一致：
 * - 主输出只遍历 golden 的 key，缺失也算不一致；
 * - unknown 做双向集合比较，只比 key 不比 value；
 * - 不比较换行、文件头或字节级格式；hash 是输出 Map 的指纹，不是文件哈希。
 */
export function compareToGolden(
  golden: LangDocument,
  generated: ParityInput,
  expectedUnknown: LangDocument,
  sampleLimit = 10,
): ParityReport {
  const samples: ParityValueSample[] = [];
  let mismatch = 0;
  for (const [key, expected] of golden.map) {
    const actual = generated.output.get(key) ?? null;
    if (actual === expected) continue;
    mismatch++;
    if (samples.length < sampleLimit) samples.push({ key, expected, actual });
  }

  const unknownSamples: ParityUnknownSample[] = [];
  let unknownMismatch = 0;
  for (const key of expectedUnknown.map.keys()) {
    if (generated.unknown.has(key)) continue;
    unknownMismatch++;
    if (unknownSamples.length < sampleLimit) unknownSamples.push({ key, expected: true });
  }
  for (const key of generated.unknown) {
    if (expectedUnknown.map.has(key)) continue;
    unknownMismatch++;
    if (unknownSamples.length < sampleLimit) unknownSamples.push({ key, expected: false });
  }

  return {
    goldenKeys: golden.map.size,
    mismatch,
    samples,
    expectedUnknownKeys: expectedUnknown.map.size,
    unknownMismatch,
    unknownSamples,
    hash: hashOutput(generated.output),
    ok: mismatch === 0 && unknownMismatch === 0,
  };
}
