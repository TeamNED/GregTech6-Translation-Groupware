/**
 * 本地性能记录与前后对比。
 *
 * 每次运行都会在 `packages/node/.perf/` 下写一个独立 JSON（该目录不入库），
 * 记录真实语料上的分阶段耗时、对象计数、内存和 git 修订信息。
 *
 * 用法：
 *   npx tsx src/cli/check-perf.ts --label=before
 *   ... 修改代码 ...
 *   npx tsx src/cli/check-perf.ts --label=after
 *   npx tsx src/cli/check-perf.ts --compare                 # 对比最近两次
 *   npx tsx src/cli/check-perf.ts --compare=a.json,b.json   # 显式指定两个文件
 *
 * 默认只报告差异，不判定失败；`--strict` 时超过 fail 阈值才返回退出码 1。
 * 阈值可用 GT6TG_PERF_WARN（默认 1.15）、GT6TG_PERF_FAIL（默认 1.30）调整。
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { cpus } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { compileConfig, generateFromEntries, type PhaseTiming, type TimingReport } from '@gt6tg/core';
import { loadCorpus, median, perfRunsDir, repoRoot, round } from './lib';

interface PerfRun {
  version: 1;
  label: string;
  createdAt: string;
  machine: {
    id: string;
    label: string;
    platform: string;
    arch: string;
    cores: number;
    cpu: string;
    node: string;
  };
  revision: {
    head: string;
    branch: string;
    dirty: boolean;
  };
  options: {
    runs: number;
    warmup: number;
  };
  timings: {
    compileMs: number;
    generateMs: number;
    totalMs: number;
    compilePhases: PhaseTiming[];
    generatePhases: PhaseTiming[];
    samples: {
      compileMs: number[];
      generateMs: number[];
      totalMs: number[];
    };
  };
  counts: {
    patterns: {
      topPatterns: number;
      allPatterns: number;
      maxGroupPatterns: number;
      lexEntries: number;
    };
    sourceKeys: number;
    outputKeys: number;
    unknownKeys: number;
    sameAsEnglish: number;
    conflictKeys: number;
    matchedKeys: number;
    candidateBuckets: number;
    candidateItems: number;
  };
  memory: {
    heapUsed: number;
    rss: number;
    maxRssKb: number;
  };
}

const args = process.argv.slice(2);
const warnRatio = Number(process.env.GT6TG_PERF_WARN ?? '1.15');
const failRatio = Number(process.env.GT6TG_PERF_FAIL ?? '1.30');
if (!(warnRatio > 0) || !(failRatio > warnRatio)) {
  throw new Error(`阈值无效：warn=${warnRatio} fail=${failRatio}`);
}

if (args.includes('--compare') || args.some((arg) => arg.startsWith('--compare='))) {
  runCompare();
} else {
  runMeasurement();
}

function runMeasurement(): void {
  const runs = Math.max(1, Math.round(numberArg('runs', 3)));
  const warmup = Math.max(0, Math.round(numberArg('warmup', 1, true)));
  const label = stringArg('label') ?? 'run';

  const cpuModel = cpus()[0]?.model.replace(/\s+/g, ' ').trim() ?? 'unknown';
  const cores = cpus().length;
  const machineId = `${process.platform}-${process.arch}-${cores}c-${cpuModel}`;

  const corpus = loadCorpus();
  const compileSamples: number[] = [];
  const generateSamples: number[] = [];
  const totalSamples: number[] = [];
  const compilePhaseSamples = new Map<string, number[]>();
  const generatePhaseSamples = new Map<string, number[]>();

  let lastCompiled: ReturnType<typeof compileConfig> | null = null;
  let lastResult: ReturnType<typeof generateFromEntries> | null = null;

  for (let index = 0; index < warmup + runs; index++) {
    const totalStarted = performance.now();
    const compiled = compileConfig(corpus.config);
    const compileMs = performance.now() - totalStarted;
    const generateStarted = performance.now();
    const result = generateFromEntries(compiled, corpus.source.entries, corpus.fallback.entries);
    const generateMs = performance.now() - generateStarted;
    const totalMs = performance.now() - totalStarted;

    if (index >= warmup) {
      compileSamples.push(compileMs);
      generateSamples.push(generateMs);
      totalSamples.push(totalMs);
      collectPhases(compilePhaseSamples, compiled.timings);
      collectPhases(generatePhaseSamples, result.timings);
      lastCompiled = compiled;
      lastResult = result;
    }
  }

  if (!lastCompiled || !lastResult) throw new Error('没有可用的测量结果');

  let candidateItems = 0;
  for (const list of lastResult.candidatesByValue.values()) candidateItems += list.length;
  const usage = process.memoryUsage();

  const run: PerfRun = {
    version: 1,
    label,
    createdAt: new Date().toISOString(),
    machine: {
      id: machineId,
      label: `${process.platform}-${process.arch} ${cores}c ${cpuModel}`,
      platform: process.platform,
      arch: process.arch,
      cores,
      cpu: cpuModel,
      node: process.version,
    },
    revision: readRevision(),
    options: { runs, warmup },
    timings: {
      compileMs: round(median(compileSamples)),
      generateMs: round(median(generateSamples)),
      totalMs: round(median(totalSamples)),
      compilePhases: medianPhases(compilePhaseSamples),
      generatePhases: medianPhases(generatePhaseSamples),
      samples: {
        compileMs: compileSamples.map((value) => round(value)),
        generateMs: generateSamples.map((value) => round(value)),
        totalMs: totalSamples.map((value) => round(value)),
      },
    },
    counts: {
      patterns: { ...lastCompiled.stats },
      sourceKeys: lastResult.stats.sourceKeys,
      outputKeys: lastResult.stats.outputKeys,
      unknownKeys: lastResult.stats.unknownKeys,
      sameAsEnglish: lastResult.stats.sameAsEnglish,
      conflictKeys: lastResult.stats.conflictKeys,
      matchedKeys: lastResult.stats.matchedKeys,
      candidateBuckets: lastResult.candidatesByValue.size,
      candidateItems,
    },
    memory: {
      heapUsed: usage.heapUsed,
      rss: usage.rss,
      maxRssKb: process.resourceUsage().maxRSS,
    },
  };

  const filePath = writeRun(run);
  if (args.includes('--json')) {
    console.log(JSON.stringify(run, null, 2));
  } else {
    console.log(`[perf] 已记录：${filePath}`);
    console.log(
      `[perf] compile ${run.timings.compileMs} ms / generate ${run.timings.generateMs} ms / total ${run.timings.totalMs} ms`,
    );
    console.log(
      `[perf] keys=${run.counts.sourceKeys} output=${run.counts.outputKeys} unknown=${run.counts.unknownKeys} ` +
        `patterns=${run.counts.patterns.topPatterns}/${run.counts.patterns.allPatterns} buckets=${run.counts.candidateBuckets}`,
    );
    console.log('[perf] 修改前后各跑一次，再用 `--compare` 对比最近两次记录。');
  }
}

function runCompare(): void {
  const explicit = parseComparePaths();
  let files: string[];
  let before: PerfRun;
  let after: PerfRun;
  try {
    files = explicit.length ? explicit.map(resolveRunPath) : latestRunFiles(2);
    if (files.length < 2) {
      console.error('[perf] 至少需要两份记录才能对比；先运行 `--label=before` 和 `--label=after`。');
      process.exit(1);
    }
    before = readRun(files[0]!);
    after = readRun(files[1]!);
  } catch (error) {
    console.error(`[perf] ${(error as Error).message}`);
    process.exit(1);
  }

  console.log(`[perf] 对比：${files[0]}`);
  console.log(`[perf]       ${files[1]}`);
  if (before.machine.id !== after.machine.id) {
    console.log('[perf] 注意：两份记录来自不同机器，耗时对比仅供参考。');
  }
  if (before.revision.head !== after.revision.head) {
    console.log(`[perf] 修订：${before.revision.head.slice(0, 10)} → ${after.revision.head.slice(0, 10)}`);
  }

  console.log('');
  printTimingRow('compile', before.timings.compileMs, after.timings.compileMs);
  printTimingRow('generate', before.timings.generateMs, after.timings.generateMs);
  printTimingRow('total', before.timings.totalMs, after.timings.totalMs);

  console.log('');
  console.log('[perf] 分阶段（generate）');
  printPhaseRows(before.timings.generatePhases, after.timings.generatePhases);
  console.log('[perf] 分阶段（compile）');
  printPhaseRows(before.timings.compilePhases, after.timings.compilePhases);

  console.log('');
  console.log('[perf] 对象计数');
  printCountRows(before, after);

  const worst = Math.max(
    ratioOf(before.timings.generateMs, after.timings.generateMs),
    ratioOf(before.timings.totalMs, after.timings.totalMs),
  );
  if (!Number.isFinite(worst)) {
    console.log('');
    console.log('[perf] 耗时比值为 n/a（基线为 0 或记录损坏），跳过阈值判定。');
  } else if (worst > failRatio) {
    console.log('');
    console.log(`[perf] 最差 ${percent(worst)}，超过 fail 阈值 ${percent(failRatio)}。`);
    if (args.includes('--strict')) process.exit(1);
  } else if (worst > warnRatio) {
    console.log('');
    console.log(`[perf] 最差 ${percent(worst)}，超过 warn 阈值 ${percent(warnRatio)}。`);
  }
}

function printTimingRow(label: string, before: number, after: number): void {
  const ratio = ratioOf(before, after);
  console.log(
    `[perf] ${label.padEnd(9)} ${String(before).padStart(9)} ms → ${String(after).padStart(9)} ms  ${percent(ratio)}`,
  );
}

function ratioOf(before: number, after: number): number {
  if (!(before > 0)) return after > 0 ? Number.POSITIVE_INFINITY : 1;
  return after / before;
}

function printPhaseRows(before: PhaseTiming[], after: PhaseTiming[]): void {
  const names = new Set([...before.map((phase) => phase.name), ...after.map((phase) => phase.name)]);
  for (const name of names) {
    const beforeMs = before.find((phase) => phase.name === name)?.ms ?? 0;
    const afterMs = after.find((phase) => phase.name === name)?.ms ?? 0;
    printTimingRow(name, beforeMs, afterMs);
  }
}

function printCountRows(before: PerfRun, after: PerfRun): void {
  const rows: Array<[string, number, number]> = [
    ['patterns.top', before.counts.patterns.topPatterns, after.counts.patterns.topPatterns],
    ['patterns.all', before.counts.patterns.allPatterns, after.counts.patterns.allPatterns],
    ['patterns.maxGroup', before.counts.patterns.maxGroupPatterns, after.counts.patterns.maxGroupPatterns],
    ['lexEntries', before.counts.patterns.lexEntries, after.counts.patterns.lexEntries],
    ['sourceKeys', before.counts.sourceKeys, after.counts.sourceKeys],
    ['outputKeys', before.counts.outputKeys, after.counts.outputKeys],
    ['unknownKeys', before.counts.unknownKeys, after.counts.unknownKeys],
    ['sameAsEnglish', before.counts.sameAsEnglish, after.counts.sameAsEnglish],
    ['conflictKeys', before.counts.conflictKeys, after.counts.conflictKeys],
    ['matchedKeys', before.counts.matchedKeys, after.counts.matchedKeys],
    ['candidateBuckets', before.counts.candidateBuckets, after.counts.candidateBuckets],
    ['candidateItems', before.counts.candidateItems, after.counts.candidateItems],
  ];
  for (const [label, beforeValue, afterValue] of rows) {
    const delta = afterValue - beforeValue;
    const suffix = delta === 0 ? '' : `  ${delta > 0 ? '+' : ''}${delta}`;
    console.log(
      `[perf] ${label.padEnd(17)} ${String(beforeValue).padStart(9)} → ${String(afterValue).padStart(9)}${suffix}`,
    );
  }
}

function collectPhases(target: Map<string, number[]>, report: TimingReport | undefined): void {
  for (const phase of report?.phases ?? []) {
    let values = target.get(phase.name);
    if (!values) target.set(phase.name, (values = []));
    values.push(phase.ms);
  }
}

function medianPhases(samples: Map<string, number[]>): PhaseTiming[] {
  return [...samples].map(([name, values]) => ({ name, ms: round(median(values)) }));
}

function writeRun(run: PerfRun): string {
  mkdirSync(perfRunsDir, { recursive: true });
  // 保留毫秒，避免同一秒内同 label 的两次运行互相覆盖。
  const stamp = run.createdAt.replace(/[-:.]/g, '');
  const safeLabel = run.label.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'run';
  const filePath = join(perfRunsDir, `${stamp}-${safeLabel}-${run.revision.head.slice(0, 7)}.json`);
  writeFileSync(filePath, `${JSON.stringify(run, null, 2)}\n`, 'utf8');
  return filePath;
}

function latestRunFiles(count: number): string[] {
  try {
    return readdirSync(perfRunsDir)
      .filter((name) => name.endsWith('.json'))
      .sort()
      .slice(-count)
      .map((name) => join(perfRunsDir, name));
  } catch {
    return [];
  }
}

function parseComparePaths(): string[] {
  const inline = args.find((arg) => arg.startsWith('--compare='));
  if (inline) {
    return inline
      .slice('--compare='.length)
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
  }
  const index = args.indexOf('--compare');
  return args
    .slice(index + 1)
    .filter((arg) => !arg.startsWith('-'))
    .slice(0, 2);
}

function resolveRunPath(value: string): string {
  if (isAbsolute(value)) return value;
  const direct = resolve(process.cwd(), value);
  if (existsSync(direct)) return direct;
  const inDir = join(perfRunsDir, value.endsWith('.json') ? value : `${value}.json`);
  if (existsSync(inDir)) return inDir;
  throw new Error(`找不到性能记录：${value}`);
}

function readRun(filePath: string): PerfRun {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (error) {
    throw new Error(`无法解析性能记录 ${filePath}：${(error as Error).message}`);
  }
  if (!isPerfRun(parsed)) throw new Error(`性能记录格式不正确：${filePath}`);
  return parsed;
}

function isPerfRun(value: unknown): value is PerfRun {
  const run = asRecord(value);
  if (!run || run.version !== 1) return false;

  const machine = asRecord(run.machine);
  const revision = asRecord(run.revision);
  const options = asRecord(run.options);
  const timings = asRecord(run.timings);
  const counts = asRecord(run.counts);
  const patterns = asRecord(counts?.patterns);

  return (
    typeof run.label === 'string' &&
    typeof machine?.id === 'string' &&
    typeof machine.label === 'string' &&
    typeof machine.platform === 'string' &&
    typeof machine.arch === 'string' &&
    isNumber(machine.cores) &&
    typeof machine.cpu === 'string' &&
    typeof machine.node === 'string' &&
    typeof revision?.head === 'string' &&
    typeof revision.branch === 'string' &&
    typeof revision.dirty === 'boolean' &&
    isNumber(options?.runs) &&
    isNumber(options.warmup) &&
    isNumber(timings?.compileMs) &&
    isNumber(timings.generateMs) &&
    isNumber(timings.totalMs) &&
    isPhaseArray(timings.compilePhases) &&
    isPhaseArray(timings.generatePhases) &&
    isNumber(counts?.sourceKeys) &&
    isNumber(counts.outputKeys) &&
    isNumber(counts.unknownKeys) &&
    isNumber(counts.sameAsEnglish) &&
    isNumber(counts.conflictKeys) &&
    isNumber(counts.matchedKeys) &&
    isNumber(counts.candidateBuckets) &&
    isNumber(counts.candidateItems) &&
    isNumber(patterns?.topPatterns) &&
    isNumber(patterns.allPatterns) &&
    isNumber(patterns.maxGroupPatterns) &&
    isNumber(patterns.lexEntries)
  );
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPhaseArray(value: unknown): value is PhaseTiming[] {
  return (
    Array.isArray(value) &&
    value.every((phase) => {
      const record = asRecord(phase);
      return record !== null && typeof record.name === 'string' && isNumber(record.ms);
    })
  );
}

function readRevision(): PerfRun['revision'] {
  const head = gitOutput(['rev-parse', 'HEAD']) ?? 'unknown';
  const branch = gitOutput(['rev-parse', '--abbrev-ref', 'HEAD']) ?? 'unknown';
  const status = gitOutput(['status', '--porcelain']);
  return { head, branch, dirty: status !== null && status.length > 0 };
}

function gitOutput(gitArgs: string[]): string | null {
  try {
    return execFileSync('git', gitArgs, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

function numberArg(name: string, fallback: number, allowZero = false): number {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  if (!value) return fallback;
  const parsed = Number(value.slice(prefix.length));
  if (!Number.isFinite(parsed) || parsed < 0 || (!allowZero && parsed === 0)) {
    throw new Error(`${name} 必须是${allowZero ? '非负' : '正'}数`);
  }
  return parsed;
}

function stringArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function percent(ratio: number): string {
  if (!Number.isFinite(ratio)) return 'n/a';
  const delta = (ratio - 1) * 100;
  return `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`;
}
