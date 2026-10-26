import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';

/** 仓库根目录：packages/node/src -> packages/node -> packages -> root。 */
export const repoRoot = resolve(import.meta.dirname, '../../..');
export const projectFilePath = resolve(repoRoot, 'packages/node/project.jsonc');
/** legacy 目录只允许 legacy 自身（C++ 工具）写入。 */
export const legacyRoot = resolve(repoRoot, 'packages/legacy');
/** Node 生成物只能写到这里。 */
export const artifactRoot = resolve(repoRoot, 'packages/node/dist');

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

function isInside(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel));
}

/**
 * 迁移期的硬性写入边界：
 * - legacy 文件只能由 legacy 内置工具修改，node 一律拒绝；
 * - Node 的产物只能落在 packages/node/dist。
 */
export function assertArtifactWritable(path: string): void {
  const absolute = resolve(path);
  if (isInside(legacyRoot, absolute)) {
    throw new Error(`迁移期禁止写入 legacy：${repoRelative(absolute)}；legacy 文件只能由 legacy 内置工具修改`);
  }
  if (!isInside(artifactRoot, absolute)) {
    throw new Error(`生成物只能写入 packages/node/dist：${repoRelative(absolute)}`);
  }
}

/** 写生成物：不生成 `.bak`，dist 可以随时重建。 */
export async function writeArtifact(path: string, content: string): Promise<void> {
  assertArtifactWritable(path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
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
