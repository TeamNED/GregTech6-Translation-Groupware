import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import {
  getTarget,
  parseLegacyLang,
  parseProjectJsonc,
  writeLegacyLang,
  type GenerationResult,
  type LangDocument,
  type ProjectConfigV2,
  type TargetConfig,
} from '../src/index';
import { DEFAULT_DIST_ROOT, distPathsForTarget, type DistPathSet } from './dist';

export const repoRoot = resolve(import.meta.dirname, '../../..');
/** 本地性能记录目录；已加入 .gitignore，每次运行写一个独立 JSON。 */
export const perfRunsDir = resolve(import.meta.dirname, '../.perf');
/** legacy 目录只允许 legacy 自身写入。 */
const legacyRoot = resolve(repoRoot, 'packages/legacy');
/** 迁移期 core 产物只能写到这里。 */
const distRoot = resolve(repoRoot, DEFAULT_DIST_ROOT);

const projectPath = resolve(import.meta.dirname, '../project.jsonc');

export interface Corpus {
  config: ProjectConfigV2;
  source: LangDocument;
  fallback: LangDocument;
}

export interface ProjectData extends Corpus {
  target: TargetConfig;
  dist: DistPathSet;
  golden: LangDocument;
  goldenUnknown: LangDocument;
}

function loadConfig(): ProjectConfigV2 {
  const parsed = parseProjectJsonc(readFileSync(projectPath, 'utf8'));
  if (!parsed.config) {
    throw new Error(`project.jsonc 校验失败：${JSON.stringify(parsed.issues)}`);
  }
  return parsed.config;
}

function workplaceOf(target: TargetConfig): string {
  return resolve(repoRoot, target.workplace);
}

function loadLang(root: string, path: string): LangDocument {
  return parseLegacyLang(readFileSync(resolve(root, path), 'utf8'));
}

/** 只加载生成所需的输入；性能脚本用它，避免多解析 golden。 */
export function loadCorpus(): Corpus {
  const config = loadConfig();
  const target = getTarget(config);
  const workplace = workplaceOf(target);
  return {
    config,
    source: loadLang(workplace, target.source),
    fallback: loadLang(workplace, target.fallback),
  };
}

/** 生成 + 对比所需的完整输入，包括只读的 legacy golden。 */
export function loadProjectData(): ProjectData {
  const config = loadConfig();
  const target = getTarget(config);
  const workplace = workplaceOf(target);
  return {
    config,
    target,
    source: loadLang(workplace, target.source),
    fallback: loadLang(workplace, target.fallback),
    golden: loadLang(workplace, target.output),
    goldenUnknown: loadLang(workplace, target.unknown),
    dist: distPathsForTarget(target),
  };
}

export function repoRelative(path: string): string {
  return relative(repoRoot, path).replaceAll('\\', '/');
}

function isInside(parent: string, path: string): boolean {
  const rel = relative(parent, path);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/** 写盘前的硬性边界：只允许 core/dist，绝不碰 legacy。 */
function assertDistPath(path: string): void {
  if (isInside(legacyRoot, path)) {
    throw new Error(`迁移期禁止写入 legacy：${repoRelative(path)}`);
  }
  if (!isInside(distRoot, path)) {
    throw new Error(`生成物只能写入 ${DEFAULT_DIST_ROOT}：${repoRelative(path)}`);
  }
}

/**
 * 把生成结果写成 dist 产物。
 *
 * 与 legacy 的 C++ 工具不同，这里不生成 `.bak`：dist 可以随时重建，
 * 而 golden 必须保持不被 core 修改。
 */
export function writeDistArtifacts(
  data: ProjectData,
  generated: GenerationResult,
): { root: string; output: string; unknown: string } {
  const outputEntries = data.source.entries.map((entry) => ({
    ...entry,
    value: generated.output.get(entry.key) ?? entry.value,
  }));
  const unknownEntries = data.source.entries
    .filter((entry) => generated.unknown.has(entry.key))
    .map((entry) => ({ ...entry }));

  const outputPath = resolve(repoRoot, data.dist.output);
  const unknownPath = resolve(repoRoot, data.dist.unknown);
  assertDistPath(outputPath);
  assertDistPath(unknownPath);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, writeLegacyLang(outputEntries, data.target.lineEnding), 'utf8');
  writeFileSync(unknownPath, writeLegacyLang(unknownEntries, data.target.lineEnding), 'utf8');

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
