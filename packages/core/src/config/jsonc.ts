import { applyEdits, modify, parse, printParseErrorCode, type ParseError } from 'jsonc-parser';

import type { ProjectConfigV2, TargetConfig } from '../types/config';
import type { ConfigIssue } from '../types/issues';
import { projectSchema, semanticConfigIssues, zodIssues } from './schema';

export interface ParsedProject {
  config: ProjectConfigV2 | null;
  issues: ConfigIssue[];
}

/** 解析 JSONC（允许注释和尾逗号），并返回带行列号的语法错误。 */
export function parseProjectJsonc(raw: string): ParsedProject {
  const errors: ParseError[] = [];
  const value = parse(raw, errors, { allowTrailingComma: true, disallowComments: false });
  const issues: ConfigIssue[] = errors.map((error) => {
    const before = raw.slice(0, error.offset);
    const lines = before.split('\n');
    return {
      severity: 'error',
      code: `jsonc.${printParseErrorCode(error.error)}`,
      message: printParseErrorCode(error.error),
      line: lines.length,
      column: (lines.at(-1)?.length ?? 0) + 1,
    };
  });
  if (issues.length > 0) return { config: null, issues };

  const result = projectSchema.safeParse(value);
  if (!result.success) return { config: null, issues: zodIssues(result.error) };

  const config = result.data as ProjectConfigV2;
  const semantic = semanticConfigIssues(config);
  return { config, issues: semantic };
}

export function getTarget(config: ProjectConfigV2, targetId?: string): TargetConfig {
  const id = targetId ?? config.defaultTarget;
  const target = config.targets.find((item) => item.id === id);
  if (!target) throw new Error(`找不到 target：${id}`);
  return target;
}

/**
 * 用 jsonc-parser.modify 只改目标对象，保留文件里的注释和其他内容。
 * 返回的新 raw 仍需要重新 parse/lint 后再写盘。
 */
export function updateTargetJsonc(
  raw: string,
  targetId: string,
  patch: Partial<Omit<TargetConfig, 'id' | 'format' | 'encoding'>>,
): { raw: string; issues: ConfigIssue[] } {
  const parsed = parseProjectJsonc(raw);
  if (!parsed.config) return { raw, issues: parsed.issues };

  const index = parsed.config.targets.findIndex((target) => target.id === targetId);
  if (index < 0) {
    return {
      raw,
      issues: [{ severity: 'error', code: 'target.missing', message: `找不到 target：${targetId}` }],
    };
  }

  const nextTarget = { ...parsed.config.targets[index], ...patch };
  const updated = applyEdits(
    raw,
    modify(raw, ['targets', index], nextTarget, {
      formattingOptions: { insertSpaces: true, tabSize: 2, eol: '\n' },
    }),
  );
  const reparsed = parseProjectJsonc(updated);
  return { raw: updated, issues: reparsed.issues };
}

export function stringifyProjectConfig(config: ProjectConfigV2): string {
  return `// GregTech6 翻译工程配置（schema v2）\n${JSON.stringify(config, null, 2)}\n`;
}
