/** 严格分词：单词（允许内部撇号）+ 标点；空白不作为 token。 */

const TOKEN_RE = /[\p{L}\p{N}]+(?:['\u2019][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

function isAsciiAlnum(code: number): boolean {
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function tokenizeAscii(value: string): string[] {
  const result: string[] = [];
  let index = 0;
  while (index < value.length) {
    const code = value.charCodeAt(index);
    if (code === 32 || code === 9 || code === 10 || code === 13) {
      index++;
      continue;
    }
    if (isAsciiAlnum(code)) {
      const start = index++;
      while (index < value.length) {
        const next = value.charCodeAt(index);
        if (isAsciiAlnum(next)) {
          index++;
          continue;
        }
        if ((next === 39 || next === 0x2019) && index + 1 < value.length && isAsciiAlnum(value.charCodeAt(index + 1))) {
          index += 2;
          continue;
        }
        break;
      }
      result.push(value.slice(start, index));
      continue;
    }
    result.push(value[index]!);
    index++;
  }
  return result;
}

/**
 * 与 pattern 原型一致：ASCII 走手写快路径，非 ASCII 才走 Unicode 正则。
 * 这里的边界必须和模板字面量分词完全一致，否则 LIT 会对不上。
 */
export function tokenize(value: string): string[] {
  let ascii = true;
  for (let index = 0; index < value.length; index++) {
    if (value.charCodeAt(index) > 0x7f) {
      ascii = false;
      break;
    }
  }
  if (ascii) return tokenizeAscii(value);

  const result: string[] = [];
  TOKEN_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(value)) !== null) {
    if (/\s/.test(match[0])) continue;
    result.push(match[0]);
  }
  return result;
}

export { tokenizeAscii };
