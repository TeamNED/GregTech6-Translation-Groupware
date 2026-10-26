import type { Hooks } from './types';

/** 同步、可选、吞异常的 Hook 发射器；Hook 失败绝不影响主流程。 */
export function emitHook<T extends object, K extends keyof T>(
  hooks: Hooks<T> | undefined,
  name: K,
  payload: T[K],
): void {
  const hook = hooks?.[name];
  if (!hook) return;
  try {
    hook(payload);
  } catch {
    // 观测点不能改变运行结果。
  }
}
