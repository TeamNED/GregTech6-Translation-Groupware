import type { DetectedLineEnding, LangDocument, LangDuplicate, LangEntry } from '../types/lang';

function detectLineEnding(text: string): DetectedLineEnding {
  let crlf = 0;
  let lf = 0;
  const segments = text.split('\n');
  for (let index = 0; index < segments.length - 1; index++) {
    if (segments[index]!.endsWith('\r')) crlf++;
    else lf++;
  }
  if (crlf > 0 && lf > 0) return 'mixed';
  if (crlf > 0) return 'crlf';
  if (lf > 0) return 'lf';
  return 'none';
}

/**
 * 解析旧版 .lang。
 *
 * 语义对齐 C++ LangFile：
 * - 从包含 languagefile 的行开始；
 * - 每个含 = 的行按第一个 = 切分，key 去掉前导空格；
 * - 遇到含 } 的行结束；
 * - 保留 S: 前缀和值里的所有字符（包括 ¶、=）。
 */
export function parseLegacyLang(text: string): LangDocument {
  const entries: LangEntry[] = [];
  const map = new Map<string, string>();
  const duplicates: LangDuplicate[] = [];
  const seen = new Map<string, LangEntry>();
  const issues: LangDocument['issues'] = [];
  const lineEnding = detectLineEnding(text);

  let started = false;
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    const lineNumber = index + 1;
    if (!started) {
      if (line.includes('languagefile')) started = true;
      continue;
    }
    if (line.includes('=')) {
      const equals = line.indexOf('=');
      const start = line.search(/[^ ]/);
      if (start < 0 || start >= equals) continue;
      const key = line.slice(start, equals);
      const value = line.slice(equals + 1);
      const entry: LangEntry = { key, value, line: lineNumber };
      entries.push(entry);
      const previous = seen.get(key);
      if (previous) {
        duplicates.push({
          key,
          value,
          line: lineNumber,
          previousValue: previous.value,
          previousLine: previous.line,
        });
      } else {
        seen.set(key, entry);
      }
      map.set(key, value);
      continue;
    }
    if (line.includes('}')) {
      started = false;
    }
  }

  if (entries.length === 0) {
    issues.push({ code: 'lang.empty', message: '没有找到 languagefile 词条' });
  }

  return { entries, map, duplicates, lineEnding, issues };
}

/** 按旧版格式写入；顺序由调用方决定（应与源文件 key 顺序一致）。 */
export function writeLegacyLang(entries: LangEntry[], lineEnding: 'crlf' | 'lf' = 'crlf'): string {
  const eol = lineEnding === 'lf' ? '\n' : '\r\n';
  const lines = [
    '# Configuration file',
    'enablelangfile {',
    '    B:UseThisFileAsLanguageFile=true',
    '}',
    '',
    'languagefile {',
    ...entries.map((entry) => `    ${entry.key}=${entry.value}`),
    '}',
    '',
  ];
  return lines.join(eol) + eol;
}
