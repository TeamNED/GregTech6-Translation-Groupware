import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getTarget, parseLegacyLang, parseProjectJsonc, type LangDocument, type ProjectConfigV2 } from '../src/index';

export const repoRoot = resolve(import.meta.dirname, '../../..');
/** 本地性能记录目录；已加入 .gitignore，每次运行写一个独立 JSON。 */
export const perfRunsDir = resolve(import.meta.dirname, '../.perf');

const projectPath = resolve(import.meta.dirname, '../project.jsonc');
const workplace = resolve(repoRoot, 'packages/legacy/workplace');

export interface Corpus {
  config: ProjectConfigV2;
  source: LangDocument;
  fallback: LangDocument;
}

export function loadCorpus(): Corpus {
  const parsed = parseProjectJsonc(readFileSync(projectPath, 'utf8'));
  if (!parsed.config) {
    throw new Error(`project.jsonc 校验失败：${JSON.stringify(parsed.issues)}`);
  }
  const target = getTarget(parsed.config);
  return {
    config: parsed.config,
    source: parseLegacyLang(readFileSync(resolve(workplace, target.source), 'utf8')),
    fallback: parseLegacyLang(readFileSync(resolve(workplace, target.fallback), 'utf8')),
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
