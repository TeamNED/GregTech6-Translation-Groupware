import { parse } from 'yaml';
import type { GeneratorConfig, ProjectConfigV2, TargetConfig } from '../types/config';

export const DEFAULT_LEGACY_TARGET: TargetConfig = {
  id: 'gt6-legacy',
  label: 'GT6 1.7.10 原版',
  format: 'legacy-lang',
  workplace: 'packages/legacy/workplace',
  source: 'en/GregTech.lang',
  fallback: 'zh/GregTech.fallback.lang',
  output: 'zh/GregTech.lang',
  unknown: 'zh/GregTech.unknown.lang',
  encoding: 'utf-8',
  lineEnding: 'crlf',
  notes: '当前只支持单 GT6 原版目标；workplace/config.yml 保持只读。',
};

export interface ImportLegacyOptions {
  target?: TargetConfig;
  sourceFile?: string;
}

/**
 * 把旧 config.yml 转成 JSONC v2 的 ProjectConfigV2。
 *
 * 这里只做结构转换，不做语义校验；调用方应再走 parse/validate/lint。
 */
export function convertLegacyYamlToProject(yamlText: string, options: ImportLegacyOptions = {}): ProjectConfigV2 {
  const document = parse(yamlText) as {
    version?: string | number;
    lang?: string;
    generators?: GeneratorConfig[];
  } | null;

  if (!document || typeof document !== 'object' || !Array.isArray(document.generators)) {
    throw new Error('legacy config.yml 缺少 generators 数组');
  }

  const target = options.target ?? DEFAULT_LEGACY_TARGET;
  return {
    schemaVersion: 2,
    legacy: {
      version: document.version,
      lang: document.lang,
      sourceFile: options.sourceFile ?? 'packages/legacy/workplace/config.yml',
    },
    defaultTarget: target.id,
    targets: [target],
    generators: document.generators,
  };
}
