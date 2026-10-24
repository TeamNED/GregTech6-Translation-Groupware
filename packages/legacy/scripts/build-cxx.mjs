import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * 用 CMake 构建原 C++ 替换器。
 *
 * Rush 环境里不保证 cmake 在 PATH；这里按以下顺序查找：
 *   1. CMAKE 环境变量
 *   2. PATH 中的 cmake
 *   3. Visual Studio 自带的 CMake（2017/2019/2022 常见路径）
 *
 * 依赖 vcpkg 的 ryml/fmt/Boost；需要 VCPKG_ROOT 或已有的 build/CMakeCache.txt。
 */
const root = resolve(import.meta.dirname, '..');
const buildDir = resolve(root, 'build');

function findCmake() {
  if (process.env.CMAKE && existsSync(process.env.CMAKE)) return process.env.CMAKE;
  const fromPath = spawnSync('cmake', ['--version'], { encoding: 'utf8' });
  if (fromPath.status === 0) return 'cmake';
  const candidates = [
    'C:/Program Files/CMake/bin/cmake.exe',
    'C:/Program Files (x86)/CMake/bin/cmake.exe',
    'C:/Program Files/Microsoft Visual Studio/2022/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
    'C:/Program Files/Microsoft Visual Studio/2022/Professional/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
    'C:/Program Files/Microsoft Visual Studio/2022/Enterprise/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
    'C:/Program Files (x86)/Microsoft Visual Studio/2019/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
    'C:/Program Files (x86)/Microsoft Visual Studio/2017/Community/Common7/IDE/CommonExtensions/Microsoft/CMake/CMake/bin/cmake.exe',
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const cmake = findCmake();
if (!cmake) {
  console.error('[legacy] 找不到 cmake。请安装 CMake，或设置 CMAKE 环境变量指向 cmake.exe。');
  process.exit(1);
}

function run(args) {
  console.log(`[legacy] ${cmake} ${args.join(' ')}`);
  const result = spawnSync(cmake, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.status !== 0) {
    console.error('[legacy] CMake 构建失败。');
    console.error('[legacy] 本项目依赖 vcpkg 的 ryml/fmt/Boost；请设置 VCPKG_ROOT，');
    console.error('[legacy] 或先按 packages/legacy/README.md 完成 vcpkg 安装。');
    process.exit(result.status ?? 1);
  }
}

// 已有 build/ 缓存时直接构建；否则重新 configure。
if (!existsSync(resolve(buildDir, 'CMakeCache.txt'))) {
  run(['-S', root, '-B', buildDir, '-DCMAKE_BUILD_TYPE=Release']);
}
run(['--build', buildDir, '--config', 'Release']);
console.log('[legacy] C++ 构建完成。');
