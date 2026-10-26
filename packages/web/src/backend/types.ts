import type { ServerMethodName, ServerParams, ServerResult } from '@gt6tg/core';
import type { CompareResult, RunSummary } from '@gt6tg/runtime';
import type { ConnectionStatus } from '../rpc/client';

export type BackendMode = 'dev' | 'repl';
export type FileRole = 'source' | 'fallback' | 'golden' | 'goldenUnknown';

export interface BackendCapabilities {
  saveConfig: boolean;
  importLegacy: boolean;
  updateTarget: boolean;
  writeDist: boolean;
  upload: boolean;
  download: boolean;
  history: boolean;
}

export interface FileSlot {
  name: string;
  size: number;
}

export interface HistoryEntry {
  id: string;
  createdAt: string;
  summary: RunSummary;
}

export interface ProgressInfo {
  phase: string;
  processed: number;
  total: number;
}

export interface ConsoleBackend {
  mode: BackendMode;
  capabilities: BackendCapabilities;
  connect(onStatus: (status: ConnectionStatus) => void): void;
  call<Method extends ServerMethodName>(method: Method, ...params: ServerParams<Method>): Promise<ServerResult<Method>>;
  setText(role: FileRole, text: string, name?: string): void;
  clearFile(role: FileRole): void;
  files(): Record<FileRole, FileSlot | undefined>;
  download(kind: 'output' | 'unknown'): void;
  exportConfig(): Promise<void>;
  resetConfig(): Promise<void>;
  history(): HistoryEntry[];
  setHistoryLimit(limit: number): void;
  compareCurrent(mode: 'golden' | 'run'): Promise<CompareResult>;
  cancel(): void;
  onProgress(listener: (progress: ProgressInfo) => void): () => void;
}
