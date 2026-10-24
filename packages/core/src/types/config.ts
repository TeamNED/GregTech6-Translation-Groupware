/**
 * JSONC v2 工程配置模型。
 *
 * 设计原则：
 * - `generators` 与旧 config.yml 语义保持一致，避免迁移时改变译文；
 * - `targets` 只描述“输入/输出文件在哪里”，算法不直接接触文件系统；
 * - 路径均写相对于仓库根目录的路径，服务端负责解析和越界校验。
 */

export const SCHEMA_VERSION = 2 as const;
export type SchemaVersion = typeof SCHEMA_VERSION;

export type LineEnding = 'crlf' | 'lf';

export interface TargetConfig {
  /** 目标稳定 id，例如 gt6-legacy。 */
  id: string;
  /** 控制台展示名称。 */
  label: string;
  /** 目前只实现旧版 .lang；GT6W JSON 作为后续 target。 */
  format: 'legacy-lang';
  /** 相对于仓库根目录的 workplace 目录。 */
  workplace: string;
  /** 以下四个路径都相对于 workplace。 */
  source: string;
  fallback: string;
  output: string;
  unknown: string;
  encoding: 'utf-8';
  lineEnding: LineEnding;
  notes?: string;
}

/** 旧配置的元信息，仅用于追溯，不参与算法。 */
export interface LegacyMeta {
  version?: string | number;
  lang?: string;
  sourceFile?: string;
}

export interface RuleDefinition {
  /** 源模板，例如 "Crate of {0}"。 */
  s: string;
  /** 译文模板，例如 "{0}板条箱"。 */
  t: string;
  /** 占位符 {n} 对应的组名。 */
  subs: string[];
}

/**
 * 一个 generator 块可以同时包含 dict 和 rules；旧配置里确实存在 10 个这样的块。
 * 这里不拆成 union，否则会丢掉其中一半。
 */
export interface GeneratorConfig {
  group?: string;
  namespace?: string;
  cached?: boolean;
  completed?: boolean;
  /** 旧配置笔误：C++ 只读取 completed，complete 会被忽略。 */
  complete?: boolean;
  /** 旧配置笔误：C++ 只读取 extension（单数），extensions 会被忽略。 */
  extensions?: string;
  /** 普通词条是 string；嵌套 dict 表示同一英文词在不同 namespace 下的译文。 */
  dict?: Record<string, string | Record<string, string>>;
  rules?: RuleDefinition[];
}

export type DictGeneratorConfig = GeneratorConfig & { dict: Record<string, string | Record<string, string>> };
export type RuleGeneratorConfig = GeneratorConfig & { rules: RuleDefinition[] };

export interface ProjectConfigV2 {
  schemaVersion: SchemaVersion;
  legacy?: LegacyMeta;
  defaultTarget: string;
  targets: TargetConfig[];
  generators: GeneratorConfig[];
}

export function isDictGenerator(generator: GeneratorConfig): generator is DictGeneratorConfig {
  return 'dict' in generator;
}

export function isRuleGenerator(generator: GeneratorConfig): generator is RuleGeneratorConfig {
  return 'rules' in generator;
}
