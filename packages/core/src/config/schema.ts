import { z } from 'zod';
import type { ProjectConfigV2 } from '../types/config';
import type { ConfigIssue } from '../types/issues';

const targetSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    format: z.literal('legacy-lang'),
    workplace: z.string().min(1),
    source: z.string().min(1),
    fallback: z.string().min(1),
    output: z.string().min(1),
    unknown: z.string().min(1),
    encoding: z.literal('utf-8'),
    lineEnding: z.enum(['crlf', 'lf']),
    notes: z.string().optional(),
  })
  .strict();

const dictValueSchema = z.union([z.string(), z.record(z.string(), z.string())]);

const ruleDefinitionSchema = z
  .object({
    s: z.string(),
    t: z.string(),
    subs: z.array(z.string()),
  })
  .strict();

/**
 * 旧配置里一个块可以同时有 dict 和 rules（共 10 个），因此这里必须都允许。
 * complete/extensions 是旧配置的笔误键；C++ 不读取它们，这里保留以通过校验并在 lint 中提示。
 */
const generatorSchema = z
  .object({
    group: z.string().optional(),
    namespace: z.string().optional(),
    cached: z.boolean().optional(),
    completed: z.boolean().optional(),
    complete: z.boolean().optional(),
    extensions: z.string().optional(),
    dict: z.record(z.string(), dictValueSchema).optional(),
    rules: z.array(ruleDefinitionSchema).min(1).optional(),
  })
  .strict()
  .refine((generator) => generator.dict !== undefined || generator.rules !== undefined, {
    message: 'generator 必须包含 dict 或 rules',
  });

export const projectSchema = z.object({
  schemaVersion: z.literal(2),
  legacy: z
    .object({
      version: z.union([z.string(), z.number()]).optional(),
      lang: z.string().optional(),
      sourceFile: z.string().optional(),
    })
    .optional(),
  defaultTarget: z.string().min(1),
  targets: z.array(targetSchema).min(1),
  generators: z.array(generatorSchema).min(1),
});

/** 把 zod 的路径/消息转换成控制台可展示的 ConfigIssue。 */
export function zodIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.map((issue) => ({
    severity: 'error',
    code: `schema.${issue.code}`,
    message: issue.message,
    path: issue.path.length ? issue.path.join('.') : undefined,
  }));
}

/** 结构之外的语义检查：target id 唯一、defaultTarget 必须存在。 */
export function semanticConfigIssues(config: ProjectConfigV2): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const ids = new Set<string>();
  for (const [index, target] of config.targets.entries()) {
    if (ids.has(target.id)) {
      issues.push({
        severity: 'error',
        code: 'target.duplicate-id',
        message: `target id 重复：${target.id}`,
        path: `targets.${index}.id`,
      });
    }
    ids.add(target.id);
  }
  if (!ids.has(config.defaultTarget)) {
    issues.push({
      severity: 'error',
      code: 'target.default-missing',
      message: `defaultTarget 指向不存在的 target：${config.defaultTarget}`,
      path: 'defaultTarget',
    });
  }
  return issues;
}
