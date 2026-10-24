import type { GeneratorConfig, ProjectConfigV2 } from '../types/config';
import type { ConfigIssue, LintReport, ProjectStats } from '../types/issues';

const PLACEHOLDER_RE = /\{(\d+)\}/g;

function placeholders(template: string): number[] {
  PLACEHOLDER_RE.lastIndex = 0;
  const result: number[] = [];
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_RE.exec(template)) !== null) result.push(Number(match[1]));
  return result;
}

/** 判断字面量边界是否是字母数字；用于识别需要 affix 特化的槽位。 */
function isWordBoundary(char: string | undefined): boolean {
  return Boolean(char && /[\p{L}\p{N}]/u.test(char));
}

function splitTemplate(template: string): Array<{ kind: 'lit'; text: string } | { kind: 'slot'; index: number }> {
  const parts: Array<{ kind: 'lit'; text: string } | { kind: 'slot'; index: number }> = [];
  let last = 0;
  PLACEHOLDER_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PLACEHOLDER_RE.exec(template)) !== null) {
    if (match.index > last) parts.push({ kind: 'lit', text: template.slice(last, match.index) });
    parts.push({ kind: 'slot', index: Number(match[1]) });
    last = match.index + match[0].length;
  }
  if (last < template.length) parts.push({ kind: 'lit', text: template.slice(last) });
  return parts;
}

function isAffixTemplate(template: string): boolean {
  const parts = splitTemplate(template);
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index];
    if (part.kind !== 'slot') continue;
    const before = parts[index - 1];
    const after = parts[index + 1];
    if (before?.kind === 'lit' && isWordBoundary(before.text.at(-1))) return true;
    if (after?.kind === 'lit' && isWordBoundary(after.text[0])) return true;
  }
  return false;
}

/** 从 generator 取实际 pair 数：嵌套 dict 按内部 namespace 数量计。 */
function dictPairCount(dict: Record<string, string | Record<string, string>>): number {
  let total = 0;
  for (const value of Object.values(dict)) {
    total += value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value).length : 1;
  }
  return total;
}

/** 组引用图与环检测。 */
function detectCycles(edges: Map<string, Set<string>>): string[][] {
  const cycles = new Map<string, string[]>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  const visit = (group: string) => {
    visiting.add(group);
    stack.push(group);
    for (const next of edges.get(group) ?? []) {
      if (visiting.has(next)) {
        const start = stack.indexOf(next);
        const cycle = stack.slice(start).concat(next);
        const body = cycle.slice(0, -1);
        // 旋转到字典序最小的组名，避免同一环从不同起点重复出现。
        const pivot = body.indexOf([...body].sort()[0] ?? body[0] ?? '');
        const normalized = pivot > 0 ? body.slice(pivot).concat(body.slice(0, pivot)) : body;
        cycles.set(normalized.join('\u0000'), normalized.concat(normalized[0] ?? ''));
      } else if (!visiting.has(next)) {
        // 只沿已存在的组继续，缺少的组由 missingGroups 单独报告。
        visit(next);
      }
    }
    stack.pop();
    visiting.delete(group);
  };

  for (const group of edges.keys()) {
    if (!visiting.has(group)) visit(group);
  }
  return [...cycles.values()];
}

/** 配置结构之外的语义 lint：缺失组、环、槽位、空值、affix 等。 */
export function lintProject(config: ProjectConfigV2): LintReport {
  const issues: ConfigIssue[] = [];
  const groupKinds = new Map<string, Set<'dict' | 'rule'>>();
  const edges = new Map<string, Set<string>>();
  const missingGroups = new Set<string>();
  let dictGenerators = 0;
  let ruleGenerators = 0;
  let ruleTemplates = 0;
  let slotOccurrences = 0;
  let dictEntries = 0;
  let completedGenerators = 0;

  for (const [generatorIndex, generator] of config.generators.entries()) {
    const group = generator.group ?? '';
    if (generator.completed !== false) completedGenerators++;
    if (!groupKinds.has(group)) groupKinds.set(group, new Set());
    if (!edges.has(group)) edges.set(group, new Set());

    if (generator.complete !== undefined) {
      issues.push({
        severity: 'info',
        code: 'legacy.complete-key',
        message: `组 ${group || '<空>'} 使用了 complete（单数）；C++ 只读取 completed，该键会被忽略`,
        path: `generators.${generatorIndex}.complete`,
      });
    }
    if (generator.extensions !== undefined) {
      issues.push({
        severity: 'info',
        code: 'legacy.extensions-key',
        message: `组 ${group || '<空>'} 使用了 extensions（复数）；C++ 只读取 extension（单数），该键会被忽略`,
        path: `generators.${generatorIndex}.extensions`,
      });
    }

    if (generator.dict) {
      dictGenerators++;
      groupKinds.get(group)!.add('dict');
      dictEntries += dictPairCount(generator.dict);
      for (const [key, value] of Object.entries(generator.dict)) {
        if (key.trim() === '') {
          issues.push({
            severity: 'warning',
            code: 'dict.empty-key',
            message: `组 ${group || '<空>'} 存在空 dict key`,
            path: `generators.${generatorIndex}.dict`,
          });
        }
        const values = value !== null && typeof value === 'object' && !Array.isArray(value) ? Object.values(value) : [value];
        if (values.some((item) => item === '')) {
          issues.push({
            severity: 'info',
            code: 'dict.empty-value',
            message: `组 ${group || '<空>'} 的词条 ${JSON.stringify(key)} 有空译文`,
            path: `generators.${generatorIndex}.dict.${key}`,
          });
        }
      }
    }

    if (!generator.rules) continue;
    ruleGenerators++;
    groupKinds.get(group)!.add('rule');
    for (const [ruleIndex, rule] of generator.rules.entries()) {
      ruleTemplates++;
      const sourceSlots = placeholders(rule.s);
      const targetSlots = placeholders(rule.t);
      slotOccurrences += sourceSlots.length;
      const path = `generators.${generatorIndex}.rules.${ruleIndex}`;

      if (rule.s === '') {
        issues.push({
          severity: 'warning',
          code: 'rule.empty-source',
          message: `组 ${group || '<空>'} 的规则 ${ruleIndex} 源模板为空`,
          path: `${path}.s`,
        });
      }

      for (const slot of sourceSlots.concat(targetSlots)) {
        if (slot >= rule.subs.length) {
          issues.push({
            severity: 'error',
            code: 'rule.slot-out-of-range',
            message: `组 ${group || '<空>'} 的规则 ${ruleIndex} 使用了 {${slot}}，但 subs 只有 ${rule.subs.length} 项`,
            path,
          });
        }
      }

      const used = new Set(sourceSlots);
      for (let slot = 0; slot < rule.subs.length; slot++) {
        if (!used.has(slot) && !targetSlots.includes(slot)) {
          issues.push({
            severity: 'warning',
            code: 'rule.unused-sub',
            message: `组 ${group || '<空>'} 的规则 ${ruleIndex} 的 subs[${slot}] 没有被任何模板引用`,
            path: `${path}.subs`,
          });
        }
      }

      if (/\{\d+\}\{\d+\}/.test(rule.s)) {
        issues.push({
          severity: 'info',
          code: 'rule.adjacent-slots',
          message: `组 ${group || '<空>'} 的规则 ${ruleIndex} 有相邻占位符，pattern 编译器会按 token 顺序展开`,
          path: `${path}.s`,
        });
      }

      for (const sub of rule.subs) {
        if (sub.trim() === '') {
          issues.push({
            severity: 'warning',
            code: 'rule.empty-sub',
            message: `组 ${group || '<空>'} 的规则 ${ruleIndex} 引用了空组名`,
            path: `${path}.subs`,
          });
          continue;
        }
        edges.get(group)!.add(sub);
        if (!groupKinds.has(sub)) missingGroups.add(sub);
      }

      if (isAffixTemplate(rule.s)) {
        issues.push({
          severity: 'info',
          code: 'rule.affix',
          message: `组 ${group || '<空>'} 的规则 ${ruleIndex} 是词内拼接（affix），编译期会特化为具体词条`,
          path: `${path}.s`,
        });
      }
    }
  }

  // groupKinds 现在包含全部已声明组；移除边遍历时产生的误报。
  for (const group of groupKinds.keys()) missingGroups.delete(group);
  for (const group of [...edges.keys()]) {
    if (!groupKinds.has(group)) edges.delete(group);
  }

  const mixedGroups = [...groupKinds.entries()].filter(([, kinds]) => kinds.has('dict') && kinds.has('rule')).length;
  const cycles = detectCycles(edges);

  for (const group of [...missingGroups].sort()) {
    issues.push({
      severity: 'error',
      code: 'group.missing',
      message: `规则引用了不存在的组：${group}`,
    });
  }
  for (const cycle of cycles) {
    issues.push({
      severity: 'warning',
      code: 'group.cycle',
      message: `组引用存在环：${cycle.join(' -> ')}`,
    });
  }

  const severityRank: Record<ConfigIssue['severity'], number> = { error: 0, warning: 1, info: 2 };
  issues.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity] || (a.path ?? '').localeCompare(b.path ?? ''),
  );

  const stats: ProjectStats = {
    generatorBlocks: config.generators.length,
    dictGenerators,
    ruleGenerators,
    groups: groupKinds.size,
    ruleTemplates,
    slotOccurrences,
    dictEntries,
    completedGenerators,
    mixedGroups,
    missingGroups: [...missingGroups].sort(),
    cycles,
  };

  return { issues, stats };
}
