/** 时间源由宿主注入，便于测试与跨环境一致。 */
export interface Clock {
  now(): number;
}

export const systemClock: Clock = {
  now: () => performance.now(),
};

export function roundMs(ms: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(ms * factor) / factor;
}
