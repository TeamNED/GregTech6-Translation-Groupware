/** WebSocket RPC 与 Web 控制台共用的 DTO。 */

import type { ProjectConfigV2, LineEnding, TargetConfig } from './config';
import type { ConfigIssue, ProjectStats } from './issues';
import type { DetectedLineEnding } from './lang';
import type { ParityReport } from './parity';
import type { TimingReport } from './timing';

export interface ProjectSnapshot {
  raw: string;
  config: ProjectConfigV2 | null;
  issues: ConfigIssue[];
  stats: ProjectStats;
  targets: TargetConfig[];
  activeTargetId: string;
}

export interface SaveProjectResult extends ProjectSnapshot {
  savedAt: string;
  backupPath?: string;
}

export interface TargetPatch {
  label?: string;
  workplace?: string;
  source?: string;
  fallback?: string;
  output?: string;
  unknown?: string;
  lineEnding?: LineEnding;
  notes?: string;
}

export interface FileInfo {
  /** 仓库相对路径，展示用。 */
  path: string;
  exists: boolean;
  size: number;
  lines: number;
  keys: number;
  uniqueKeys: number;
  emptyValues: number;
  duplicateKeys: number;
  valuesWithParagraph: number;
  valuesWithEquals: number;
  lineEnding: DetectedLineEnding;
}

export interface DiffSample {
  key: string;
  expected: string | null;
  actual: string | null;
}

export interface DiffStats {
  compared: number;
  same: number;
  changed: number;
  added: number;
  removed: number;
  samples: DiffSample[];
}

/** server 侧一次操作的端到端计时；core 的分阶段计时单独放在 compile/generate。 */
export interface OperationTiming {
  totalMs: number;
  readMs: number;
  compileMs: number;
  generateMs: number;
  diffMs: number;
  writeMs?: number;
  compile?: TimingReport;
  generate?: TimingReport;
}

export interface IoCheckReport {
  targetId: string;
  workplace: string;
  /** core 生成物的目录（仓库相对路径）；legacy 只读。 */
  distRoot: string;
  source: FileInfo;
  fallback: FileInfo;
  /** legacy golden，只读；迁移期作为 parity 基准。 */
  output: FileInfo;
  unknown: FileInfo;
  generated: {
    keys: number;
    unknownKeys: number;
    sameAsEnglish: number;
    conflictKeys: number;
    durationMs: number;
    hash: string;
    timings?: TimingReport;
  };
  /** 与 legacy golden 的逐 key parity 结果。 */
  parity: ParityReport;
  timings: OperationTiming;
  diffVsCurrent: DiffStats;
  notes: string[];
}

export interface GenerateResult {
  targetId: string;
  dryRun: boolean;
  durationMs: number;
  timings: OperationTiming;
  sourceKeys: number;
  outputKeys: number;
  unknownKeys: number;
  sameAsEnglish: number;
  conflictKeys: number;
  hash: string;
  diffVsCurrent: DiffStats;
  written?: {
    /** 写入的 dist 目录（仓库相对路径）。 */
    distRoot: string;
    outputPath: string;
    unknownPath: string;
  };
  /** 仅测试/调试时返回。 */
  output?: Record<string, string>;
  unknown?: Record<string, string>;
}

export interface CandidateView {
  target: string;
  namespace: string;
  generator: string;
  generatorId: number;
  rule: number;
  combo: number;
}

export type TraceStage =
  | 'tokenize'
  | 'namespace'
  | 'pattern'
  | 'lit'
  | 'lex'
  | 'reduce'
  | 'emit'
  | 'reject'
  | 'select'
  | 'fallback';

export interface TraceStep {
  stage: TraceStage;
  message: string;
  data?: Record<string, unknown>;
}

export interface EntryTestResult {
  key: string;
  value: string;
  targetId: string;
  tokens: string[];
  matchedNamespace?: string;
  selected?: CandidateView;
  candidates: CandidateView[];
  fallback?: string;
  unknown: boolean;
  steps: TraceStep[];
  issues: ConfigIssue[];
}

export interface RpcErrorPayload {
  code: string;
  message: string;
  details?: unknown;
}

export interface RpcRequest {
  id: number;
  method: string;
  params: unknown[];
}

export interface RpcResponse {
  id: number;
  result?: unknown;
  error?: RpcErrorPayload;
}

export interface RpcNotification {
  type: 'progress';
  task: string;
  message: string;
  data?: Record<string, unknown>;
}

/** 服务端方法签名：前端通过 keyof 获得类型安全的 call。 */
export interface ServerMethodMap {
  getProject: { params: []; result: ProjectSnapshot };
  validateProject: { params: [raw: string]; result: ProjectSnapshot };
  saveProject: { params: [raw: string]; result: SaveProjectResult };
  updateTarget: { params: [raw: string, targetId: string, patch: TargetPatch]; result: ProjectSnapshot };
  checkIo: { params: [targetId: string]; result: IoCheckReport };
  generate: { params: [targetId: string, write: boolean, includeOutput?: boolean]; result: GenerateResult };
  testEntry: { params: [targetId: string, key: string, value?: string]; result: EntryTestResult };
  importLegacyConfig: { params: []; result: ProjectSnapshot };
}

export type ServerMethodName = keyof ServerMethodMap;
export type ServerParams<M extends ServerMethodName> = ServerMethodMap[M]['params'];
export type ServerResult<M extends ServerMethodName> = ServerMethodMap[M]['result'];
