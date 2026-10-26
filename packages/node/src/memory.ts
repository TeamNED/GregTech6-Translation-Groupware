import type { MemorySnapshot } from '@gt6tg/core';

/** Node 侧进程内存快照；worker_threads 与主进程共享同一进程。 */
export function nodeMemory(): MemorySnapshot {
  const usage = process.memoryUsage();
  return {
    available: true,
    source: 'process.memoryUsage',
    heapUsed: usage.heapUsed,
    rss: usage.rss,
  };
}
