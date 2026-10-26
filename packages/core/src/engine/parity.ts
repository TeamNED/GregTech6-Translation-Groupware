import type { LangDocument } from '../types/lang';
import type { ParityInput, ParityReport, ParityUnknownSample, ParityValueSample } from '../types/parity';

/**
 * 把生成结果与 legacy golden 逐 key 比较。
 *
 * 口径与迁移期脚本一致：
 * - 主输出只遍历 golden 的 key，缺失也算不一致；
 * - unknown 做双向集合比较，只比 key 不比 value；
 * - 不比较换行、文件头或字节级格式；输出指纹由 runtime 的 HashProvider 负责。
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
    ok: mismatch === 0 && unknownMismatch === 0,
  };
}
