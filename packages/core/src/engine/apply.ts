import type { LangEntry } from '../types/lang';
import type { CompiledProject } from './compile';
import type { Candidate } from './matcher';
import { Matcher, dedupeCandidates, selectCandidate } from './matcher';

export interface GenerationStats {
  sourceKeys: number;
  outputKeys: number;
  unknownKeys: number;
  sameAsEnglish: number;
  conflictKeys: number;
  matchedKeys: number;
}

export interface GenerationResult {
  output: Map<string, string>;
  unknown: Set<string>;
  stats: GenerationStats;
  /** 按原文值聚合的候选；调用方可在测试/调试时查看。 */
  candidatesByValue: Map<string, Candidate[]>;
}

/** fallback 必须首次获胜，对齐 C++ 的 std::map::insert。 */
export function buildFallbackMap(entries: LangEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (!map.has(entry.key)) map.set(entry.key, entry.value);
  }
  return map;
}

/**
 * 对完整输入执行 pattern 匹配并生成输出。
 *
 * 与原型一致：候选按“原文值”聚合；同一个值可能被不同 key/namespace 匹配到多条候选，
 * 最终由 key 前缀过滤 + (gen,ri,combo) 取最后。
 */
export function generateFromEntries(
  compiled: CompiledProject,
  sourceEntries: LangEntry[],
  fallbackEntries: LangEntry[],
): GenerationResult {
  const matcher = new Matcher(compiled);
  const candidatesByValue = new Map<string, Candidate[]>();

  for (const entry of sourceEntries) {
    const matched = matcher.match(entry.key, entry.value);
    if (matched.candidates.length === 0) continue;
    let list = candidatesByValue.get(entry.value);
    if (!list) candidatesByValue.set(entry.value, (list = []));
    for (const candidate of matched.candidates) list.push(candidate);
  }

  for (const [value, list] of candidatesByValue) {
    if (list.length > 1) candidatesByValue.set(value, dedupeCandidates(compiled, list));
  }

  const fallbackMap = buildFallbackMap(fallbackEntries);
  const output = new Map<string, string>();
  const unknown = new Set<string>();
  let sameAsEnglish = 0;
  let conflictKeys = 0;
  let matchedKeys = 0;

  for (const entry of sourceEntries) {
    const list = candidatesByValue.get(entry.value) ?? [];
    if (new Set(list.map((candidate) => candidate.target)).size > 1) conflictKeys++;
    const selected = selectCandidate(compiled, entry.key, list);
    if (selected) {
      output.set(entry.key, selected.target);
      matchedKeys++;
      if (selected.target === entry.value) sameAsEnglish++;
      continue;
    }
    const fallback = fallbackMap.get(entry.key);
    if (fallback !== undefined) {
      output.set(entry.key, fallback);
      if (fallback === entry.value) sameAsEnglish++;
      continue;
    }
    output.set(entry.key, entry.value);
    unknown.add(entry.key);
    sameAsEnglish++;
  }

  return {
    output,
    unknown,
    candidatesByValue,
    stats: {
      sourceKeys: sourceEntries.length,
      outputKeys: output.size,
      unknownKeys: unknown.size,
      sameAsEnglish,
      conflictKeys,
      matchedKeys,
    },
  };
}
