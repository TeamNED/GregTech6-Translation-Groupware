import type { MemorySnapshot } from '@gt6tg/core';

/** 浏览器 best-effort 内存：Chromium 的 performance.memory；其他环境标记不可用。 */
export function browserMemory(): MemorySnapshot {
  const perf = performance as Performance & {
    memory?: { usedJSHeapSize?: number };
  };
  const heapUsed = perf.memory?.usedJSHeapSize;
  if (typeof heapUsed === 'number' && heapUsed > 0) {
    return { available: true, source: 'performance.memory', heapUsed };
  }
  return { available: false, source: 'unavailable' };
}
