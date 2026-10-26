import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  getTarget,
  parseLegacyLang,
  parseProjectJsonc,
  type LangDocument,
  type ProjectConfigV2,
  type TargetConfig,
} from '@gt6tg/core';
import { distPathsForTarget, type ArtifactTexts, type DistPathSet } from '@gt6tg/runtime';
import { assertArtifactWritable, projectFilePath, repoRelative, repoRoot, resolveInsideRepo } from '../paths';

export { repoRelative, repoRoot };

/** 本地性能记录目录；已加入 .gitignore，每次运行写一个独立 JSON。 */
export const perfRunsDir = resolve(repoRoot, 'packages/node/.perf');

export interface LangFile {
  path: string;
  text: string;
  document: LangDocument;
}

export interface Corpus {
  configText: string;
  config: ProjectConfigV2;
  target: TargetConfig;
  sourcePath: string;
  sourceText: string;
  source: LangDocument;
  fallbackPath: string;
  fallbackText: string;
  fallback: LangDocument;
}

export interface ProjectData extends Corpus {
  goldenPath: string;
  goldenText: string;
  golden: LangDocument;
  goldenUnknownPath: string;
  goldenUnknownText: string;
  goldenUnknown: LangDocument;
  dist: DistPathSet;
}

export function loadProjectConfig(): { configText: string; config: ProjectConfigV2 } {
  const configText = readFileSync(projectFilePath, 'utf8');
  const parsed = parseProjectJsonc(configText);
  if (!parsed.config) {
    throw new Error(`project.jsonc 校验失败：${JSON.stringify(parsed.issues)}`);
  }
  return { configText, config: parsed.config };
}

function loadLangFile(path: string): LangFile {
  const text = readFileSync(path, 'utf8');
  return { path, text, document: parseLegacyLang(text) };
}

function languagePath(root: string, relative: string): string {
  return resolveInsideRepo(join(root, relative));
}

/** 只加载生成所需的输入；性能脚本用它，避免多解析 golden。 */
export function loadCorpus(): Corpus {
  const { configText, config } = loadProjectConfig();
  const target = getTarget(config);
  const workplace = resolveInsideRepo(target.workplace);
  const sourcePath = languagePath(workplace, target.source);
  const fallbackPath = languagePath(workplace, target.fallback);
  const source = loadLangFile(sourcePath);
  const fallback = loadLangFile(fallbackPath);
  return {
    configText,
    config,
    target,
    sourcePath,
    sourceText: source.text,
    source: source.document,
    fallbackPath,
    fallbackText: fallback.text,
    fallback: fallback.document,
  };
}

/** 生成 + 对比所需的完整输入，包括只读的 legacy golden。 */
export function loadProjectData(): ProjectData {
  const corpus = loadCorpus();
  const target = corpus.target;
  const workplace = resolveInsideRepo(target.workplace);
  const goldenPath = languagePath(workplace, target.output);
  const goldenUnknownPath = languagePath(workplace, target.unknown);
  const golden = loadLangFile(goldenPath);
  const goldenUnknown = loadLangFile(goldenUnknownPath);
  return {
    ...corpus,
    goldenPath,
    goldenText: golden.text,
    golden: golden.document,
    goldenUnknownPath,
    goldenUnknownText: goldenUnknown.text,
    goldenUnknown: goldenUnknown.document,
    dist: distPathsForTarget(target),
  };
}

/** 把 worker 返回的文本写成 dist 产物；不生成 `.bak`。 */
export function writeArtifactTexts(
  data: ProjectData,
  artifacts: ArtifactTexts,
): { root: string; output: string; unknown: string } {
  const outputPath = resolve(repoRoot, data.dist.output);
  const unknownPath = resolve(repoRoot, data.dist.unknown);
  assertArtifactWritable(outputPath);
  assertArtifactWritable(unknownPath);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, artifacts.output, 'utf8');
  writeFileSync(unknownPath, artifacts.unknown, 'utf8');

  return {
    root: resolve(repoRoot, data.dist.root),
    output: outputPath,
    unknown: unknownPath,
  };
}

export function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1]! + sorted[middle]!) / 2 : sorted[middle]!;
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
