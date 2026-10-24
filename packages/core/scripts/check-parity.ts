import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileConfig, generateFromEntries, parseLegacyLang, parseProjectJsonc } from '../src/index';

const root = resolve(import.meta.dirname, '../../..');
const projectPath = resolve(import.meta.dirname, '../project.jsonc');
const workplace = resolve(root, 'packages/legacy/workplace');

const started = performance.now();
const parsedProject = parseProjectJsonc(readFileSync(projectPath, 'utf8'));
if (!parsedProject.config) {
  console.error('project.jsonc 解析失败', parsedProject.issues);
  process.exit(1);
}

const compileStarted = performance.now();
const compiled = compileConfig(parsedProject.config);
const compileMs = performance.now() - compileStarted;

const source = parseLegacyLang(readFileSync(resolve(workplace, 'en/GregTech.lang'), 'utf8'));
const fallback = parseLegacyLang(readFileSync(resolve(workplace, 'zh/GregTech.fallback.lang'), 'utf8'));
const golden = parseLegacyLang(readFileSync(resolve(workplace, 'zh/GregTech.lang'), 'utf8'));
const expectedUnknown = parseLegacyLang(readFileSync(resolve(workplace, 'zh/GregTech.unknown.lang'), 'utf8'));

const generateStarted = performance.now();
const result = generateFromEntries(compiled, source.entries, fallback.entries);
const generateMs = performance.now() - generateStarted;

let mismatch = 0;
const samples: Array<[key: string, expected: string | undefined, actual: string | undefined]> = [];
for (const [key, expected] of golden.map) {
  const actual = result.output.get(key);
  if (actual !== expected) {
    mismatch++;
    if (samples.length < 10) samples.push([key, expected, actual]);
  }
}

let unknownMismatch = 0;
const missingSamples: Array<[key: string, expected: boolean]> = [];
for (const key of expectedUnknown.map.keys()) {
  if (!result.unknown.has(key)) {
    unknownMismatch++;
    if (missingSamples.length < 10) missingSamples.push([key, true]);
  }
}
for (const key of result.unknown) {
  if (!expectedUnknown.map.has(key)) {
    unknownMismatch++;
    if (missingSamples.length < 10) missingSamples.push([key, false]);
  }
}

const hash = createHash('sha256');
for (const [key, value] of result.output) hash.update(key).update('\u0000').update(value).update('\n');

console.log(
  JSON.stringify(
    {
      compileMs: Math.round(compileMs),
      generateMs: Math.round(generateMs),
      totalMs: Math.round(performance.now() - started),
      patterns: compiled.stats,
      sourceKeys: source.entries.length,
      outputKeys: result.output.size,
      unknown: result.unknown.size,
      stats: result.stats,
      mismatch,
      unknownMismatch,
      samples,
      missingSamples,
      hash: hash.digest('hex').slice(0, 16),
    },
    null,
    2,
  ),
);
