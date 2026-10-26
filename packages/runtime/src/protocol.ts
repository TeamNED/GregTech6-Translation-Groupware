import type {
  CompileStats,
  ConfigIssue,
  EntryTestResult,
  LintReport,
  ProjectConfigV2,
  TimingReport,
} from '@gt6tg/core';
import type { CompileResult, MetricsSnapshot, TestEntryOptions } from './host';
import type { JobProgress } from './job';
import type { RunSummary } from './run-summary';

export interface ConfigParseResult {
  config: ProjectConfigV2 | null;
  issues: ConfigIssue[];
}

export interface JobStartParams {
  compileId: string;
  scope: 'all' | 'keys';
  keys?: string[];
}

export interface JobStartResult {
  jobId: string;
}

export interface JobStatus {
  jobId: string;
  state: 'idle' | 'running' | 'done' | 'error';
  processed: number;
  total: number;
  summary?: RunSummary;
  error?: string;
}

export interface JobExportParams {
  jobId: string;
  kind: 'output' | 'unknown';
}

export interface JobExportResult {
  text: string;
}

export interface CompareParams {
  left: string;
  right: string;
  mode: 'golden' | 'run';
}

export interface CompareSample {
  key: string;
  left: string | null;
  right: string | null;
}

export interface CompareResult {
  compared: number;
  same: number;
  changed: number;
  added: number;
  removed: number;
  samples: CompareSample[];
}

/** 请求方法表；传输层只关心 JSON 形状，不关心具体实现。 */
export interface CoreMethodMap {
  'config.parse': { params: { text: string }; result: ConfigParseResult };
  'config.lint': { params: { text: string }; result: LintReport };
  'engine.compile': { params: { text: string }; result: CompileResult };
  'job.start': { params: JobStartParams; result: JobStartResult };
  'job.status': { params: { jobId: string }; result: JobStatus };
  'job.export': { params: JobExportParams; result: JobExportResult };
  'entry.test': { params: TestEntryOptions; result: EntryTestResult };
  'result.compare': { params: CompareParams; result: CompareResult };
  'metrics.snapshot': { params: Record<string, never>; result: MetricsSnapshot };
}

export type CoreMethodName = keyof CoreMethodMap;
export type CoreParams<M extends CoreMethodName> = CoreMethodMap[M]['params'];
export type CoreResult<M extends CoreMethodName> = CoreMethodMap[M]['result'];

export interface CoreErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface CoreRequest {
  id: number;
  method: string;
  params: unknown;
}

export interface CoreResponse {
  id: number;
  result?: unknown;
  error?: CoreErrorPayload;
}

export interface CoreEventMap {
  'job.progress': JobProgress;
  'job.done': { jobId: string; summary: RunSummary };
  'job.error': { jobId: string; message: string };
  'engine.compiled': { compileId: string; stats: CompileStats; timings: TimingReport };
}

export type CoreEvent = {
  [K in keyof CoreEventMap]: { type: 'event'; event: K; payload: CoreEventMap[K] };
}[keyof CoreEventMap];

export type CoreMessage = CoreResponse | CoreEvent;

export interface CoreTransport {
  send(request: CoreRequest): void;
  onMessage(listener: (message: CoreMessage) => void): () => void;
  close?(): void;
}

export interface CoreClient {
  request<M extends CoreMethodName>(method: M, params: CoreParams<M>): Promise<CoreResult<M>>;
  onEvent(listener: (event: CoreEvent) => void): () => void;
  close?(): void;
}
