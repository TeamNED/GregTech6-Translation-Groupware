import type { TargetConfig } from '@gt6tg/core';

/**
 * 迁移期暂用 packages/core/dist；阶段 4 会切到 packages/node/dist。
 * 这里只做仓库相对路径推导，不接触文件系统。
 */
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

/** 每个 target 生成到独立目录，文件名沿用 legacy 命名。 */
export function distPathsForTarget(target: TargetConfig, root = DEFAULT_DIST_ROOT): DistPathSet {
  const dir = `${root}/${target.id}`;
  return {
    root: dir,
    output: `${dir}/${basename(target.output)}`,
    unknown: `${dir}/${basename(target.unknown)}`,
  };
}
