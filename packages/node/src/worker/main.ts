import { parentPort } from 'node:worker_threads';
import {
  diffLangMaps,
  lintProject,
  parseLegacyLang,
  parseProjectJsonc,
  type ConfigIssue,
  type EntryTestResult,
  type LintReport,
} from '@gt6tg/core';
import {
  buildArtifactTexts,
  EngineHost,
  RuntimeError,
  type CompileResult,
  type CoreEvent,
  type CoreEventMap,
  type CoreRequest,
  type CoreResponse,
  type JobExportParams,
  type JobStartParams,
  type JobStartResult,
  type JobStatus,
  type RunSummary,
  type TestEntryParams,
} from '@gt6tg/runtime';
import { nodeHashProvider } from '../hash';

if (!parentPort) {
  throw new Error('worker/main.ts 必须在 worker_threads 中运行');
}

const port = parentPort;
const host = new EngineHost({ hash: nodeHashProvider });
const jobs = new Map<string, JobRecord>();
let jobCounter = 0;
const MAX_RETAINED_JOBS = 3;

function pruneJobs(): void {
  while (jobs.size > MAX_RETAINED_JOBS) {
    const oldest = jobs.keys().next().value;
    if (oldest === undefined) return;
    jobs.delete(oldest);
  }
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

port.on('message', (request: CoreRequest) => {
  void handleRequest(request);
});

async function handleRequest(request: CoreRequest): Promise<void> {
  try {
    const result = await dispatch(request);
    post({ id: request.id, result });
  } catch (error) {
    post({ id: request.id, error: toErrorPayload(error) });
  }
}

async function dispatch(request: CoreRequest): Promise<unknown> {
  switch (request.method) {
    case 'config.parse':
      return parseConfig(request.params as { text: string });
    case 'config.lint':
      return lintConfig(request.params as { text: string });
    case 'engine.compile':
      return compile(request.params as { text: string });
    case 'job.start':
      return startJob(request.params as JobStartParams);
    case 'job.status':
      return jobStatus((request.params as { jobId: string }).jobId);
    case 'job.export':
      return exportJob(request.params as JobExportParams);
    case 'entry.test':
      return testEntry(request.params as TestEntryParams);
    case 'result.compare':
      return compare(request.params as CompareParams);
    case 'metrics.snapshot':
      return host.metrics();
    default:
      throw new RuntimeError('unknown-method', `未知方法：${request.method}`);
  }
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
function compile(params: { text: string }): CompileResult {
  const result = host.compile(params.text);
  emitEvent('engine.compiled', {
    compileId: result.compileId,
    stats: result.stats,
    timings: result.timings,
  });
  return result;
}

async function startJob(params: JobStartParams): Promise<JobStartResult> {
  const source = parseLegacyLang(params.sourceText);
  const fallback = params.fallbackText ? parseLegacyLang(params.fallbackText) : undefined;
  const jobId = `job-${Date.now().toString(36)}-${++jobCounter}`;
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

interface CompareParams {
  left: string;
  right: string;
  mode: 'golden' | 'run';
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

function emitEvent<K extends keyof CoreEventMap>(event: K, payload: CoreEventMap[K]): void {
  post({ type: 'event', event, payload } as CoreEvent);
}

function post(message: CoreResponse | CoreEvent): void {
  try {
    port.postMessage(message);
  } catch {
    // 主线程已经关闭；worker 随后会被 terminate。
  }
}

function toErrorPayload(error: unknown) {
  return {
    code: error instanceof RuntimeError ? error.code : 'internal',
    message: error instanceof Error ? error.message : String(error),
    details: error instanceof RuntimeError ? error.details : undefined,
  };
}
