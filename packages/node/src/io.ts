import { join } from 'node:path';
import {
  analyzeLangDocument,
  compareToGolden,
  diffLangMaps,
  parseLegacyLang,
  type EntryTestResult,
  type FileInfo,
  type GenerateResult,
  type IoCheckReport,
  type LangDocument,
  type OperationTiming,
  type TargetConfig,
} from '@gt6tg/core';
import { distPathsForTarget } from '@gt6tg/runtime';
import { NodeEngineClient } from './engine-client';
import { readTextIfExists, repoRelative, resolveInsideRepo, writeArtifact } from './paths';
import { ProjectStore } from './projectStore';

export interface ResolvedTarget {
  target: TargetConfig;
  workplace: string;
  source: string;
  fallback: string;
  /** legacy golden：迁移期只读，作为 parity 基准。 */
  golden: string;
  goldenUnknown: string;
  /** Node 自己的产物路径（可写）。 */
  dist: {
    root: string;
    output: string;
    unknown: string;
  };
}

interface ReadLangResult {
  text: string | null;
  document: LangDocument;
  info: FileInfo;
}

export function resolveTarget(store: ProjectStore, targetId?: string): ResolvedTarget {
  const target = store.target(targetId);
  const workplace = resolveInsideRepo(target.workplace);
  const dist = distPathsForTarget(target);
  return {
    target,
    workplace,
    source: resolveInsideRepo(join(workplace, target.source)),
    fallback: resolveInsideRepo(join(workplace, target.fallback)),
    golden: resolveInsideRepo(join(workplace, target.output)),
    goldenUnknown: resolveInsideRepo(join(workplace, target.unknown)),
    dist: {
      root: resolveInsideRepo(dist.root),
      output: resolveInsideRepo(dist.output),
      unknown: resolveInsideRepo(dist.unknown),
    },
  };
}

function emptyDocument(): LangDocument {
  return {
    entries: [],
    map: new Map(),
    duplicates: [],
    lineEnding: 'none',
    issues: [{ code: 'file.missing', message: '文件不存在' }],
  };
}

function emptyFileInfo(path: string): FileInfo {
  return {
    path: repoRelative(path),
    exists: false,
    size: 0,
    lines: 0,
    keys: 0,
    uniqueKeys: 0,
    emptyValues: 0,
    duplicateKeys: 0,
    valuesWithParagraph: 0,
    valuesWithEquals: 0,
    lineEnding: 'none',
  };
}

async function readLang(path: string): Promise<ReadLangResult> {
  const text = await readTextIfExists(path);
  if (text === null) return { text: null, document: emptyDocument(), info: emptyFileInfo(path) };
  const document = parseLegacyLang(text);
  const stats = analyzeLangDocument(document);
  return {
    text,
    document,
    info: {
      path: repoRelative(path),
      exists: true,
      size: Buffer.byteLength(text, 'utf8'),
      lines: text.split(/\r?\n/).length,
      keys: stats.keys,
      uniqueKeys: stats.uniqueKeys,
      emptyValues: stats.emptyValues,
      duplicateKeys: stats.duplicateKeys,
      valuesWithParagraph: stats.valuesWithParagraph,
      valuesWithEquals: stats.valuesWithEquals,
      lineEnding: stats.lineEnding,
    },
  };
}

function buildNotes(
  store: ProjectStore,
  source: ReadLangResult,
  fallback: ReadLangResult,
  golden: ReadLangResult,
  goldenUnknown: ReadLangResult,
  dist: ResolvedTarget['dist'],
): string[] {
  const notes: string[] = [];
  if (!source.info.exists) notes.push('源文件不存在，无法生成');
  if (!fallback.info.exists) notes.push('fallback 不存在，将只依赖生成器');
  if (!golden.info.exists) notes.push('legacy golden 不存在，parity 会把全部 golden key 视为缺失');
  if (!goldenUnknown.info.exists) notes.push('legacy unknown 不存在，parity 会把所有 unknown 视为多余');
  if (source.document.duplicates.length) notes.push(`源文件有 ${source.document.duplicates.length} 个重复 key`);
  if (fallback.document.duplicates.length)
    notes.push(`fallback 有 ${fallback.document.duplicates.length} 个重复 key（首次获胜）`);
  if (golden.document.duplicates.length) notes.push(`legacy golden 有 ${golden.document.duplicates.length} 个重复 key`);
  if (goldenUnknown.document.duplicates.length)
    notes.push(`legacy unknown 有 ${goldenUnknown.document.duplicates.length} 个重复 key`);
  notes.push(`迁移期 legacy 只读；生成物写入 ${repoRelative(dist.output)}（不生成 .bak）`);
  const errors = store.current().issues.filter((issue) => issue.severity === 'error');
  if (errors.length) notes.push(`配置有 ${errors.length} 个 error，生成结果可能不可用`);
  return notes;
}

export async function checkIo(store: ProjectStore, engine: NodeEngineClient, targetId: string): Promise<IoCheckReport> {
  const totalStarted = performance.now();
  const paths = resolveTarget(store, targetId);

  const readStarted = performance.now();
  const [source, fallback, golden, goldenUnknown] = await Promise.all([
    readLang(paths.source),
    readLang(paths.fallback),
    readLang(paths.golden),
    readLang(paths.goldenUnknown),
  ]);
  const readMs = performance.now() - readStarted;

  const compileStarted = performance.now();
  const compiled = await engine.compile(store.current().raw);
  const compileMs = performance.now() - compileStarted;

  const generateStarted = performance.now();
  const run = await engine.run({
    compileId: compiled.compileId,
    sourceText: source.text ?? '',
    fallbackText: fallback.text ?? undefined,
    lineEnding: paths.target.lineEnding,
    scope: 'all',
  });
  const generateMs = performance.now() - generateStarted;

  const diffStarted = performance.now();
  const generatedOutput = parseLegacyLang(run.outputText);
  const generatedUnknown = new Set(run.unknownKeys);
  const artifact = { output: generatedOutput.map, unknown: generatedUnknown };
  const diffVsCurrent = diffLangMaps(golden.document.map, generatedOutput.map);
  const parity = compareToGolden(golden.document, artifact, goldenUnknown.document);
  const diffMs = performance.now() - diffStarted;

  const notes = buildNotes(store, source, fallback, golden, goldenUnknown, paths.dist);
  const metrics = await engine.metrics();

  const timings: OperationTiming = {
    totalMs: performance.now() - totalStarted,
    readMs,
    compileMs,
    generateMs,
    diffMs,
    compile: compiled.timings,
    generate: run.summary.timings,
  };

  return {
    targetId: paths.target.id,
    workplace: repoRelative(paths.workplace),
    distRoot: repoRelative(paths.dist.root),
    source: source.info,
    fallback: fallback.info,
    output: golden.info,
    unknown: goldenUnknown.info,
    generated: {
      keys: run.summary.stats.outputKeys,
      unknownKeys: run.summary.stats.unknownKeys,
      sameAsEnglish: run.summary.stats.sameAsEnglish,
      conflictKeys: run.summary.stats.conflictKeys,
      durationMs: Math.round(run.summary.timings.totalMs),
      hash: run.summary.hash,
      timings: run.summary.timings,
      memory: metrics.memory,
    },
    parity,
    timings,
    diffVsCurrent,
    notes,
  };
}

export async function generate(
  store: ProjectStore,
  engine: NodeEngineClient,
  targetId: string,
  write: boolean,
  includeOutput = false,
): Promise<GenerateResult> {
  const totalStarted = performance.now();
  const paths = resolveTarget(store, targetId);

  const readStarted = performance.now();
  const [source, fallback, golden] = await Promise.all([
    readLang(paths.source),
    readLang(paths.fallback),
    readLang(paths.golden),
  ]);
  const readMs = performance.now() - readStarted;
  if (!source.info.exists) throw new Error(`源文件不存在：${source.info.path}`);

  const compileStarted = performance.now();
  const compiled = await engine.compile(store.current().raw);
  const compileMs = performance.now() - compileStarted;

  const generateStarted = performance.now();
  const run = await engine.run({
    compileId: compiled.compileId,
    sourceText: source.text ?? '',
    fallbackText: fallback.text ?? undefined,
    lineEnding: paths.target.lineEnding,
    scope: 'all',
  });
  const generateMs = performance.now() - generateStarted;

  const generatedOutput = parseLegacyLang(run.outputText);
  const diffStarted = performance.now();
  const diffVsCurrent = diffLangMaps(golden.document.map, generatedOutput.map);
  const diffMs = performance.now() - diffStarted;

  let written: GenerateResult['written'];
  let writeMs = 0;
  if (write) {
    const writeStarted = performance.now();
    await writeArtifact(paths.dist.output, run.outputText);
    await writeArtifact(paths.dist.unknown, run.unknownText);
    written = {
      distRoot: repoRelative(paths.dist.root),
      outputPath: repoRelative(paths.dist.output),
      unknownPath: repoRelative(paths.dist.unknown),
    };
    writeMs = performance.now() - writeStarted;
  }

  const timings: OperationTiming = {
    totalMs: performance.now() - totalStarted,
    readMs,
    compileMs,
    generateMs,
    diffMs,
    writeMs,
    compile: compiled.timings,
    generate: run.summary.timings,
  };

  const generatedUnknown = new Set(run.unknownKeys);
  return {
    targetId: paths.target.id,
    dryRun: !write,
    durationMs: Math.round(run.summary.timings.totalMs),
    timings,
    sourceKeys: run.summary.stats.sourceKeys,
    outputKeys: run.summary.stats.outputKeys,
    unknownKeys: run.summary.stats.unknownKeys,
    sameAsEnglish: run.summary.stats.sameAsEnglish,
    conflictKeys: run.summary.stats.conflictKeys,
    hash: run.summary.hash,
    diffVsCurrent,
    written,
    output: includeOutput ? Object.fromEntries(generatedOutput.map) : undefined,
    unknown: includeOutput
      ? Object.fromEntries(
          source.document.entries
            .filter((entry) => generatedUnknown.has(entry.key))
            .map((entry) => [entry.key, entry.value]),
        )
      : undefined,
  };
}

export async function runEntryTest(
  store: ProjectStore,
  engine: NodeEngineClient,
  targetId: string,
  key: string,
  value?: string,
): Promise<EntryTestResult> {
  const paths = resolveTarget(store, targetId);
  const [source, fallback] = await Promise.all([readLang(paths.source), readLang(paths.fallback)]);
  const compiled = await engine.compile(store.current().raw);
  return engine.testEntry({
    compileId: compiled.compileId,
    targetId: paths.target.id,
    key,
    value,
    sourceText: source.text ?? undefined,
    fallbackText: fallback.text ?? undefined,
    issues: store.current().issues,
  });
}
