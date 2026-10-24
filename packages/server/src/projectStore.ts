import { readFile } from 'node:fs/promises';
import {
  compileConfig,
  convertLegacyYamlToProject,
  DEFAULT_LEGACY_TARGET,
  getTarget,
  lintProject,
  parseProjectJsonc,
  stringifyProjectConfig,
  updateTargetJsonc,
  type CompiledProject,
  type ProjectConfigV2,
  type ProjectSnapshot,
  type SaveProjectResult,
  type TargetConfig,
  type TargetPatch,
  type ProjectStats,
} from '@gt6tg/core';
import { projectFilePath, readTextIfExists, resolveInsideRepo, writeWithBackup } from './paths';

const EMPTY_STATS: ProjectStats = {
  generatorBlocks: 0,
  dictGenerators: 0,
  ruleGenerators: 0,
  groups: 0,
  ruleTemplates: 0,
  slotOccurrences: 0,
  dictEntries: 0,
  completedGenerators: 0,
  mixedGroups: 0,
  missingGroups: [],
  cycles: [],
};

interface SnapshotInternal extends ProjectSnapshot {
  config: ProjectConfigV2 | null;
}

/**
 * 配置的唯一事实来源。
 *
 * - `validate` 只构建快照，不写盘；
 * - `save` 只有在没有 error 级问题时才写盘，并保留备份；
 * - 编译结果按 raw 文本缓存，保存/更新目标后失效。
 */
export class ProjectStore {
  private raw = '';
  private snapshot: SnapshotInternal = {
    raw: '',
    config: null,
    issues: [],
    stats: EMPTY_STATS,
    targets: [],
    activeTargetId: '',
  };
  private compiled: CompiledProject | null = null;
  private compiledRaw = '';

  async load(): Promise<void> {
    const raw = await readTextIfExists(projectFilePath);
    if (raw === null) throw new Error(`找不到配置文件：${projectFilePath}`);
    this.refresh(raw);
    if (!this.snapshot.config) throw new Error('project.jsonc 校验失败，请先修复配置');
  }

  current(): ProjectSnapshot {
    return this.snapshot;
  }

  /** 纯校验，不改变当前已保存状态。 */
  validate(raw: string): ProjectSnapshot {
    return this.buildSnapshot(raw);
  }

  async save(raw: string): Promise<SaveProjectResult> {
    const snapshot = this.buildSnapshot(raw);
    if (snapshot.issues.some((issue) => issue.severity === 'error')) {
      return { ...snapshot, savedAt: new Date().toISOString() };
    }
    const backupPath = await writeWithBackup(projectFilePath, raw);
    this.refresh(raw);
    return {
      ...this.snapshot,
      savedAt: new Date().toISOString(),
      backupPath,
    };
  }

  async updateTarget(raw: string, targetId: string, patch: TargetPatch): Promise<ProjectSnapshot> {
    const updated = updateTargetJsonc(raw, targetId, patch);
    const snapshot = this.buildSnapshot(updated.raw);
    if (snapshot.issues.some((issue) => issue.severity === 'error')) return snapshot;

    await writeWithBackup(projectFilePath, updated.raw);
    this.refresh(updated.raw);
    return this.snapshot;
  }

  async importLegacyConfig(): Promise<ProjectSnapshot> {
    const sourceFile = this.snapshot.config?.legacy?.sourceFile ?? 'packages/legacy/workplace/config.yml';
    const yamlPath = resolveInsideRepo(sourceFile);
    const yamlText = await readFile(yamlPath, 'utf8');
    const currentTarget = this.snapshot.config?.targets[0] ?? DEFAULT_LEGACY_TARGET;
    const nextConfig = convertLegacyYamlToProject(yamlText, { target: currentTarget, sourceFile });
    const nextRaw = stringifyProjectConfig(nextConfig);
    const snapshot = this.buildSnapshot(nextRaw);
    if (snapshot.issues.some((issue) => issue.severity === 'error')) return snapshot;
    await writeWithBackup(projectFilePath, nextRaw);
    this.refresh(nextRaw);
    return this.snapshot;
  }

  getCompiled(): CompiledProject {
    const config = this.snapshot.config;
    if (!config) throw new Error('配置未通过校验，无法编译');
    if (this.compiled && this.compiledRaw === this.raw) return this.compiled;

    this.compiled = compileConfig(config);
    this.compiledRaw = this.raw;
    return this.compiled;
  }

  target(targetId?: string): TargetConfig {
    const config = this.snapshot.config;
    if (!config) throw new Error('配置未通过校验');
    return getTarget(config, targetId);
  }

  private buildSnapshot(raw: string): SnapshotInternal {
    const parsed = parseProjectJsonc(raw);
    if (!parsed.config) {
      return {
        raw,
        config: null,
        issues: parsed.issues,
        stats: EMPTY_STATS,
        targets: [],
        activeTargetId: '',
      };
    }

    const lint = lintProject(parsed.config);
    const issues = [...parsed.issues, ...lint.issues].sort((a, b) => {
      const rank = { error: 0, warning: 1, info: 2 } as const;
      return rank[a.severity] - rank[b.severity] || (a.path ?? '').localeCompare(b.path ?? '');
    });
    return {
      raw,
      config: parsed.config,
      issues,
      stats: lint.stats,
      targets: parsed.config.targets,
      activeTargetId: parsed.config.defaultTarget,
    };
  }

  private refresh(raw: string): void {
    this.raw = raw;
    this.snapshot = this.buildSnapshot(raw);
    this.compiled = null;
    this.compiledRaw = '';
  }
}
