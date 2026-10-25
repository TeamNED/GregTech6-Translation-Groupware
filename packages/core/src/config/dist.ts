import type { TargetConfig } from '../types/config';

/** 迁移期 core 的产物根目录；legacy 目录只读。 */
export const DEFAULT_DIST_ROOT = 'packages/core/dist';

export interface DistPathSet {
  /** 该 target 的 dist 目录，仓库相对路径。 */
  root: string;
  output: string;
  unknown: string;
}

function basename(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/**
 * 每个 target 生成到独立目录，文件名沿用 legacy 的命名。
 * 返回仓库相对路径，由调用方解析成绝对路径后写盘。
 */
export function distPathsForTarget(target: TargetConfig, root = DEFAULT_DIST_ROOT): DistPathSet {
  const dir = `${root}/${target.id}`;
  return {
    root: dir,
    output: `${dir}/${basename(target.output)}`,
    unknown: `${dir}/${basename(target.unknown)}`,
  };
}
