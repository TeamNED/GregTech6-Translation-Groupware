/** 旧版 .lang 解析结果与文件级统计。 */

export interface LangEntry {
  key: string;
  value: string;
  /** 1-based 原始行号。 */
  line: number;
}

export interface LangDuplicate {
  key: string;
  value: string;
  line: number;
  previousValue: string;
  previousLine: number;
}

export type DetectedLineEnding = 'crlf' | 'lf' | 'mixed' | 'none';

export interface LangDocument {
  entries: LangEntry[];
  /** 后写覆盖，用于按 key 查源文/输出；fallback 需要单独按首次获胜处理。 */
  map: Map<string, string>;
  duplicates: LangDuplicate[];
  lineEnding: DetectedLineEnding;
  /** 文件没有 languagefile 块等结构问题时产生。 */
  issues: { code: string; message: string; line?: number }[];
}

export interface LangFileStats {
  keys: number;
  uniqueKeys: number;
  emptyValues: number;
  duplicateKeys: number;
  valuesWithParagraph: number;
  valuesWithEquals: number;
  lines: number;
  lineEnding: DetectedLineEnding;
}
