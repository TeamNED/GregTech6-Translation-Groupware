import { existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * 用 CMake 构建原 C++ 替换器。
 *
 * Rush 环境里不保证 cmake/MSBuild 在 PATH；这里按以下顺序查找：
 *   1. CMAKE / VCVARS 环境变量
 *   2. PATH 中的 cmake
 *   3. Visual Studio 自带的 CMake 与 vcvars64.bat（2017/2019/2022 常见路径）
 *
 * 依赖 vcpkg 的 ryml/fmt/Boost；需要 VCPKG_ROOT。
 */
const root = resolve(import.meta.dirname, '..');
const buildDir = resolve(root, 'build-rush');

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

function findVcvars() {
  if (process.env.VCVARS && existsSync(process.env.VCVARS)) return process.env.VCVARS;
  const candidates = [
    'C:/Program Files (x86)/Microsoft Visual Studio/2017/Community/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2017/Professional/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2017/Enterprise/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2017/BuildTools/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2019/Community/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2019/Professional/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2019/Enterprise/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files (x86)/Microsoft Visual Studio/2019/BuildTools/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files/Microsoft Visual Studio/2022/Community/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files/Microsoft Visual Studio/2022/Professional/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files/Microsoft Visual Studio/2022/Enterprise/VC/Auxiliary/Build/vcvars64.bat',
    'C:/Program Files/Microsoft Visual Studio/2022/BuildTools/VC/Auxiliary/Build/vcvars64.bat',
  ];
  return candidates.find((candidate) => existsSync(candidate));
}

const cmake = findCmake();
if (!cmake) {
  console.error('[legacy] 找不到 cmake。请安装 CMake，或设置 CMAKE 环境变量指向 cmake.exe。');
  process.exit(1);
}

const vcvars = process.platform === 'win32' ? findVcvars() : null;
if (process.platform === 'win32' && !vcvars) {
  console.error('[legacy] 找不到 vcvars64.bat。请安装 Visual Studio C++ 工具链，');
  console.error('[legacy] 或设置 VCVARS 环境变量指向 vcvars64.bat。');
  process.exit(1);
}

function quote(argument) {
  return /[\s"]/.test(argument) ? `"${argument.replaceAll('"', '\\"')}"` : argument;
}

function run(args, cwd = root) {
  console.log(`[legacy] ${cmake} ${args.join(' ')}`);
  let command = cmake;
  let commandArgs = args;
  if (vcvars) {
    command = process.env.ComSpec || 'cmd.exe';
    commandArgs = ['/d', '/c', `call "${vcvars}" >nul && "${cmake}" ${args.map(quote).join(' ')}`];
  }
  const result = spawnSync(command, commandArgs, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    windowsVerbatimArguments: Boolean(vcvars),
  });
  if (result.status !== 0) {
    console.error('[legacy] CMake 构建失败。');
    console.error('[legacy] 本项目依赖 vcpkg 的 ryml/fmt/Boost；请设置 VCPKG_ROOT，');
    console.error('[legacy] 或先按 packages/legacy/README.md 完成 vcpkg 安装。');
    process.exit(result.status ?? 1);
  }
}

// VS2017 自带的 CMake 不支持 -S/-B，所以在 build-rush 目录内用 `cmake ..`。
// build-rush 使用独立构建目录，避免旧 CMakeCache 指向搬迁前路径。
mkdirSync(buildDir, { recursive: true });
if (!existsSync(resolve(buildDir, 'CMakeCache.txt'))) {
  const args = [root, '-A', 'x64', '-T', 'host=x64', '-DCMAKE_BUILD_TYPE=Release'];
  if (process.env.VCPKG_ROOT) {
    const vcpkgRoot = process.env.VCPKG_ROOT.replace(/\\/g, '/');
    const toolchain = `${vcpkgRoot}/scripts/buildsystems/vcpkg.cmake`;
    args.push(`-DCMAKE_TOOLCHAIN_FILE=${toolchain}`);
    args.push(`-DVCPKG_INSTALLED_DIR=${vcpkgRoot}/installed`);
    args.push('-DVCPKG_TARGET_TRIPLET=x64-windows');
    args.push(`-DCMAKE_PREFIX_PATH=${vcpkgRoot}/installed/x64-windows`);
    args.push(`-DBOOST_ROOT=${vcpkgRoot}/installed/x64-windows`);
  }
  run(args, buildDir);
}
run(['--build', '.', '--config', 'Release'], buildDir);
console.log('[legacy] C++ 构建完成。');
