import { createHash } from 'node:crypto';
import { join } from 'node:path';
import {
  analyzeLangDocument,
  buildFallbackMap,
  diffLangMaps,
  generateFromEntries,
  parseLegacyLang,
  testEntry as coreTestEntry,
  writeLegacyLang,
  type EntryTestResult,
  type FileInfo,
  type GenerateResult,
  type IoCheckReport,
  type LangDocument,
  type OperationTiming,
  type TargetConfig,
} from '@gt6tg/core';
import { readTextIfExists, repoRelative, resolveInsideRepo, writeWithBackup } from './paths';
import { ProjectStore } from './projectStore';

export interface ResolvedTarget {
  target: TargetConfig;
  workplace: string;
  source: string;
  fallback: string;
  output: string;
  unknown: string;
}

interface ReadLangResult {
  text: string | null;
  document: LangDocument;
  info: FileInfo;
}

export function resolveTarget(store: ProjectStore, targetId?: string): ResolvedTarget {
  const target = store.target(targetId);
  const workplace = resolveInsideRepo(target.workplace);
  const source = resolveInsideRepo(join(workplace, target.source));
  const fallback = resolveInsideRepo(join(workplace, target.fallback));
  const output = resolveInsideRepo(join(workplace, target.output));
  const unknown = resolveInsideRepo(join(workplace, target.unknown));
  return { target, workplace, source, fallback, output, unknown };
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

function hashOutput(output: Map<string, string>): string {
  const hash = createHash('sha256');
  for (const [key, value] of output) hash.update(key).update('\u0000').update(value).update('\n');
  return hash.digest('hex').slice(0, 16);
}

function buildNotes(
  store: ProjectStore,
  source: ReadLangResult,
  fallback: ReadLangResult,
  output: ReadLangResult,
  unknown: ReadLangResult,
): string[] {
  const notes: string[] = [];
  if (!source.info.exists) notes.push('源文件不存在，无法生成');
  if (!fallback.info.exists) notes.push('fallback 不存在，将只依赖生成器');
  if (!output.info.exists) notes.push('当前输出不存在，diff 将显示全部为新增');
  if (!unknown.info.exists) notes.push('当前 unknown 不存在');
  if (source.document.duplicates.length) notes.push(`源文件有 ${source.document.duplicates.length} 个重复 key`);
  if (fallback.document.duplicates.length)
    notes.push(`fallback 有 ${fallback.document.duplicates.length} 个重复 key（首次获胜）`);
  if (output.document.duplicates.length) notes.push(`输出有 ${output.document.duplicates.length} 个重复 key`);
  if (unknown.document.duplicates.length) notes.push(`unknown 有 ${unknown.document.duplicates.length} 个重复 key`);
  const errors = store.current().issues.filter((issue) => issue.severity === 'error');
  if (errors.length) notes.push(`配置有 ${errors.length} 个 error，生成结果可能不可用`);
  return notes;
}

export async function checkIo(store: ProjectStore, targetId: string): Promise<IoCheckReport> {
  const totalStarted = performance.now();
  const paths = resolveTarget(store, targetId);

  const readStarted = performance.now();
  const [source, fallback, output, unknown] = await Promise.all([
    readLang(paths.source),
    readLang(paths.fallback),
    readLang(paths.output),
    readLang(paths.unknown),
  ]);
  const readMs = performance.now() - readStarted;

  const compileStarted = performance.now();
  const compiled = store.getCompiled();
  const compileMs = performance.now() - compileStarted;

  const generateStarted = performance.now();
  const generated = generateFromEntries(compiled, source.document.entries, fallback.document.entries);
  const generateMs = performance.now() - generateStarted;

  const diffStarted = performance.now();
  const diffVsCurrent = diffLangMaps(output.document.map, generated.output);
  const diffMs = performance.now() - diffStarted;

  const hash = hashOutput(generated.output);
  const notes = buildNotes(store, source, fallback, output, unknown);

  const timings: OperationTiming = {
    totalMs: performance.now() - totalStarted,
    readMs,
    compileMs,
    generateMs,
    diffMs,
    compile: compiled.timings,
    generate: generated.timings,
  };

  return {
    targetId: paths.target.id,
    workplace: repoRelative(paths.workplace),
    source: source.info,
    fallback: fallback.info,
    output: output.info,
    unknown: unknown.info,
    generated: {
      keys: generated.output.size,
      unknownKeys: generated.unknown.size,
      sameAsEnglish: generated.stats.sameAsEnglish,
      conflictKeys: generated.stats.conflictKeys,
      durationMs: Math.round(generateMs),
      hash,
      timings: generated.timings,
    },
    timings,
    diffVsCurrent,
    notes,
  };
}

export async function generate(
  store: ProjectStore,
  targetId: string,
  write: boolean,
  includeOutput = false,
): Promise<GenerateResult> {
  const totalStarted = performance.now();
  const paths = resolveTarget(store, targetId);

  const readStarted = performance.now();
  const [source, fallback, output] = await Promise.all([
    readLang(paths.source),
    readLang(paths.fallback),
    readLang(paths.output),
  ]);
  const readMs = performance.now() - readStarted;
  if (!source.info.exists) throw new Error(`源文件不存在：${source.info.path}`);

  const compileStarted = performance.now();
  const compiled = store.getCompiled();
  const compileMs = performance.now() - compileStarted;

  const generateStarted = performance.now();
  const generated = generateFromEntries(compiled, source.document.entries, fallback.document.entries);
  const generateMs = performance.now() - generateStarted;

  const diffStarted = performance.now();
  const diffVsCurrent = diffLangMaps(output.document.map, generated.output);
  const diffMs = performance.now() - diffStarted;

  const hash = hashOutput(generated.output);

  let written: GenerateResult['written'];
  let writeMs = 0;
  if (write) {
    const writeStarted = performance.now();
    const outputEntries = source.document.entries.map((entry) => ({
      ...entry,
      value: generated.output.get(entry.key) ?? entry.value,
    }));
    const unknownEntries = source.document.entries
      .filter((entry) => generated.unknown.has(entry.key))
      .map((entry) => ({ ...entry }));
    const outputPath = paths.output;
    const unknownPath = paths.unknown;
    const backupPaths: string[] = [];
    const outputBackup = await writeWithBackup(outputPath, writeLegacyLang(outputEntries, paths.target.lineEnding));
    if (outputBackup) backupPaths.push(outputBackup);
    const unknownBackup = await writeWithBackup(unknownPath, writeLegacyLang(unknownEntries, paths.target.lineEnding));
    if (unknownBackup) backupPaths.push(unknownBackup);
    written = {
      outputPath: repoRelative(outputPath),
      unknownPath: repoRelative(unknownPath),
      backupPaths: backupPaths.map(repoRelative),
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
    generate: generated.timings,
  };

  return {
    targetId: paths.target.id,
    dryRun: !write,
    durationMs: Math.round(generateMs),
    timings,
    sourceKeys: source.document.entries.length,
    outputKeys: generated.output.size,
    unknownKeys: generated.unknown.size,
    sameAsEnglish: generated.stats.sameAsEnglish,
    conflictKeys: generated.stats.conflictKeys,
    hash,
    diffVsCurrent,
    written,
    output: includeOutput ? Object.fromEntries(generated.output) : undefined,
    unknown: includeOutput
      ? Object.fromEntries(
          source.document.entries
            .filter((entry) => generated.unknown.has(entry.key))
            .map((entry) => [entry.key, entry.value]),
        )
      : undefined,
  };
}

export async function runEntryTest(
  store: ProjectStore,
  targetId: string,
  key: string,
  value?: string,
): Promise<EntryTestResult> {
  const paths = resolveTarget(store, targetId);
  const [source, fallback] = await Promise.all([readLang(paths.source), readLang(paths.fallback)]);
  const resolvedValue = value ?? source.document.map.get(key);
  if (resolvedValue === undefined) throw new Error(`找不到 key 的英文值：${key}`);

  const compiled = store.getCompiled();
  const fallbackMap = buildFallbackMap(fallback.document.entries);
  const result = coreTestEntry(compiled, key, resolvedValue, fallbackMap, store.current().issues);
  result.targetId = paths.target.id;
  return result;
}
