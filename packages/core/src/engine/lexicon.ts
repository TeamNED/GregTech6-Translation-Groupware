import type { GeneratorModel, TemplatePart } from './model';
import { tokenize } from './tokenizer';

export interface LexEntry {
  terms: string[];
  target: string;
  namespace: string;
  generatorId: number;
  rule: number;
  combo: number;
  index: number;
  groupId: number;
}

export interface LexTrieNode {
  children: Map<string, LexTrieNode>;
  entries: LexEntry[] | null;
}

export interface RuleMeta {
  groupId: number;
  generatorId: number;
  rule: number;
  namespace: string;
  srcParts: TemplatePart[];
  tgtParts: TemplatePart[];
  subs: number[];
  subSizes: number[];
  slotOrder: number[];
  slotCount: number;
  base: number;
  count: number;
}

export interface Lexicon {
  byFirst: Map<number, Map<string, LexEntry[]>>;
  last: Map<number, Set<string>>;
  trie: Map<number, LexTrieNode>;
  groupRuleMetas: Map<number, RuleMeta[]>;
  ruleMetaByKey: Map<string, RuleMeta>;
  groupEntryCount: Map<number, number>;
  totalEntries: number;
  hasGroupEntries(groupId: number): boolean;
  hasGeneratorEntries(groupId: number, generatorId: number): boolean;
  firstTokens(groupId: number, allowedGenerator?: number): string[];
}

function isWordBoundary(char: string | undefined): boolean {
  return Boolean(char && /[\p{L}\p{N}]/u.test(char));
}

/** 检测词内拼接：占位符紧贴字母数字，例如 {0}Crush、{0}s。 */
function hasAffix(parts: TemplatePart[]): boolean {
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (typeof part !== 'number') continue;
    const before = parts[index - 1];
    const after = parts[index + 1];
    if (typeof before === 'string' && isWordBoundary(before.at(-1))) return true;
    if (typeof after === 'string' && isWordBoundary(after[0])) return true;
  }
  return false;
}

/**
 * 构建词法表。
 *
 * - dict 条目直接成为 LEX 词条；
 * - affix 规则在编译期展开成具体词条（例如 AbyssalniteCrush Hammer Head）；
 * - 普通规则记录 RuleMeta，交给 compile 阶段展开成 LIT/LEX/REDUCE。
 */
export function buildLexicon(model: GeneratorModel): Lexicon {
  const byFirst = new Map<number, Map<string, LexEntry[]>>();
  const last = new Map<number, Set<string>>();
  const trie = new Map<number, LexTrieNode>();
  const groupRuleMetas = new Map<number, RuleMeta[]>();
  const ruleMetaByKey = new Map<string, RuleMeta>();
  const groupEntryCount = new Map<number, number>();
  let totalEntries = 0;

  const addEntry = (groupId: number, entry: LexEntry) => {
    let firstMap = byFirst.get(groupId);
    if (!firstMap) byFirst.set(groupId, (firstMap = new Map()));
    const firstToken = entry.terms[0]!;
    let bucket = firstMap.get(firstToken);
    if (!bucket) firstMap.set(firstToken, (bucket = []));
    bucket.push(entry);

    let lastSet = last.get(groupId);
    if (!lastSet) last.set(groupId, (lastSet = new Set()));
    lastSet.add(entry.terms.at(-1)!);

    let root = trie.get(groupId);
    if (!root) trie.set(groupId, (root = { children: new Map(), entries: null }));
    let node = root;
    for (const term of entry.terms) {
      let next = node.children.get(term);
      if (!next) node.children.set(term, (next = { children: new Map(), entries: null }));
      node = next;
    }
    if (!node.entries) node.entries = [];
    node.entries.push(entry);

    groupEntryCount.set(groupId, (groupEntryCount.get(groupId) ?? 0) + 1);
    totalEntries++;
  };

  for (const group of model.groupArr) {
    const groupId = model.gidOf.get(group)!;
    const metas: RuleMeta[] = [];
    let base = 0;

    for (const generatorId of model.groupIndex.get(group) ?? []) {
      const generator = model.gens[generatorId]!;
      if (generator.kind === 'dict') {
        let combo = 0;
        for (const [source, target] of generator.payload) {
          const terms = tokenize(source);
          if (terms.length > 0) {
            addEntry(groupId, {
              terms,
              target,
              namespace: generator.namespace,
              generatorId: generator.id,
              rule: 0,
              combo,
              index: base + combo,
              groupId,
            });
          }
          combo++;
        }
        base += generator.payload.length;
        continue;
      }

      for (const [ruleIndex, rule] of generator.payload.entries()) {
        const srcParts = model.compileTemplate(rule.s);
        const tgtParts = model.compileTemplate(rule.t);

        if (hasAffix(srcParts)) {
          if (rule.subs.length !== 1) continue;
          const entries = model.resolveGroup(rule.subs[0]!);
          let pushed = 0;
          for (const entry of entries) {
            const namespace = model.combineNs(generator.namespace, entry.ns);
            if (namespace === null) continue;
            const source = srcParts.map((part) => (typeof part === 'number' ? entry.s : part)).join('');
            const terms = tokenize(source);
            if (terms.length === 0) continue;
            const target = tgtParts.map((part) => (typeof part === 'number' ? entry.t : part)).join('');
            addEntry(groupId, {
              terms,
              target,
              namespace,
              generatorId: generator.id,
              rule: ruleIndex,
              combo: entry.idx,
              index: base + pushed,
              groupId,
            });
            pushed++;
          }
          base += entries.length;
          continue;
        }

        if (rule.subs.length === 0) continue;
        let count = 1;
        let valid = true;
        const subSizes: number[] = [];
        const subs: number[] = [];
        for (const sub of rule.subs) {
          const subSize = model.groupSize(sub);
          subSizes.push(subSize);
          if (subSize === 0) {
            valid = false;
            break;
          }
          const gid = model.gidOf.get(sub);
          if (gid === undefined) {
            valid = false;
            break;
          }
          subs.push(gid);
          count *= subSize;
        }
        if (!valid || count === 0) continue;

        const slotOrder: number[] = [];
        for (const part of srcParts) if (typeof part === 'number') slotOrder.push(part);
        const meta: RuleMeta = {
          groupId,
          generatorId: generator.id,
          rule: ruleIndex,
          namespace: generator.namespace,
          srcParts,
          tgtParts,
          subs,
          subSizes,
          slotOrder,
          slotCount: rule.subs.length,
          base,
          count,
        };
        metas.push(meta);
        ruleMetaByKey.set(`${generator.id}:${ruleIndex}`, meta);
        base += count;
      }
    }
    groupRuleMetas.set(groupId, metas);
  }

  return {
    byFirst,
    last,
    trie,
    groupRuleMetas,
    ruleMetaByKey,
    groupEntryCount,
    totalEntries,
    hasGroupEntries(groupId: number) {
      return (groupEntryCount.get(groupId) ?? 0) > 0;
    },
    hasGeneratorEntries(groupId: number, generatorId: number) {
      const bucket = byFirst.get(groupId);
      if (!bucket) return false;
      for (const entries of bucket.values()) {
        for (const entry of entries) if (entry.generatorId === generatorId) return true;
      }
      return false;
    },
    firstTokens(groupId: number, allowedGenerator?: number) {
      const bucket = byFirst.get(groupId);
      if (!bucket) return [];
      if (allowedGenerator === undefined) return [...bucket.keys()];
      const tokens = new Set<string>();
      for (const entries of bucket.values()) {
        for (const entry of entries) if (entry.generatorId === allowedGenerator) tokens.add(entry.terms[0]!);
      }
      return [...tokens];
    },
  };
}
