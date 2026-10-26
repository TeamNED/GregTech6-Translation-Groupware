import { writeLegacyLang, type LangEntry, type LineEnding } from '@gt6tg/core';
import type { RunResult } from './run-summary';

export interface ArtifactTexts {
  output: string;
  unknown: string;
}

/** 把一次运行结果按源文件顺序写成 legacy `.lang` 文本；纯函数，不碰文件系统。 */
export function buildArtifactTexts(
  sourceEntries: readonly LangEntry[],
  result: RunResult,
  lineEnding: LineEnding,
): ArtifactTexts {
  const outputEntries = sourceEntries.map((entry) => ({
    ...entry,
    value: result.output.get(entry.key) ?? entry.value,
  }));
  const unknownEntries = sourceEntries.filter((entry) => result.unknown.has(entry.key)).map((entry) => ({ ...entry }));

  return {
    output: writeLegacyLang(outputEntries, lineEnding),
    unknown: writeLegacyLang(unknownEntries, lineEnding),
  };
}
