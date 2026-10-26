import type { CompileStats, CompiledProject, TimingReport } from '@gt6tg/core';

export interface CompileCacheEntry {
  compileId: string;
  compiled: CompiledProject;
  stats: CompileStats;
  timings: TimingReport;
  lastUsed: number;
}

/**
 * 编译缓存只活在宿主进程/Worker 内。
 *
 * 编译结果含 Map/Set/闭包，不能结构化克隆；所以它永远不跨线程，
 * 只通过 compileId 引用。默认保留当前 + 上一个版本，LRU 淘汰。
 */
export class CompileCache {
  private readonly entries = new Map<string, CompileCacheEntry>();

  constructor(private readonly maxEntries = 2) {}

  get size(): number {
    return this.entries.size;
  }

  ids(): string[] {
    return [...this.entries.keys()];
  }

  get(compileId: string, now: number): CompileCacheEntry | undefined {
    const entry = this.entries.get(compileId);
    if (!entry) return undefined;
    entry.lastUsed = now;
    return entry;
  }

  peek(compileId: string): CompileCacheEntry | undefined {
    return this.entries.get(compileId);
  }

  set(entry: CompileCacheEntry): void {
    this.entries.delete(entry.compileId);
    this.entries.set(entry.compileId, entry);
    while (this.entries.size > Math.max(1, this.maxEntries)) {
      const oldest = [...this.entries.values()].reduce((a, b) => (a.lastUsed <= b.lastUsed ? a : b));
      this.entries.delete(oldest.compileId);
    }
  }

  clear(): void {
    this.entries.clear();
  }
}

/** 配置文本的快速缓存键；不是输出指纹，不需要加密 hash。 */
export function compileIdForConfig(configText: string): string {
  const first = fnv1a32(configText, 0x811c9dc5);
  const second = fnv1a32(configText, 0x9e3779b9);
  return `cfg-${first.toString(16).padStart(8, '0')}${second.toString(16).padStart(8, '0')}-${configText.length.toString(16)}`;
}

function fnv1a32(text: string, seed: number): number {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
