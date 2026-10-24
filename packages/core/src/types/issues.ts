/** 配置检查与 lint 共用的诊断类型。 */

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface ConfigIssue {
  severity: IssueSeverity;
  /** 稳定错误码，便于前端分组和测试断言。 */
  code: string;
  message: string;
  /** 例如 generators[3].rules[0].s */
  path?: string;
  /** JSONC 解析错误才有行/列（1-based）。 */
  line?: number;
  column?: number;
}

export interface ProjectStats {
  generatorBlocks: number;
  dictGenerators: number;
  ruleGenerators: number;
  groups: number;
  ruleTemplates: number;
  slotOccurrences: number;
  dictEntries: number;
  completedGenerators: number;
  mixedGroups: number;
  missingGroups: string[];
  cycles: string[][];
}

export interface LintReport {
  issues: ConfigIssue[];
  stats: ProjectStats;
}
