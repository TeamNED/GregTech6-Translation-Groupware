import {
  buildFallbackMap,
  compileConfig,
  parseProjectJsonc,
  testEntry as coreTestEntry,
  type CompileStats,
  type CompiledProject,
  type ConfigIssue,
  type EntryTestResult,
  type LangEntry,
  type MemorySnapshot,
  type TimingReport,
} from '@gt6tg/core';
import type { Clock } from './clock';
import { systemClock } from './clock';
import type { CompileCacheEntry } from './compile-cache';
import { CompileCache, compileIdForConfig } from './compile-cache';
import type { HashProvider } from './hash';
import { hashOutput } from './hash';
import { emitRuntimeHook, type RuntimeHooks } from './hooks';
import { JobRunner, type JobProgress, type JobScope } from './job';
import type { RunResult } from './run-summary';

export interface EngineHostOptions {
  hash: HashProvider;
  clock?: Clock;
  maxCompiles?: number;
  nextJobId?: () => string;
  hooks?: RuntimeHooks;
  memory?: () => MemorySnapshot;
}

export interface CompileResult {
  compileId: string;
  stats: CompileStats;
  timings: TimingReport;
  cached: boolean;
}

export interface RunOptions {
  compileId: string;
  sourceEntries: readonly LangEntry[];
  fallbackEntries?: readonly LangEntry[];
  scope?: JobScope;
  includeCandidates?: boolean;
  jobId?: string;
  onProgress?: (progress: JobProgress) => void;
}

export interface TestEntryOptions {
  compileId: string;
  targetId?: string;
  key: string;
  value?: string;
  sourceEntries?: readonly LangEntry[];
  fallbackEntries?: readonly LangEntry[];
  issues?: ConfigIssue[];
}

export interface MetricsSnapshot {
  compileCacheSize: number;
  compileIds: string[];
  memory?: MemorySnapshot;
}

export class RuntimeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'RuntimeError';
  }
}

/**
 * 同构引擎宿主：编译缓存、任务入口、单条测试。
 * 不接触文件系统、DOM 或 Node API；所有 IO 由上层宿主提供。
 */
export class EngineHost {
  private readonly cache: CompileCache;
  private readonly hash: HashProvider;
  private readonly clock: Clock;
  private readonly nextJobId: () => string;
  private readonly hooks: RuntimeHooks | undefined;
  private readonly memory: (() => MemorySnapshot) | undefined;
  private jobCounter = 0;

  constructor(options: EngineHostOptions) {
    this.hash = options.hash;
    this.clock = options.clock ?? systemClock;
    this.cache = new CompileCache(options.maxCompiles ?? 2);
    this.nextJobId = options.nextJobId ?? (() => `job-${++this.jobCounter}`);
    this.hooks = options.hooks;
    this.memory = options.memory;
  }

  compile(configText: string): CompileResult {
    const compileId = compileIdForConfig(configText);
    const cached = this.cache.get(compileId, this.clock.now());
    if (cached) {
      emitRuntimeHook(this.hooks, 'compile:finished', {
        stats: cached.stats,
        timings: cached.timings,
        cached: true,
      });
      return {
        compileId,
        stats: cached.stats,
        timings: cached.timings,
        cached: true,
      };
    }

    const parsed = parseProjectJsonc(configText);
    emitRuntimeHook(this.hooks, 'config:parsed', { issues: parsed.issues });
    if (!parsed.config) {
      throw new RuntimeError('config-invalid', '配置校验失败', parsed.issues);
    }

    emitRuntimeHook(this.hooks, 'compile:started', {
      generatorBlocks: parsed.config.generators.length,
    });
    const compiled = compileConfig(parsed.config);
    const timings = compiled.timings ?? {
      label: 'compile',
      totalMs: 0,
      phases: [],
    };
    const entry: CompileCacheEntry = {
      compileId,
      compiled,
      stats: compiled.stats,
      timings,
      lastUsed: this.clock.now(),
    };
    this.cache.set(entry);

    emitRuntimeHook(this.hooks, 'compile:finished', {
      stats: compiled.stats,
      timings,
      cached: false,
    });

    return {
      compileId,
      stats: compiled.stats,
      timings,
      cached: false,
    };
  }

  getCompiled(compileId: string): CompiledProject {
    const entry = this.cache.get(compileId, this.clock.now());
    if (!entry) {
      throw new RuntimeError('unknown-compile', `找不到编译结果：${compileId}`);
    }
    return entry.compiled;
  }

  hasCompiled(compileId: string): boolean {
    return this.cache.peek(compileId) !== undefined;
  }

  clearCache(): void {
    this.cache.clear();
  }

  async run(options: RunOptions): Promise<RunResult> {
    const compiled = this.getCompiled(options.compileId);
    const runner = new JobRunner();
    const jobId = options.jobId ?? this.nextJobId();
    const scope = options.scope?.kind ?? 'all';
    const total = options.scope?.kind === 'keys' ? options.scope.keys.length : options.sourceEntries.length;

    emitRuntimeHook(this.hooks, 'job:started', {
      jobId,
      compileId: options.compileId,
      scope,
      total,
    });

    try {
      const result = await runner.run({
        jobId,
        compileId: options.compileId,
        compiled,
        sourceEntries: options.sourceEntries,
        fallbackEntries: options.fallbackEntries,
        scope: options.scope,
        includeCandidates: options.includeCandidates,
        hash: this.hash,
        clock: this.clock,
        onProgress: (progress) => {
          emitRuntimeHook(this.hooks, 'job:progress', progress);
          options.onProgress?.(progress);
        },
      });
      emitRuntimeHook(this.hooks, 'job:finished', { jobId, summary: result.summary });
      return result;
    } catch (error) {
      emitRuntimeHook(this.hooks, 'job:failed', {
        jobId,
        message: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  testEntry(options: TestEntryOptions): EntryTestResult {
    const compiled = this.getCompiled(options.compileId);
    const value = options.value ?? options.sourceEntries?.find((entry) => entry.key === options.key)?.value;
    if (value === undefined) {
      throw new RuntimeError('entry-value-missing', `找不到 key 的英文值：${options.key}`);
    }

    const fallbackMap = buildFallbackMap([...(options.fallbackEntries ?? [])]);
    const result = coreTestEntry(compiled, options.key, value, fallbackMap, options.issues ?? []);
    if (options.targetId) result.targetId = options.targetId;
    emitRuntimeHook(this.hooks, 'entry:tested', {
      key: options.key,
      targetId: result.targetId || undefined,
      unknown: result.unknown,
    });
    return result;
  }

  hashOutput(output: ReadonlyMap<string, string>): Promise<string> {
    return hashOutput(this.hash, output);
  }

  metrics(): MetricsSnapshot {
    return {
      compileCacheSize: this.cache.size,
      compileIds: this.cache.ids(),
      memory: this.memory?.(),
    };
  }
}
