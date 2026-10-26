import { compileConfig, generateFromEntries } from '@gt6tg/core';
import { hashOutput } from '../hash';
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

console.log(
  JSON.stringify(
    {
      target: data.target.id,
      compileMs: Math.round(compileMs),
      generateMs: Math.round(generateMs),
      totalMs: Math.round(performance.now() - started),
      patterns: compiled.stats,
      sourceKeys: data.source.entries.length,
      outputKeys: result.output.size,
      unknown: result.unknown.size,
      stats: result.stats,
      hash: hashOutput(result.output),
      dist: {
        root: repoRelative(dist.root),
        output: repoRelative(dist.output),
        unknown: repoRelative(dist.unknown),
      },
      note: '只写入 packages/node/dist，不修改 legacy，也不生成 .bak。',
    },
    null,
    2,
  ),
);
