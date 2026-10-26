import {
  diffLangMaps,
  lintProject,
  parseLegacyLang,
  parseProjectJsonc,
  updateTargetJsonc,
  type ConfigIssue,
  type EntryTestResult,
  type LintReport,
  type TargetPatch,
} from '@gt6tg/core';
import { buildArtifactTexts } from './artifacts';
import type { EngineHost } from './host';
import { RuntimeError } from './host';
import type {
  CompareParams,
  CoreEvent,
  CoreEventMap,
  JobExportParams,
  JobStartParams,
  JobStartResult,
  JobStatus,
  TestEntryParams,
} from './protocol';
import type { RunSummary } from './run-summary';

export interface RuntimeDispatcher {
  handle(method: string, params: unknown): Promise<unknown>;
}

interface JobRecord {
  state: 'running' | 'done' | 'error';
  processed: number;
  total: number;
  summary?: RunSummary;
  outputText?: string;
  unknownText?: string;
  error?: string;
}

const MAX_RETAINED_JOBS = 1;

/**
 * 环境无关的协议分发器：Node worker_threads 和浏览器 Worker 共用。
 * 文件读写、hash/clock 由宿主在 EngineHost 构造时注入。
 */
export function createRuntimeDispatcher(host: EngineHost, emit: (event: CoreEvent) => void): RuntimeDispatcher {
  const jobs = new Map<string, JobRecord>();
  let jobCounter = 0;
  let activeJobId: string | null = null;

  function pruneJobs(): void {
    while (jobs.size > MAX_RETAINED_JOBS) {
      const oldest = jobs.keys().next().value;
      if (oldest === undefined) return;
      jobs.delete(oldest);
    }
  }

  function emitEvent<K extends keyof CoreEventMap>(event: K, payload: CoreEventMap[K]): void {
    emit({ type: 'event', event, payload } as CoreEvent);
  }

  function parseConfig(params: { text: string }) {
    return parseProjectJsonc(params.text);
  }

  function lintConfig(params: { text: string }): LintReport {
    const parsed = parseConfig(params);
    if (!parsed.config) {
      throw new RuntimeError('config-invalid', '配置校验失败', parsed.issues);
    }
    return lintProject(parsed.config);
  }

  async function startJob(params: JobStartParams): Promise<JobStartResult> {
    if (activeJobId) {
      throw new RuntimeError('job-busy', '已有任务在运行；请先终止当前任务');
    }

    const source = parseLegacyLang(params.sourceText);
    const fallback = params.fallbackText ? parseLegacyLang(params.fallbackText) : undefined;
    const jobId = `job-${Date.now().toString(36)}-${++jobCounter}`;
    activeJobId = jobId;
    const record: JobRecord = {
      state: 'running',
      processed: 0,
      total: params.scope === 'keys' ? (params.keys?.length ?? 0) : source.entries.length,
    };
    jobs.set(jobId, record);
    pruneJobs();

    try {
      const result = await host.run({
        jobId,
        compileId: params.compileId,
        sourceEntries: source.entries,
        fallbackEntries: fallback?.entries,
        scope: params.scope === 'keys' ? { kind: 'keys', keys: params.keys ?? [] } : { kind: 'all' },
        onProgress: (progress) => {
          record.processed = progress.processed;
          record.total = progress.total;
          emitEvent('job.progress', progress);
        },
      });

      const artifacts =
        params.includeArtifacts === false
          ? { output: '', unknown: '' }
          : buildArtifactTexts(source.entries, result, params.lineEnding);
      record.state = 'done';
      record.summary = result.summary;
      record.outputText = artifacts.output;
      record.unknownText = artifacts.unknown;
      emitEvent('job.done', { jobId, summary: result.summary });

      return {
        jobId,
        summary: result.summary,
        outputText: artifacts.output,
        unknownText: artifacts.unknown,
        unknownKeys: [...result.unknown],
      };
    } catch (error) {
      record.state = 'error';
      record.error = error instanceof Error ? error.message : String(error);
      emitEvent('job.error', { jobId, message: record.error });
      throw error;
    } finally {
      if (activeJobId === jobId) activeJobId = null;
    }
  }

  function jobStatus(jobId: string): JobStatus {
    const record = jobs.get(jobId);
    if (!record) throw new RuntimeError('unknown-job', `找不到任务：${jobId}`);
    return {
      jobId,
      state: record.state,
      processed: record.processed,
      total: record.total,
      summary: record.summary,
      error: record.error,
    };
  }

  function exportJob(params: JobExportParams): { text: string } {
    const record = jobs.get(params.jobId);
    if (!record) throw new RuntimeError('unknown-job', `找不到任务：${params.jobId}`);
    const text = params.kind === 'output' ? record.outputText : record.unknownText;
    if (text === undefined) {
      throw new RuntimeError('job-not-ready', `任务尚未完成：${params.jobId}`);
    }
    return { text };
  }

  function testEntry(params: TestEntryParams): EntryTestResult {
    const source = params.sourceText ? parseLegacyLang(params.sourceText) : undefined;
    const fallback = params.fallbackText ? parseLegacyLang(params.fallbackText) : undefined;
    return host.testEntry({
      compileId: params.compileId,
      targetId: params.targetId,
      key: params.key,
      value: params.value,
      sourceEntries: source?.entries,
      fallbackEntries: fallback?.entries,
      issues: params.issues as ConfigIssue[] | undefined,
    });
  }

  function compare(params: CompareParams) {
    const left = parseLegacyLang(params.left);
    const right = parseLegacyLang(params.right);
    const diff = diffLangMaps(left.map, right.map);
    return {
      compared: diff.compared,
      same: diff.same,
      changed: diff.changed,
      added: diff.added,
      removed: diff.removed,
      samples: diff.samples.map((sample) => ({
        key: sample.key,
        left: sample.expected,
        right: sample.actual,
      })),
    };
  }

  return {
    async handle(method: string, params: unknown): Promise<unknown> {
      switch (method) {
        case 'config.parse':
          return parseConfig(params as { text: string });
        case 'config.lint':
          return lintConfig(params as { text: string });
        case 'config.updateTarget': {
          const { raw, targetId, patch } = params as {
            raw: string;
            targetId: string;
            patch: TargetPatch;
          };
          return updateTargetJsonc(raw, targetId, patch);
        }
        case 'engine.compile': {
          const result = host.compile((params as { text: string }).text);
          emitEvent('engine.compiled', {
            compileId: result.compileId,
            stats: result.stats,
            timings: result.timings,
          });
          return result;
        }
        case 'job.start':
          return startJob(params as JobStartParams);
        case 'job.status':
          return jobStatus((params as { jobId: string }).jobId);
        case 'job.export':
          return exportJob(params as JobExportParams);
        case 'entry.test':
          return testEntry(params as TestEntryParams);
        case 'result.compare':
          return compare(params as CompareParams);
        case 'metrics.snapshot':
          return host.metrics();
        default:
          throw new RuntimeError('unknown-method', `未知方法：${method}`);
      }
    },
  };
}
