import type { DiffSample, DiffStats } from '../types/api';
import type { LangDocument, LangFileStats } from '../types/lang';

export function analyzeLangDocument(document: LangDocument): LangFileStats {
  let emptyValues = 0;
  let valuesWithParagraph = 0;
  let valuesWithEquals = 0;
  for (const entry of document.entries) {
    if (entry.value === '') emptyValues++;
    if (entry.value.includes('¶')) valuesWithParagraph++;
    if (entry.value.includes('=')) valuesWithEquals++;
  }
  return {
    keys: document.entries.length,
    uniqueKeys: document.map.size,
    emptyValues,
    duplicateKeys: document.duplicates.length,
    valuesWithParagraph,
    valuesWithEquals,
    lines: document.entries.length,
    lineEnding: document.lineEnding,
  };
}

/**
 * 比较两个 key→value 映射。
 * expected 通常是当前输出，actual 是新生成结果；samples 只保留前 N 条差异。
 */
export function diffLangMaps(expected: Map<string, string>, actual: Map<string, string>, sampleLimit = 20): DiffStats {
  const samples: DiffSample[] = [];
  const pushSample = (sample: DiffSample) => {
    if (samples.length < sampleLimit) samples.push(sample);
  };

  let same = 0;
  let changed = 0;
  let removed = 0;
  for (const [key, expectedValue] of expected) {
    if (!actual.has(key)) {
      removed++;
      pushSample({ key, expected: expectedValue, actual: null });
      continue;
    }
    const actualValue = actual.get(key)!;
    if (actualValue === expectedValue) same++;
    else {
      changed++;
      pushSample({ key, expected: expectedValue, actual: actualValue });
    }
  }

  let added = 0;
  for (const [key, actualValue] of actual) {
    if (!expected.has(key)) {
      added++;
      pushSample({ key, expected: null, actual: actualValue });
    }
  }

  return {
    compared: expected.size,
    same,
    changed,
    added,
    removed,
    samples,
  };
}
