import { compileConfig, generateFromEntries } from '@gt6tg/core';
import { hashOutput } from '../hash';
import { loadProjectData } from './lib';

const data = loadProjectData();
const compiled = compileConfig(data.config);
const result = generateFromEntries(compiled, data.source.entries, data.fallback.entries);

console.log(
  JSON.stringify(
    {
      target: data.target.id,
      sourceKeys: data.source.entries.length,
      outputKeys: result.output.size,
      unknown: result.unknown.size,
      stats: result.stats,
      patterns: compiled.stats,
      hash: hashOutput(result.output),
    },
    null,
    2,
  ),
);
