import {
  analyzeLangDocument,
  compareToGolden,
  diffLangMaps,
  parseLegacyLang,
  type FileInfo,
  type IoCheckReport,
  type MemorySnapshot,
  type TargetConfig,
  type TimingReport,
} from '@gt6tg/core';
import type { RunSummary } from '@gt6tg/runtime';

export interface BrowserReportInput {
  target: TargetConfig;
  sourceText?: string;
  fallbackText?: string;
  goldenText?: string;
  goldenUnknownText?: string;
  outputText: string;
  unknownText: string;
  unknownKeys: string[];
  summary: RunSummary;
  compileTimings: TimingReport;
  readMs: number;
  compileMs: number;
  generateMs: number;
  memory?: MemorySnapshot;
}

/** 浏览器 REPL 没有文件系统，用内存文本合成与 node 侧相同形状的 IoCheckReport。 */
export function buildBrowserIoReport(input: BrowserReportInput): IoCheckReport {
  const diffStarted = performance.now();
  const output = parseLegacyLang(input.outputText);
  const golden = input.goldenText === undefined ? undefined : parseLegacyLang(input.goldenText);
  const goldenUnknown = input.goldenUnknownText === undefined ? undefined : parseLegacyLang(input.goldenUnknownText);
  const artifact = { output: output.map, unknown: new Set(input.unknownKeys) };
  const parity = compareToGolden(golden ?? emptyDocument(), artifact, goldenUnknown ?? emptyDocument());
  const diffVsCurrent = diffLangMaps(golden?.map ?? new Map(), output.map);
  const diffMs = performance.now() - diffStarted;

  const notes: string[] = [];
  if (input.sourceText === undefined) notes.push('尚未上传源语言文件');
  if (input.fallbackText === undefined) notes.push('尚未上传 fallback；将只依赖生成器');
  if (input.goldenText === undefined) notes.push('尚未上传 golden；parity 会把全部 golden key 视为缺失');
  if (input.goldenUnknownText === undefined) notes.push('尚未上传 legacy unknown；所有 unknown 视为多余');
  notes.push('浏览器 REPL：产物只保存在内存，刷新后丢弃。');

  return {
    targetId: input.target.id,
    workplace: input.target.workplace,
    distRoot: 'browser://memory',
    source: fileInfo(`${input.target.workplace}/${input.target.source}`, input.sourceText),
    fallback: fileInfo(`${input.target.workplace}/${input.target.fallback}`, input.fallbackText),
    output: fileInfo(`${input.target.workplace}/${input.target.output}`, input.goldenText),
    unknown: fileInfo(`${input.target.workplace}/${input.target.unknown}`, input.goldenUnknownText),
    generated: {
      keys: input.summary.stats.outputKeys,
      unknownKeys: input.summary.stats.unknownKeys,
      sameAsEnglish: input.summary.stats.sameAsEnglish,
      conflictKeys: input.summary.stats.conflictKeys,
      durationMs: Math.round(input.summary.timings.totalMs),
      hash: input.summary.hash,
      timings: input.summary.timings,
      memory: input.memory,
    },
    parity,
    timings: {
      totalMs: input.readMs + input.compileMs + input.generateMs + diffMs,
      readMs: input.readMs,
      compileMs: input.compileMs,
      generateMs: input.generateMs,
      diffMs,
      compile: input.compileTimings,
      generate: input.summary.timings,
    },
    diffVsCurrent,
    notes,
  };
}

function fileInfo(path: string, text: string | undefined): FileInfo {
  if (text === undefined) {
    return {
      path,
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

  const stats = analyzeLangDocument(parseLegacyLang(text));
  return {
    path,
    exists: true,
    size: new TextEncoder().encode(text).length,
    lines: text.split(/\r?\n/).length,
    keys: stats.keys,
    uniqueKeys: stats.uniqueKeys,
    emptyValues: stats.emptyValues,
    duplicateKeys: stats.duplicateKeys,
    valuesWithParagraph: stats.valuesWithParagraph,
    valuesWithEquals: stats.valuesWithEquals,
    lineEnding: stats.lineEnding,
  };
}

function emptyDocument() {
  return {
    entries: [],
    map: new Map<string, string>(),
    duplicates: [],
    lineEnding: 'none' as const,
    issues: [],
  };
}
