/**
 * 迁移期 parity：先生成 core 自己的 dist，再回读产物与 legacy golden 逐 key 对比。
 *
 * - legacy 目录只读：本脚本不会写入 `packages/legacy`；
 * - 产物写到 `packages/core/dist/<targetId>/`，不生成 `.bak`；
 * - 对比口径见 `compareToGolden`：主输出遍历 golden、unknown 双向集合差；
 * - mismatch / unknownMismatch / 回读差异任一不为 0 时以退出码 1 结束。
 */
import { readFileSync } from 'node:fs';
import {
  compareToGolden,
  compileConfig,
  diffLangMaps,
  generateFromEntries,
  hashOutput,
  parseLegacyLang,
} from '../src/index';
import { loadProjectData, repoRelative, writeDistArtifacts } from './lib';

const started = performance.now();
const data = loadProjectData();

const compileStarted = performance.now();
const compiled = compileConfig(data.config);
const compileMs = performance.now() - compileStarted;

const generateStarted = performance.now();
const result = generateFromEntries(compiled, data.source.entries, data.fallback.entries);
const generateMs = performance.now() - generateStarted;

const dist = writeDistArtifacts(data, result);

// 对比的是真正落盘的产物；回读差异能暴露 writer 的转义/顺序问题。
const distOutput = parseLegacyLang(readFileSync(dist.output, 'utf8'));
const distUnknown = parseLegacyLang(readFileSync(dist.unknown, 'utf8'));
const artifact = {
  output: distOutput.map,
  unknown: new Set(distUnknown.entries.map((entry) => entry.key)),
};

const parity = compareToGolden(data.golden, artifact, data.goldenUnknown);
const roundTrip = diffLangMaps(result.output, distOutput.map);
const roundTripOk = roundTrip.changed === 0 && roundTrip.added === 0 && roundTrip.removed === 0;

const report = {
  target: data.target.id,
  compileMs: Math.round(compileMs),
  generateMs: Math.round(generateMs),
  totalMs: Math.round(performance.now() - started),
  patterns: compiled.stats,
  sourceKeys: data.source.entries.length,
  outputKeys: artifact.output.size,
  unknown: artifact.unknown.size,
  stats: result.stats,
  dist: {
    root: repoRelative(dist.root),
    output: repoRelative(dist.output),
    unknown: repoRelative(dist.unknown),
  },
  mismatch: parity.mismatch,
  unknownMismatch: parity.unknownMismatch,
  samples: parity.samples,
  unknownSamples: parity.unknownSamples,
  hash: hashOutput(artifact.output),
  roundTrip: {
    changed: roundTrip.changed,
    added: roundTrip.added,
    removed: roundTrip.removed,
    samples: roundTrip.samples,
    ok: roundTripOk,
  },
  ok: parity.ok && roundTripOk,
};

console.log(JSON.stringify(report, null, 2));

if (!report.ok) {
  console.error('[parity] 失败：dist 产物与 legacy golden 不一致，或回读结果与内存结果不同');
  process.exit(1);
}
