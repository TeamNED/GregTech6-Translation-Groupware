import type { CandidateView, TraceStep } from '../types/api';
import type { CompiledPattern, CompiledProject, NamespaceNode } from './compile';
import { MAX_TOKENS, patternLabel } from './compile';
import { tokenize } from './tokenizer';

export interface Candidate {
  target: string;
  namespace: string;
  idx: number;
  generatorId: number;
  rule: number;
  combo: number;
}

export interface PatternAttempt {
  pattern: string;
  accepted: boolean;
  reason?: string;
}

export interface MatchOptions {
  trace?: TraceStep[];
  attempts?: PatternAttempt[];
  maxSteps?: number;
}

export interface MatchResult {
  tokens: string[];
  candidates: Candidate[];
  patternsTried: number;
}

interface MatchState {
  target: string;
  namespace: string;
  idx: number;
  generatorId: number;
  rule: number;
  combo: number;
}

function toView(compiled: CompiledProject, candidate: Candidate): CandidateView {
  return {
    target: candidate.target,
    namespace: candidate.namespace,
    generator: compiled.model.gens[candidate.generatorId]?.group ?? '?',
    generatorId: candidate.generatorId,
    rule: candidate.rule,
    combo: candidate.combo,
  };
}

/** 前端只读的候选视图；去重后按 order 从大到小。 */
export function candidateViews(compiled: CompiledProject, candidates: Candidate[]): CandidateView[] {
  return candidates.map((candidate) => toView(compiled, candidate));
}

/**
 * 输入驱动的 pattern 匹配器。
 *
 * 匹配器持有编译结果和 token 缓存；一个 Matcher 实例可复用于整个输入文件。
 */
export class Matcher {
  private readonly compiled: CompiledProject;
  private readonly tokenCache = new Map<string, string[]>();
  private lastNamespace = '';
  private lastNode: NamespaceNode;

  constructor(compiled: CompiledProject) {
    this.compiled = compiled;
    this.lastNode = compiled.namespaceRoot;
  }

  tokenize(value: string): string[] {
    const cached = this.tokenCache.get(value);
    if (cached) return cached;
    const tokens = tokenize(value);
    this.tokenCache.set(value, tokens);
    return tokens;
  }

  /**
   * 沿 namespace trie 找当前 key 的最深命名空间节点。
   * 连续 key 往往共享前缀，所以缓存上一次节点，避免每个 key 都从根走。
   */
  namespaceNode(key: string): NamespaceNode {
    let node: NamespaceNode;
    let start: number;
    if (this.lastNamespace && key.startsWith(this.lastNamespace)) {
      node = this.lastNode;
      start = this.lastNamespace.length;
    } else {
      node = this.compiled.namespaceRoot;
      start = 0;
    }

    let bestNode = node;
    let bestLength = start;
    for (let index = start; index < key.length; index++) {
      const next = node.children.get(key[index]!);
      if (!next) break;
      node = next;
      if (node.patterns) {
        bestNode = node;
        bestLength = index + 1;
      }
    }
    this.lastNamespace = key.slice(0, bestLength);
    this.lastNode = bestNode;
    return bestNode;
  }

  private nodeIndex(node: NamespaceNode): Map<string, CompiledPattern[]> {
    if (node.firstIndex) return node.firstIndex;
    const index = new Map<string, CompiledPattern[]>();
    for (const pattern of node.candidates ?? []) {
      for (const token of pattern.first) {
        let list = index.get(token);
        if (!list) index.set(token, (list = []));
        list.push(pattern);
      }
    }
    node.firstIndex = index;
    return index;
  }

  private candidatePatterns(key: string, tokens: string[]): CompiledPattern[] {
    if (tokens.length === 0 || tokens.length > MAX_TOKENS) return [];
    const node = this.namespaceNode(key);
    return this.nodeIndex(node).get(tokens[0]!) ?? [];
  }

  match(key: string, value: string, options: MatchOptions = {}): MatchResult {
    const tokens = this.tokenize(value);
    const trace = options.trace;
    const maxSteps = options.maxSteps ?? 400;
    const addStep = (step: TraceStep) => {
      if (trace && trace.length < maxSteps) trace.push(step);
    };

    addStep({ stage: 'tokenize', message: value, data: { tokens } });
    if (tokens.length === 0 || tokens.length > MAX_TOKENS) {
      addStep({ stage: 'reject', message: 'token 数为 0 或超过上限', data: { count: tokens.length } });
      return { tokens, candidates: [], patternsTried: 0 };
    }

    const patterns = this.candidatePatterns(key, tokens);
    addStep({
      stage: 'namespace',
      message: this.lastNamespace || '<root>',
      data: { patternCount: patterns.length },
    });

    const candidates: Candidate[] = [];
    let patternsTried = 0;

    for (const pattern of patterns) {
      patternsTried++;
      const label = patternLabel(this.compiled, pattern);
      if (options.attempts && options.attempts.length < 120) {
        options.attempts.push({ pattern: label, accepted: false });
      }
      if (tokens.length < pattern.min || tokens.length > pattern.max) {
        addStep({
          stage: 'reject',
          message: label,
          data: { reason: 'min/max', min: pattern.min, max: pattern.max, tokens: tokens.length },
        });
        continue;
      }
      if (pattern.last.size > 0 && !pattern.last.has(tokens.at(-1)!)) {
        addStep({ stage: 'reject', message: label, data: { reason: 'last-token' } });
        continue;
      }
      if (pattern.required.length > 0) {
        let requiredIndex = 0;
        for (let index = 0; index < tokens.length && requiredIndex < pattern.required.length; index++) {
          if (tokens[index] === pattern.required[requiredIndex]) requiredIndex++;
        }
        if (requiredIndex !== pattern.required.length) {
          addStep({ stage: 'reject', message: label, data: { reason: 'required-literal' } });
          continue;
        }
      }

      const before = candidates.length;
      this.execute(pattern, tokens, key, candidates, addStep);
      if (options.attempts) {
        const lastAttempt = options.attempts.at(-1);
        if (lastAttempt && lastAttempt.pattern === label) lastAttempt.accepted = candidates.length > before;
      }
    }

    return { tokens, candidates, patternsTried };
  }

  private execute(
    pattern: CompiledPattern,
    tokens: string[],
    key: string,
    candidates: Candidate[],
    addStep: (step: TraceStep) => void,
  ): void {
    const ops = pattern.ops;
    const tokenCount = tokens.length;
    const stack: MatchState[] = [];
    const label = patternLabel(this.compiled, pattern);
    addStep({ stage: 'pattern', message: label, data: { min: pattern.min, max: pattern.max } });

    const executeFrom = (opIndex: number, position: number, stackPointer: number, minStackPointer: number): void => {
      if (opIndex === ops.length) {
        if (position !== tokenCount || stackPointer === 0) return;
        const result = stack[stackPointer - 1];
        if (!result || !this.compiled.model.gens[result.generatorId]?.completed) return;
        const candidate: Candidate = {
          target: result.target,
          namespace: result.namespace,
          idx: result.idx,
          generatorId: result.generatorId,
          rule: result.rule,
          combo: result.combo,
        };
        candidates.push(candidate);
        addStep({
          stage: 'emit',
          message: result.target,
          data: {
            namespace: result.namespace,
            generator: this.compiled.model.gens[result.generatorId]?.group,
            generatorId: result.generatorId,
            rule: result.rule,
            combo: result.combo,
          },
        });
        return;
      }

      const op = ops[opIndex]!;
      if (op.kind === 'lit') {
        if (position < tokenCount && tokens[position] === op.token) {
          addStep({ stage: 'lit', message: op.token, data: { position } });
          executeFrom(opIndex + 1, position + 1, stackPointer, minStackPointer);
        }
        return;
      }

      if (op.kind === 'lex') {
        const root = this.compiled.lexicon.trie.get(op.groupId);
        if (!root) return;
        let node = root;
        let cursor = position;
        while (cursor < tokenCount) {
          const next = node.children.get(tokens[cursor]!);
          if (!next) return;
          node = next;
          cursor++;

          if (!node.entries) continue;
          const remaining = tokenCount - cursor;
          const remMin = pattern.rem.min[opIndex + 1] ?? 0;
          const remMax = pattern.rem.max[opIndex + 1] ?? 0;
          if (remaining < remMin || remaining > remMax) continue;

          for (const entry of node.entries) {
            if (op.allowedGenerator !== undefined && entry.generatorId !== op.allowedGenerator) continue;
            if (entry.namespace && !key.startsWith(entry.namespace)) continue;
            addStep({
              stage: 'lex',
              message: entry.terms.join(' '),
              data: {
                group: this.compiled.model.groupArr[entry.groupId],
                terms: entry.terms,
                target: entry.target,
                namespace: entry.namespace,
                generator: this.compiled.model.gens[entry.generatorId]?.group,
                generatorId: entry.generatorId,
                rule: entry.rule,
                combo: entry.combo,
                position,
              },
            });
            stack[stackPointer] = {
              target: entry.target,
              namespace: entry.namespace,
              idx: entry.index,
              generatorId: entry.generatorId,
              rule: entry.rule,
              combo: entry.combo,
            };
            executeFrom(opIndex + 1, cursor, stackPointer + 1, stackPointer);
          }
        }
        return;
      }

      const meta = op.meta;
      const slotOccurrences = meta.slotOrder.length;
      if (stackPointer < slotOccurrences) return;
      const base = stackPointer - slotOccurrences;
      const children = Array.from({ length: meta.slotCount }, () => undefined as MatchState | undefined);
      for (let occurrence = 0; occurrence < slotOccurrences; occurrence++) {
        const slot = meta.slotOrder[occurrence]!;
        children[slot] = stack[base + occurrence];
      }

      let namespace = meta.namespace;
      let valid = true;
      for (let slot = 0; slot < meta.slotCount; slot++) {
        const child = children[slot];
        if (!child) {
          valid = false;
          break;
        }
        const combined = this.compiled.model.combineNs(namespace, child.namespace);
        if (combined === null) {
          valid = false;
          break;
        }
        namespace = combined;
      }
      if (!valid) return;

      let combo = 0;
      for (let slot = 0; slot < meta.slotCount; slot++) {
        combo = combo * meta.subSizes[slot]! + children[slot]!.idx;
      }

      let target = '';
      for (const part of meta.tgtParts) {
        target += typeof part === 'number' ? children[part]!.target : part;
      }

      const result: MatchState = {
        target,
        namespace,
        idx: meta.base + combo,
        generatorId: meta.generatorId,
        rule: meta.rule,
        combo,
      };
      addStep({
        stage: 'reduce',
        message: `${this.compiled.model.gens[meta.generatorId]?.group ?? '?'}:${meta.rule}`,
        data: {
          target,
          namespace,
          combo,
          idx: result.idx,
          slots: meta.slotOrder,
        },
      });

      const saved = base < minStackPointer ? stack.slice(base, minStackPointer) : null;
      stack[base] = result;
      executeFrom(opIndex + 1, position, base + 1, minStackPointer);
      if (saved) {
        for (let index = 0; index < saved.length; index++) stack[base + index] = saved[index]!;
      }
    };

    executeFrom(0, 0, 0, 0);
  }
}

/** 按 (namespace, target) 去重，保留 order 更大的候选。 */
export function dedupeCandidates(compiled: CompiledProject, candidates: Candidate[]): Candidate[] {
  if (candidates.length < 2) return candidates;
  const map = new Map<string, Candidate>();
  for (const candidate of candidates) {
    const key = `${candidate.namespace}\u0000${candidate.target}`;
    const old = map.get(key);
    if (
      !old ||
      compiled.model.betterOrder(
        { gen: candidate.generatorId, ri: candidate.rule, combo: candidate.combo },
        { gen: old.generatorId, ri: old.rule, combo: old.combo },
      )
    ) {
      map.set(key, candidate);
    }
  }
  return [...map.values()];
}

/** 选最终候选：先按 key 前缀过滤，再取 order 最大。 */
export function selectCandidate(
  compiled: CompiledProject,
  key: string,
  candidates: Candidate[],
): Candidate | undefined {
  let best: Candidate | undefined;
  for (const candidate of candidates) {
    if (candidate.namespace && !key.startsWith(candidate.namespace)) continue;
    if (
      !best ||
      compiled.model.betterOrder(
        { gen: candidate.generatorId, ri: candidate.rule, combo: candidate.combo },
        { gen: best.generatorId, ri: best.rule, combo: best.combo },
      )
    ) {
      best = candidate;
    }
  }
  return best;
}
