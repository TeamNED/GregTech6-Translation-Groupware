import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/** 仓库根目录：packages/server/src -> packages/server -> packages -> root。 */
export const repoRoot = resolve(import.meta.dirname, '../../..');
export const projectFilePath = resolve(repoRoot, 'packages/core/project.jsonc');

/** 把仓库相对路径解析成绝对路径，并禁止越界。 */
export function resolveInsideRepo(path: string): string {
  const absolute = isAbsolute(path) ? resolve(path) : resolve(repoRoot, path);
  const relativePath = relative(repoRoot, absolute);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error(`路径越出仓库根目录：${path}`);
  }
  return absolute;
}

export function repoRelative(absolute: string): string {
  return relative(repoRoot, absolute).replaceAll('\\', '/');
}

export async function readTextIfExists(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

function backupSuffix(): string {
  return new Date().toISOString().replaceAll(':', '-').replace(/\..+$/, '');
}

/** 写文件前保留一份同目录备份；返回备份路径。 */
export async function writeWithBackup(path: string, content: string): Promise<string | undefined> {
  await mkdir(dirname(path), { recursive: true });
  let backupPath: string | undefined;
  if (await pathExists(path)) {
    backupPath = `${path}.bak-${backupSuffix()}`;
    await copyFile(path, backupPath);
  }
  await writeFile(path, content, 'utf8');
  return backupPath;
}
