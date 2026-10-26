import { compareToGolden, lintProject, parseLegacyLang, parseProjectJsonc, type ConfigIssue } from '@gt6tg/core';
import { NodeEngineClient } from '../engine-client';
import { hashOutput } from '../hash';
import { projectFilePath } from '../paths';
import { loadCorpus, loadProjectConfig, loadProjectData, repoRelative, writeArtifactTexts } from './lib';

/** legacy config.yml 里已存在的问题，gate 把它作为已知基线而不是新失败。 */
const KNOWN_MISSING_GROUPS = ['materialProductWoodType'];

export interface LintOptions {
  allowKnown?: boolean;
}

export async function runGenerate(_args: string[]): Promise<number> {
  const data = loadProjectData();
  const client = new NodeEngineClient();
  try {
    const compiled = await client.compile(data.configText);
    const started = performance.now();
    const run = await client.run({
      compileId: compiled.compileId,
      sourceText: data.sourceText,
      fallbackText: data.fallbackText,
      lineEnding: data.target.lineEnding,
      scope: 'all',
    });
    const dist = writeArtifactTexts(data, {
      output: run.outputText,
      unknown: run.unknownText,
    });

    console.log(
      JSON.stringify(
        {
          target: data.target.id,
          compileMs: Math.round(compiled.timings.totalMs),
          generateMs: Math.round(run.summary.timings.totalMs),
          totalMs: Math.round(performance.now() - started),
          patterns: compiled.stats,
          sourceKeys: run.summary.stats.sourceKeys,
          outputKeys: run.summary.stats.outputKeys,
          unknown: run.summary.stats.unknownKeys,
          stats: run.summary.stats,
          hash: run.summary.hash,
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
    return 0;
  } finally {
    client.close();
  }
}

export async function runParity(_args: string[]): Promise<number> {
  const data = loadProjectData();
  const client = new NodeEngineClient();
  try {
    const compiled = await client.compile(data.configText);
    const run = await client.run({
      compileId: compiled.compileId,
      sourceText: data.sourceText,
      fallbackText: data.fallbackText,
      lineEnding: data.target.lineEnding,
      scope: 'all',
    });
    const dist = writeArtifactTexts(data, {
      output: run.outputText,
      unknown: run.unknownText,
    });

    const distOutput = parseLegacyLang(run.outputText);
    const distUnknown = parseLegacyLang(run.unknownText);
    const artifact = {
      output: distOutput.map,
      unknown: new Set(distUnknown.entries.map((entry) => entry.key)),
    };
    const parity = compareToGolden(data.golden, artifact, data.goldenUnknown);
    const roundTripHash = hashOutput(artifact.output);
    const roundTripOk = roundTripHash === run.summary.hash;
    const unknownRoundTripOk = sameSet(artifact.unknown, new Set(run.unknownKeys));
    const ok = parity.ok && roundTripOk && unknownRoundTripOk;

    console.log(
      JSON.stringify(
        {
          target: data.target.id,
          compileMs: Math.round(compiled.timings.totalMs),
          generateMs: Math.round(run.summary.timings.totalMs),
          totalMs: Math.round(run.summary.durationMs),
          patterns: compiled.stats,
          sourceKeys: run.summary.stats.sourceKeys,
          outputKeys: artifact.output.size,
          unknown: artifact.unknown.size,
          stats: run.summary.stats,
          dist: {
            root: repoRelative(dist.root),
            output: repoRelative(dist.output),
            unknown: repoRelative(dist.unknown),
          },
          mismatch: parity.mismatch,
          unknownMismatch: parity.unknownMismatch,
          samples: parity.samples,
          unknownSamples: parity.unknownSamples,
          hash: roundTripHash,
          roundTrip: {
            hash: roundTripHash,
            expected: run.summary.hash,
            ok: roundTripOk,
            unknownOk: unknownRoundTripOk,
          },
          ok,
        },
        null,
        2,
      ),
    );

    if (!ok) {
      console.error('[parity] 失败：dist 产物与 legacy golden 不一致，或回读结果与内存结果不同');
      return 1;
    }
    return 0;
  } finally {
    client.close();
  }
}

export async function runHash(_args: string[]): Promise<number> {
  const corpus = loadCorpus();
  const client = new NodeEngineClient();
  try {
    const compiled = await client.compile(corpus.configText);
    const run = await client.run({
      compileId: compiled.compileId,
      sourceText: corpus.sourceText,
      fallbackText: corpus.fallbackText,
      lineEnding: corpus.target.lineEnding,
      scope: 'all',
    });

    console.log(
      JSON.stringify(
        {
          target: corpus.target.id,
          sourceKeys: run.summary.stats.sourceKeys,
          outputKeys: run.summary.stats.outputKeys,
          unknown: run.summary.stats.unknownKeys,
          stats: run.summary.stats,
          patterns: compiled.stats,
          hash: run.summary.hash,
        },
        null,
        2,
      ),
    );
    return 0;
  } finally {
    client.close();
  }
}

export async function runLint(_args: string[], options: LintOptions = {}): Promise<number> {
  const { configText } = loadProjectConfig();
  const parsed = parseProjectJsonc(configText);
  const lint = parsed.config ? lintProject(parsed.config) : undefined;
  const issues = [...parsed.issues, ...(lint?.issues ?? [])];
  const baseline = options.allowKnown ? issues.filter(isKnownMissingGroup) : [];
  const remaining = baseline.length ? issues.filter((issue) => !isKnownMissingGroup(issue)) : issues;
  const errors = remaining.filter((issue) => issue.severity === 'error');

  console.log(
    JSON.stringify(
      {
        path: projectFilePath,
        parsed: parsed.config !== null,
        stats: lint?.stats,
        issues: remaining,
        baseline,
        ok: errors.length === 0,
      },
      null,
      2,
    ),
  );

  return errors.length ? 1 : 0;
}

/** gate 的顺序检查；lint 使用已知基线，避免 legacy 配置的历史问题阻塞门禁。 */
export async function runGate(args: string[]): Promise<number> {
  const lintCode = await runLint(args, { allowKnown: true });
  if (lintCode !== 0) return lintCode;

  const parityCode = await runParity(args);
  if (parityCode !== 0) return parityCode;

  const hashCode = await runHash(args);
  if (hashCode !== 0) return hashCode;

  const { runPerf } = await import('./perf');
  return runPerf(args);
}

function isKnownMissingGroup(issue: ConfigIssue): boolean {
  return issue.code === 'group.missing' && KNOWN_MISSING_GROUPS.some((group) => issue.message.includes(group));
}

function sameSet(left: Set<string>, right: Set<string>): boolean {
  if (left.size !== right.size) return false;
  for (const value of left) if (!right.has(value)) return false;
  return true;
}
