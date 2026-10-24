import type { GeneratorConfig, ProjectConfigV2, RuleDefinition } from '../types/config';
import { tokenize } from './tokenizer';

export interface GeneratorBase {
  id: number;
  group: string;
  namespace: string;
  completed: boolean;
  kind: 'dict' | 'rule';
}

export interface DictGenerator extends GeneratorBase {
  kind: 'dict';
  payload: Array<[source: string, target: string]>;
}

export interface RuleGenerator extends GeneratorBase {
  kind: 'rule';
  payload: RuleDefinition[];
}

export type Generator = DictGenerator | RuleGenerator;

export interface ResolvedEntry {
  s: string;
  t: string;
  ns: string;
  gen: number;
  ri: number;
  combo: number;
  idx: number;
}

export type TemplatePart = string | number;

export interface GeneratorModel {
  gens: Generator[];
  groupIndex: Map<string, number[]>;
  groupArr: string[];
  gidOf: Map<string, number>;
  groupSize(name: string): number;
  resolveGroup(name: string): ResolvedEntry[];
  combineNs(a: string, b: string): string | null;
  betterOrder(a: { gen: number; ri: number; combo: number }, b: { gen: number; ri: number; combo: number }): boolean;
  compileTemplate(template: string): TemplatePart[];
}

/** 把 "{0} Dust" 拆成 [0, " Dust"]；连续占位符也能正确处理。 */
export function compileTemplate(template: string): TemplatePart[] {
  const parts: TemplatePart[] = [];
  const regex = /\{(\d+)\}/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(template)) !== null) {
    if (match.index > last) parts.push(template.slice(last, match.index));
    parts.push(Number(match[1]));
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push(template.slice(last));
  return parts;
}

/** 复刻 C++/原型：一方是另一方前缀时取较长者，否则组合无效。 */
export function combineNamespaces(a: string, b: string): string | null {
  if (!a) return b || '';
  if (!b) return a;
  if (a.length >= b.length) return a.startsWith(b) ? a : null;
  return b.startsWith(a) ? b : null;
}

/** 排序必须用三元组，不能用 float 编码；4× 配置会超过安全整数。 */
export function isBetterOrder(
  a: { gen: number; ri: number; combo: number },
  b: { gen: number; ri: number; combo: number },
): boolean {
  if (a.gen !== b.gen) return a.gen > b.gen;
  if (a.ri !== b.ri) return a.ri > b.ri;
  return a.combo > b.combo;
}

/**
 * 构建生成器模型。
 *
 * 注意：dict 生成器的粒度与原型/C++ 一致——每个 dict key 是一个 generator；
 * 嵌套 dict 的每个内部 namespace 又是一个 generator。规则生成器则是一个块一个 generator。
 */
export function buildModel(config: ProjectConfigV2): GeneratorModel {
  const gens: Generator[] = [];

  const addDict = (group: string, namespace: string, completed: boolean, source: string, target: string) => {
    gens.push({ id: gens.length, group, namespace, completed, kind: 'dict', payload: [[source, target]] });
  };
  const addRules = (group: string, namespace: string, completed: boolean, rules: RuleDefinition[]) => {
    gens.push({ id: gens.length, group, namespace, completed, kind: 'rule', payload: rules });
  };

  for (const block of config.generators) {
    const group = block.group ?? '';
    const namespace = block.namespace ?? '';
    const completed = block.completed !== false;
    // 一个块可以同时有 dict 和 rules；按配置里的键顺序生成，保持 generator 顺序。
    for (const key of Object.keys(block)) {
      if (key === 'dict' && block.dict) {
        for (const [source, rawValue] of Object.entries(block.dict)) {
          if (typeof rawValue === 'string') {
            addDict(group, namespace, completed, source, rawValue);
            continue;
          }
          if (rawValue && typeof rawValue === 'object' && !Array.isArray(rawValue)) {
            for (const [innerNamespace, target] of Object.entries(rawValue)) {
              addDict(group, innerNamespace, completed, source, String(target));
            }
          }
        }
      } else if (key === 'rules' && block.rules) {
        addRules(group, namespace, completed, block.rules);
      }
    }
  }

  const groupIndex = new Map<string, number[]>();
  for (const generator of gens) {
    const list = groupIndex.get(generator.group);
    if (list) list.push(generator.id);
    else groupIndex.set(generator.group, [generator.id]);
  }

  const groupArr = [...groupIndex.keys()];
  const gidOf = new Map<string, number>();
  groupArr.forEach((group, index) => gidOf.set(group, index));

  const sizeMemo = new Map<string, number>();
  const computeSize = (name: string): number => {
    const memo = sizeMemo.get(name);
    if (memo !== undefined) return memo;
    sizeMemo.set(name, 0);
    let total = 0;
    for (const id of groupIndex.get(name) ?? []) {
      const generator = gens[id]!;
      if (generator.kind === 'dict') {
        total += generator.payload.length;
        continue;
      }
      for (const rule of generator.payload) {
        if (rule.subs.length === 0) continue;
        let product = 1;
        let valid = true;
        for (const sub of rule.subs) {
          const size = computeSize(sub);
          if (size === 0) {
            valid = false;
            break;
          }
          product *= size;
        }
        if (valid) total += product;
      }
    }
    sizeMemo.set(name, total);
    return total;
  };

  const resolveMemo = new Map<string, ResolvedEntry[]>();
  const resolve = (name: string): ResolvedEntry[] => {
    const memo = resolveMemo.get(name);
    if (memo) return memo;
    const list: ResolvedEntry[] = [];
    // 先放入空数组，遇到环时直接返回空，避免无限递归。
    resolveMemo.set(name, list);

    for (const id of groupIndex.get(name) ?? []) {
      const generator = gens[id]!;
      if (generator.kind === 'dict') {
        let combo = 0;
        for (const [source, target] of generator.payload) {
          list.push({
            s: source,
            t: target,
            ns: generator.namespace,
            gen: generator.id,
            ri: 0,
            combo,
            idx: list.length,
          });
          combo++;
        }
        continue;
      }

      for (const [ri, rule] of generator.payload.entries()) {
        const arrays = rule.subs.map(resolve);
        if (arrays.some((array) => array.length === 0)) continue;
        const srcParts = compileTemplate(rule.s);
        const tgtParts = compileTemplate(rule.t);
        const count = arrays.length;
        const position = new Array<number>(count).fill(0);
        let combo = 0;

        while (true) {
          let namespace = generator.namespace;
          let valid = true;
          for (let slot = 0; slot < count; slot++) {
            const next = combineNamespaces(namespace, arrays[slot]![position[slot]!]!.ns);
            if (next === null) {
              valid = false;
              break;
            }
            namespace = next;
          }
          if (valid) {
            let source = '';
            for (const part of srcParts) source += typeof part === 'number' ? arrays[part]![position[part]!]!.s : part;
            let target = '';
            for (const part of tgtParts) target += typeof part === 'number' ? arrays[part]![position[part]!]!.t : part;
            list.push({ s: source, t: target, ns: namespace, gen: generator.id, ri, combo, idx: list.length });
          }

          combo++;
          let slot = count - 1;
          while (slot >= 0) {
            position[slot]!++;
            if (position[slot]! < arrays[slot]!.length) break;
            position[slot] = 0;
            slot--;
          }
          if (slot < 0) break;
        }
      }
    }
    return list;
  };

  return {
    gens,
    groupIndex,
    groupArr,
    gidOf,
    groupSize: computeSize,
    resolveGroup: resolve,
    combineNs: combineNamespaces,
    betterOrder: isBetterOrder,
    compileTemplate,
  };
}

/** 供 trace/UI 展示：取 generator 的组名和规则源模板。 */
export function generatorLabel(model: GeneratorModel, generatorId: number): string {
  const generator = model.gens[generatorId];
  if (!generator) return `<generator ${generatorId}>`;
  return `${generator.group || '<空>'} (${generator.kind})`;
}

export function ruleLabel(model: GeneratorModel, generatorId: number, ruleIndex: number): string {
  const generator = model.gens[generatorId];
  if (!generator) return `#${generatorId}`;
  const rule = generator.kind === 'rule' ? generator.payload[ruleIndex] : undefined;
  return rule ? `${generator.group || '<空>'}:${ruleIndex} ${rule.s}` : `${generator.group || '<空>'}:${ruleIndex}`;
}

export type { GeneratorConfig, RuleDefinition };
export { tokenize };
