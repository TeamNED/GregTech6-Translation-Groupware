import {
  diffLangMaps,
  parseLegacyLang,
  type CompileStats,
  type GenerateResult,
  type ProjectSnapshot,
  type ProjectStats,
  type SaveProjectResult,
  type ServerMethodName,
  type ServerParams,
  type ServerResult,
  type TargetConfig,
  type TargetPatch,
  type TimingReport,
} from '@gt6tg/core';
import type { CompareResult, DirectClient, RunSummary } from '@gt6tg/runtime';
import { defaultConfigText } from '../default-config';
import type { ConnectionStatus } from '../rpc/client';
import { createBrowserEngine, type BrowserEngine } from './browser-client';
import { downloadText } from './download';
import { browserMemory } from './memory';
import { buildBrowserIoReport } from './report';
import type { BackendCapabilities, ConsoleBackend, FileRole, FileSlot, HistoryEntry, ProgressInfo } from './types';

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

interface StoredRun extends HistoryEntry {
  outputText: string;
  unknownText: string;
}

interface CompiledState {
  compileId: string;
  stats: CompileStats;
  timings: TimingReport;
}

/** 浏览器 REPL：Worker 跑算法，文件/配置全部在内存。 */
export class BrowserBackend implements ConsoleBackend {
  readonly mode = 'repl' as const;
  readonly capabilities: BackendCapabilities = {
    saveConfig: true,
    importLegacy: false,
    updateTarget: true,
    writeDist: false,
    upload: true,
    download: true,
    history: true,
  };

  private engine: BrowserEngine | null = null;
  private client: DirectClient | null = null;
  private statusListener: ((status: ConnectionStatus) => void) | undefined;
  private readonly progressListeners = new Set<(progress: ProgressInfo) => void>();

  private raw = defaultConfigText;
  private snapshot: ProjectSnapshot | null = null;
  private compiled: CompiledState | null = null;
  private compiledRaw = '';
  private readonly virtualFiles: Partial<Record<FileRole, { text: string; name: string }>> = {};
  private outputText: string | undefined;
  private unknownText: string | undefined;
  private unknownKeys: string[] = [];
  private readonly runs: StoredRun[] = [];
  private maxHistory = 3;
  private activeToken: symbol | null = null;

  connect(onStatus: (status: ConnectionStatus) => void): void {
    this.statusListener = onStatus;
    onStatus('connecting');
    void this.initialize();
  }

  async call<Method extends ServerMethodName>(
    method: Method,
    ...params: ServerParams<Method>
  ): Promise<ServerResult<Method>> {
    switch (method) {
      case 'getProject':
        return (await this.project()) as ServerResult<Method>;
      case 'validateProject':
        return (await this.buildSnapshot(params[0] as string)) as ServerResult<Method>;
      case 'saveProject':
        return (await this.saveProject(params[0] as string)) as ServerResult<Method>;
      case 'updateTarget':
        return (await this.updateTarget(
          params[0] as string,
          params[1] as string,
          params[2] as TargetPatch,
        )) as ServerResult<Method>;
      case 'checkIo':
        return (await this.checkIo(params[0] as string)) as ServerResult<Method>;
      case 'generate':
        return (await this.generate(params[0] as string, params[2] as boolean | undefined)) as ServerResult<Method>;
      case 'testEntry':
        return (await this.testEntry(
          params[0] as string,
          params[1] as string,
          params[2] as string | undefined,
        )) as ServerResult<Method>;
      case 'importLegacyConfig':
        throw new Error('浏览器 REPL 不支持导入 legacy config.yml');
      default:
        throw new Error(`浏览器 REPL 不支持方法：${method}`);
    }
  }

  setText(role: FileRole, text: string, name?: string): void {
    this.virtualFiles[role] = {
      text,
      name: name ?? this.defaultFileName(role),
    };
    this.outputText = undefined;
    this.unknownText = undefined;
    this.unknownKeys = [];
  }

  clearFile(role: FileRole): void {
    delete this.virtualFiles[role];
    this.outputText = undefined;
    this.unknownText = undefined;
    this.unknownKeys = [];
  }

  files(): Record<FileRole, FileSlot | undefined> {
    const result = {} as Record<FileRole, FileSlot | undefined>;
    for (const role of ['source', 'fallback', 'golden', 'goldenUnknown'] as const) {
      const file = this.virtualFiles[role];
      result[role] = file ? { name: file.name, size: new TextEncoder().encode(file.text).length } : undefined;
    }
    return result;
  }

  download(kind: 'output' | 'unknown'): void {
    const text = kind === 'output' ? this.outputText : this.unknownText;
    if (text === undefined) throw new Error('还没有生成结果');
    downloadText(kind === 'output' ? this.outputFileName() : this.unknownFileName(), text);
  }

  async exportConfig(): Promise<void> {
    downloadText('project.jsonc', this.raw);
  }

  async resetConfig(): Promise<void> {
    this.raw = defaultConfigText;
    this.snapshot = null;
    this.clearCompiled();
    await this.project();
  }

  history(): HistoryEntry[] {
    return this.runs.map(({ id, createdAt, summary }) => ({ id, createdAt, summary }));
  }

  setHistoryLimit(limit: number): void {
    this.maxHistory = Math.max(1, Math.min(10, Math.trunc(limit)));
    this.runs.splice(this.maxHistory);
  }

  async compareCurrent(mode: 'golden' | 'run'): Promise<CompareResult> {
    let left: string | undefined;
    let right: string | undefined;

    if (mode === 'golden') {
      left = this.getText('golden');
      right = this.outputText;
    } else {
      left = this.runs[1]?.outputText;
      right = this.runs[0]?.outputText;
    }

    if (left === undefined || right === undefined) {
      throw new Error(mode === 'golden' ? '需要先上传 golden 并运行一次' : '至少需要两次运行历史');
    }

    return this.requireClient().request('result.compare', { left, right, mode });
  }

  cancel(): void {
    this.activeToken = null;
    this.engine?.terminate();
    this.engine = null;
    this.client = null;
    this.clearCompiled();
    this.emitProgress({ phase: 'cancelled', processed: 0, total: 0 });
  }

  onProgress(listener: (progress: ProgressInfo) => void): () => void {
    this.progressListeners.add(listener);
    return () => this.progressListeners.delete(listener);
  }

  private async initialize(): Promise<void> {
    try {
      await this.project();
      this.statusListener?.('open');
    } catch (error) {
      this.statusListener?.('closed');
      console.error('[repl] 初始化失败', error);
    }
  }

  private ensureClient(): DirectClient {
    if (this.client) return this.client;
    const engine = createBrowserEngine();
    const client = engine.client;
    client.onEvent((event) => {
      if (event.event === 'job.progress') {
        this.emitProgress(event.payload);
      } else if (event.event === 'job.done') {
        this.emitProgress({
          phase: 'done',
          processed: event.payload.summary.processed,
          total: event.payload.summary.processed,
        });
      } else if (event.event === 'job.error') {
        this.emitProgress({ phase: 'error', processed: 0, total: 0 });
      }
    });
    this.engine = engine;
    this.client = client;
    return client;
  }

  private requireClient(): DirectClient {
    return this.ensureClient();
  }

  private async project(): Promise<ProjectSnapshot> {
    if (!this.snapshot) this.snapshot = await this.buildSnapshot(this.raw);
    return this.snapshot;
  }

  private async buildSnapshot(raw: string): Promise<ProjectSnapshot> {
    const client = this.requireClient();
    const parsed = await client.request('config.parse', { text: raw });
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

    const lint = await client.request('config.lint', { text: raw });
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

  private async saveProject(raw: string): Promise<SaveProjectResult> {
    const snapshot = await this.buildSnapshot(raw);
    const savedAt = new Date().toISOString();
    if (snapshot.issues.some((issue) => issue.severity === 'error')) {
      return { ...snapshot, savedAt };
    }
    this.raw = raw;
    this.snapshot = snapshot;
    this.clearCompiled();
    return { ...snapshot, savedAt };
  }

  private async updateTarget(raw: string, targetId: string, patch: TargetPatch): Promise<ProjectSnapshot> {
    const client = this.requireClient();
    const updated = await client.request('config.updateTarget', { raw, targetId, patch });
    const snapshot = await this.buildSnapshot(updated.raw);
    if (snapshot.issues.some((issue) => issue.severity === 'error')) return snapshot;
    this.raw = updated.raw;
    this.snapshot = snapshot;
    this.clearCompiled();
    return snapshot;
  }

  private async checkIo(targetId: string) {
    const { run, target, compiled } = await this.execute(targetId);
    return buildBrowserIoReport({
      target,
      sourceText: this.getText('source'),
      fallbackText: this.getText('fallback'),
      goldenText: this.getText('golden'),
      goldenUnknownText: this.getText('goldenUnknown'),
      outputText: run.outputText,
      unknownText: run.unknownText,
      unknownKeys: run.unknownKeys,
      summary: run.summary,
      compileTimings: compiled.timings,
      readMs: 0,
      compileMs: compiled.timings.totalMs,
      generateMs: run.summary.timings.totalMs,
      memory: browserMemory(),
    });
  }

  private async generate(targetId: string, includeOutput = false): Promise<GenerateResult> {
    const { run, target, compiled } = await this.execute(targetId);
    this.recordHistory(run);

    const output = parseLegacyLang(run.outputText);
    const unknown = parseLegacyLang(run.unknownText);
    const goldenText = this.getText('golden');
    const golden = goldenText === undefined ? undefined : parseLegacyLang(goldenText);
    const diffVsCurrent = diffLangMaps(golden?.map ?? new Map(), output.map);

    return {
      targetId: target.id,
      dryRun: true,
      durationMs: Math.round(run.summary.timings.totalMs),
      timings: {
        totalMs: compiled.timings.totalMs + run.summary.timings.totalMs,
        readMs: 0,
        compileMs: compiled.timings.totalMs,
        generateMs: run.summary.timings.totalMs,
        diffMs: 0,
        compile: compiled.timings,
        generate: run.summary.timings,
      },
      sourceKeys: run.summary.stats.sourceKeys,
      outputKeys: run.summary.stats.outputKeys,
      unknownKeys: run.summary.stats.unknownKeys,
      sameAsEnglish: run.summary.stats.sameAsEnglish,
      conflictKeys: run.summary.stats.conflictKeys,
      hash: run.summary.hash,
      diffVsCurrent,
      output: includeOutput ? Object.fromEntries(output.map) : undefined,
      unknown: includeOutput ? Object.fromEntries(unknown.map) : undefined,
    };
  }

  private async testEntry(targetId: string, key: string, value?: string) {
    const snapshot = await this.project();
    const target = this.targetOf(snapshot, targetId);
    const compiled = await this.ensureCompiled();
    return this.requireClient().request('entry.test', {
      compileId: compiled.compileId,
      targetId: target.id,
      key,
      value,
      sourceText: this.getText('source'),
      fallbackText: this.getText('fallback'),
      issues: snapshot.issues,
    });
  }

  private async execute(targetId: string) {
    const sourceText = this.getText('source');
    if (sourceText === undefined) {
      throw new Error('请先在“文件 / 历史”页上传源语言文件');
    }
    if (this.activeToken) {
      this.cancel();
    }

    const token = Symbol('run');
    this.activeToken = token;
    try {
      const snapshot = await this.project();
      const target = this.targetOf(snapshot, targetId);
      const compiled = await this.ensureCompiled();
      const run = await this.requireClient().request('job.start', {
        compileId: compiled.compileId,
        sourceText,
        fallbackText: this.getText('fallback'),
        lineEnding: target.lineEnding,
        scope: 'all',
      });
      this.outputText = run.outputText;
      this.unknownText = run.unknownText;
      this.unknownKeys = run.unknownKeys;
      return { run, target, compiled };
    } finally {
      if (this.activeToken === token) this.activeToken = null;
    }
  }

  private targetOf(snapshot: ProjectSnapshot, targetId: string): TargetConfig {
    const target = snapshot.targets.find((item) => item.id === targetId) ?? snapshot.targets[0];
    if (!target) throw new Error('当前配置没有可用的 target');
    return target;
  }

  private async ensureCompiled(): Promise<CompiledState> {
    if (this.compiled && this.compiledRaw === this.raw) return this.compiled;
    const result = await this.requireClient().request('engine.compile', { text: this.raw });
    this.compiled = {
      compileId: result.compileId,
      stats: result.stats,
      timings: result.timings,
    };
    this.compiledRaw = this.raw;
    return this.compiled;
  }

  private clearCompiled(): void {
    this.compiled = null;
    this.compiledRaw = '';
  }

  private recordHistory(run: { summary: RunSummary; outputText: string; unknownText: string }): void {
    this.runs.unshift({
      id: run.summary.jobId,
      createdAt: new Date().toISOString(),
      summary: run.summary,
      outputText: run.outputText,
      unknownText: run.unknownText,
    });
    this.runs.splice(this.maxHistory);
  }

  private getText(role: FileRole): string | undefined {
    return this.virtualFiles[role]?.text;
  }

  private defaultFileName(role: FileRole): string {
    const target = this.snapshot?.targets.find((item) => item.id === this.snapshot?.activeTargetId);
    const paths: Record<FileRole, string | undefined> = {
      source: target?.source,
      fallback: target?.fallback,
      golden: target?.output,
      goldenUnknown: target?.unknown,
    };
    return paths[role] ?? `${role}.lang`;
  }

  private outputFileName(): string {
    return this.fileNameFromTarget('output');
  }

  private unknownFileName(): string {
    return this.fileNameFromTarget('unknown');
  }

  private fileNameFromTarget(field: 'output' | 'unknown'): string {
    const target = this.snapshot?.targets[0];
    const path = target?.[field];
    return path ? basename(path) : `GregTech.${field}.lang`;
  }

  private emitProgress(progress: ProgressInfo): void {
    for (const listener of this.progressListeners) listener(progress);
  }
}

function basename(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}
