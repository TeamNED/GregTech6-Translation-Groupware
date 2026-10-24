import type { GeneratorModel, TemplatePart } from './model';
import type { LexEntry, Lexicon, RuleMeta } from './lexicon';
import { tokenize } from './tokenizer';

export const MAX_TOKENS = 128;
const MAX_PATTERNS_PER_GROUP = 50_000;

export type PatternOp =
  | { kind: 'lit'; token: string }
  | { kind: 'lex'; groupId: number; allowedGenerator?: number }
  | { kind: 'reduce'; meta: RuleMeta };

export interface RemBounds {
  min: number[];
  max: number[];
}

export interface CompiledPattern {
  id: number;
  ops: PatternOp[];
  min: number;
  max: number;
  first: string[];
  last: Set<string>;
  required: string[];
  rem: RemBounds;
}

export interface NamespaceNode {
  children: Map<string, NamespaceNode>;
  patterns: CompiledPattern[] | null;
  candidates: Set<CompiledPattern> | null;
  firstIndex?: Map<string, CompiledPattern[]>;
}

export interface CompileStats {
  topPatterns: number;
  allPatterns: number;
  maxGroupPatterns: number;
  lexEntries: number;
}

export interface CompiledProject {
  model: GeneratorModel;
  lexicon: Lexicon;
  groupPatterns: Map<number, CompiledPattern[]>;
  topPatterns: CompiledPattern[];
  namespaceRoot: NamespaceNode;
  stats: CompileStats;
}

interface GroupBounds {
  min: number;
  max: number;
}

function opSignature(op: PatternOp): string {
  if (op.kind === 'lit') return `L:${op.token}`;
  if (op.kind === 'lex') return `X:${op.groupId}:${op.allowedGenerator ?? ''}`;
  return `R:${op.meta.generatorId}:${op.meta.rule}`;
}

function patternSignature(ops: PatternOp[]): string {
  return ops.map(opSignature).join('|');
}

function pushLiteralOps(seqs: PatternOp[][], tokens: string[]): PatternOp[][] {
  if (tokens.length === 0) return seqs;
  const next: PatternOp[][] = [];
  for (const seq of seqs) {
    const copy = seq.slice();
    for (const token of tokens) copy.push({ kind: 'lit', token });
    next.push(copy);
  }
  return next;
}

/** 编译期把所有规则展开成 LIT/LEX/REDUCE 模式。 */
export function compileProject(model: GeneratorModel, lexicon: Lexicon): CompiledProject {
  let nextPatternId = 0;
  const groupPatternMemo = new Map<number, CompiledPattern[]>();
  const groupVisiting = new Set<number>();
  const groupBoundsMemo = new Map<number, GroupBounds>();
  const groupBoundsVisiting = new Set<number>();

  const boundsFor = (groupId: number): GroupBounds => {
    const memo = groupBoundsMemo.get(groupId);
    if (memo) return memo;
    if (groupBoundsVisiting.has(groupId)) return { min: Infinity, max: 0 };
    groupBoundsVisiting.add(groupId);

    let min = Infinity;
    let max = 0;
    const bucket = lexicon.byFirst.get(groupId);
    if (bucket) {
      for (const entries of bucket.values()) {
        for (const entry of entries) {
          const length = entry.terms.length;
          if (length < min) min = length;
          if (length > max) max = length;
        }
      }
    }
    for (const meta of lexicon.groupRuleMetas.get(groupId) ?? []) {
      let partMin = 0;
      let partMax = 0;
      let valid = true;
      for (const part of meta.srcParts) {
        if (typeof part === 'string') {
          const length = tokenize(part).length;
          partMin += length;
          partMax += length;
          continue;
        }
        const subGroupId = meta.subs[part];
        if (subGroupId === undefined) {
          valid = false;
          break;
        }
        const sub = boundsFor(subGroupId);
        if (!Number.isFinite(sub.min) || sub.max === 0) {
          valid = false;
          break;
        }
        partMin += sub.min;
        partMax += sub.max;
      }
      if (!valid) continue;
      if (partMin < min) min = partMin;
      if (partMax > max) max = partMax;
    }

    const bounds = { min, max: Math.min(max, MAX_TOKENS) };
    groupBoundsVisiting.delete(groupId);
    groupBoundsMemo.set(groupId, bounds);
    return bounds;
  };

  const makePattern = (ops: PatternOp[]): CompiledPattern => {
    let min = 0;
    let max = 0;
    for (const op of ops) {
      if (op.kind === 'lit') {
        min += 1;
        max += 1;
      } else if (op.kind === 'lex') {
        const bounds = boundsFor(op.groupId);
        if (Number.isFinite(bounds.min)) min += bounds.min;
        max += bounds.max;
      }
    }
    if (max > MAX_TOKENS) max = MAX_TOKENS;

    const remMin = new Array<number>(ops.length + 1);
    const remMax = new Array<number>(ops.length + 1);
    remMin[ops.length] = 0;
    remMax[ops.length] = 0;
    for (let index = ops.length - 1; index >= 0; index--) {
      const op = ops[index]!;
      let opMin = 0;
      let opMax = 0;
      if (op.kind === 'lit') {
        opMin = 1;
        opMax = 1;
      } else if (op.kind === 'lex') {
        const bounds = boundsFor(op.groupId);
        opMin = Number.isFinite(bounds.min) ? bounds.min : 0;
        opMax = bounds.max;
      }
      remMin[index] = opMin + remMin[index + 1]!;
      remMax[index] = opMax + remMax[index + 1]!;
    }

    let first: string[] = [];
    const firstOp = ops[0];
    if (firstOp?.kind === 'lit') first = [firstOp.token];
    else if (firstOp?.kind === 'lex') first = lexicon.firstTokens(firstOp.groupId, firstOp.allowedGenerator);

    let last = new Set<string>();
    for (let index = ops.length - 1; index >= 0; index--) {
      const op = ops[index]!;
      if (op.kind === 'lit') {
        last = new Set([op.token]);
        break;
      }
      if (op.kind === 'lex') {
        last = new Set(lexicon.last.get(op.groupId) ?? []);
        break;
      }
    }

    const required: string[] = [];
    for (const op of ops) if (op.kind === 'lit') required.push(op.token);

    return {
      id: nextPatternId++,
      ops,
      min,
      max,
      first,
      last,
      required,
      rem: { min: remMin, max: remMax },
    };
  };

  const compileRule = (meta: RuleMeta): PatternOp[][] => {
    let seqs: PatternOp[][] = [[]];
    for (const part of meta.srcParts as TemplatePart[]) {
      if (typeof part === 'string') {
        seqs = pushLiteralOps(seqs, tokenize(part));
      } else {
        const subGroupId = meta.subs[part];
        if (subGroupId === undefined) return [];
        const subPatterns = compileGroup(subGroupId);
        if (subPatterns.length === 0) return [];
        const next: PatternOp[][] = [];
        for (const seq of seqs) {
          for (const subPattern of subPatterns) {
            next.push(seq.concat(subPattern.ops));
            if (next.length > MAX_PATTERNS_PER_GROUP) {
              throw new Error(`pattern 展开超过上限（${MAX_PATTERNS_PER_GROUP}），请检查规则图`);
            }
          }
        }
        seqs = next;
      }
    }
    return seqs;
  };

  function compileGroup(groupId: number): CompiledPattern[] {
    const memo = groupPatternMemo.get(groupId);
    if (memo) return memo;
    if (groupVisiting.has(groupId)) return [];
    groupVisiting.add(groupId);

    const patterns: CompiledPattern[] = [];
    const seen = new Set<string>();
    const add = (pattern: CompiledPattern) => {
      const signature = patternSignature(pattern.ops);
      if (seen.has(signature)) return;
      seen.add(signature);
      patterns.push(pattern);
    };

    if (lexicon.hasGroupEntries(groupId)) {
      add(makePattern([{ kind: 'lex', groupId }]));
    }
    for (const meta of lexicon.groupRuleMetas.get(groupId) ?? []) {
      const seqs = compileRule(meta);
      for (const seq of seqs) {
        add(makePattern(seq.concat([{ kind: 'reduce', meta }])));
        if (patterns.length > MAX_PATTERNS_PER_GROUP) {
          throw new Error(`组 ${model.groupArr[groupId]} 的 pattern 展开超过上限`);
        }
      }
    }

    groupVisiting.delete(groupId);
    groupPatternMemo.set(groupId, patterns);
    return patterns;
  }

  // 先编译所有组，保证子组 memo 完整。
  for (let groupId = 0; groupId < model.groupArr.length; groupId++) compileGroup(groupId);

  const topPatterns: CompiledPattern[] = [];
  const topSeen = new Set<string>();
  const addTop = (pattern: CompiledPattern) => {
    const signature = patternSignature(pattern.ops);
    if (topSeen.has(signature)) return;
    topSeen.add(signature);
    topPatterns.push(pattern);
  };

  for (const generator of model.gens) {
    if (!generator.completed) continue;
    const groupId = model.gidOf.get(generator.group)!;
    if (generator.kind === 'dict') {
      addTop(makePattern([{ kind: 'lex', groupId }]));
      continue;
    }

    if (lexicon.hasGeneratorEntries(groupId, generator.id)) {
      addTop(makePattern([{ kind: 'lex', groupId, allowedGenerator: generator.id }]));
    }
    for (let ruleIndex = 0; ruleIndex < generator.payload.length; ruleIndex++) {
      const meta = lexicon.ruleMetaByKey.get(`${generator.id}:${ruleIndex}`);
      if (!meta) continue;
      for (const seq of compileRule(meta)) {
        addTop(makePattern(seq.concat([{ kind: 'reduce', meta }])));
      }
    }
  }

  const namespaceRoot: NamespaceNode = { children: new Map(), patterns: null, candidates: null };

  const patternNamespaces = (pattern: CompiledPattern): Set<string> => {
    const namespaces = new Set<string>();
    if (pattern.ops.length === 1 && pattern.ops[0]!.kind === 'lex') {
      const op = pattern.ops[0]!;
      const bucket = lexicon.byFirst.get(op.groupId);
      if (bucket) {
        for (const entries of bucket.values()) {
          for (const entry of entries) {
            if (op.allowedGenerator !== undefined && entry.generatorId !== op.allowedGenerator) continue;
            namespaces.add(entry.namespace || '');
          }
        }
      }
    } else {
      const last = pattern.ops.at(-1);
      if (last?.kind === 'reduce') namespaces.add(last.meta.namespace || '');
    }
    if (namespaces.size === 0) namespaces.add('');
    return namespaces;
  };

  for (const pattern of topPatterns) {
    for (const namespace of patternNamespaces(pattern)) {
      let node = namespaceRoot;
      for (const char of namespace) {
        let next = node.children.get(char);
        if (!next) node.children.set(char, (next = { children: new Map(), patterns: null, candidates: null }));
        node = next;
      }
      if (!node.patterns) node.patterns = [];
      node.patterns.push(pattern);
    }
  }

  const buildCandidates = (node: NamespaceNode, parent: Set<CompiledPattern>) => {
    let candidates = parent;
    if (node.patterns) {
      candidates = new Set(parent);
      for (const pattern of node.patterns) candidates.add(pattern);
    }
    node.candidates = candidates;
    for (const child of node.children.values()) buildCandidates(child, candidates);
  };
  buildCandidates(namespaceRoot, new Set());

  return {
    model,
    lexicon,
    groupPatterns: groupPatternMemo,
    topPatterns,
    namespaceRoot,
    stats: {
      topPatterns: topPatterns.length,
      allPatterns: nextPatternId,
      maxGroupPatterns: Math.max(0, ...[...groupPatternMemo.values()].map((patterns) => patterns.length)),
      lexEntries: lexicon.totalEntries,
    },
  };
}

/** 把模式转换成可读字符串，供日志/调试使用。 */
export function patternLabel(compiled: CompiledProject, pattern: CompiledPattern): string {
  return pattern.ops
    .map((op) => {
      if (op.kind === 'lit') return `LIT(${op.token})`;
      if (op.kind === 'lex') {
        const suffix = op.allowedGenerator === undefined ? '' : `@${op.allowedGenerator}`;
        return `LEX(${compiled.model.groupArr[op.groupId]}${suffix})`;
      }
      return `REDUCE(${compiled.model.gens[op.meta.generatorId]?.group ?? '?'}:${op.meta.rule})`;
    })
    .join(' | ');
}

/** 给 trace/调试用：返回某个组的所有词条。 */
export function groupLexEntries(lexicon: Lexicon, groupId: number): LexEntry[] {
  const result: LexEntry[] = [];
  for (const entries of lexicon.byFirst.get(groupId)?.values() ?? []) result.push(...entries);
  return result;
}
