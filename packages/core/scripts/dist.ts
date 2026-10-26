import type { TargetConfig } from '../src/types/config';

/** 迁移期脚本的本地路径推导；阶段 4 会改用 @gt6tg/runtime。 */
export const DEFAULT_DIST_ROOT = 'packages/core/dist';

export interface DistPathSet {
  root: string;
  output: string;
  unknown: string;
}

function basename(path: string): string {
  const parts = path.replaceAll('\\', '/').split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

export function distPathsForTarget(target: TargetConfig, root = DEFAULT_DIST_ROOT): DistPathSet {
  const dir = `${root}/${target.id}`;
  return {
    root: dir,
    output: `${dir}/${basename(target.output)}`,
    unknown: `${dir}/${basename(target.unknown)}`,
  };
}
