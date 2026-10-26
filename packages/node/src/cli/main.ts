import { runGate, runGenerate, runHash, runLint, runParity } from './commands';
import { runPerf } from './perf';

const args = process.argv.slice(2);
const command = args[0] ?? 'help';
const rest = args.slice(1);

let code = 0;
try {
  switch (command) {
    case 'generate':
      code = await runGenerate(rest);
      break;
    case 'lint':
      code = await runLint(rest);
      break;
    case 'parity':
      code = await runParity(rest);
      break;
    case 'hash':
      code = await runHash(rest);
      break;
    case 'perf':
      code = await runPerf(rest);
      break;
    case 'gate':
      code = await runGate(rest);
      break;
    case 'help':
    case '--help':
    case '-h':
      printUsage();
      break;
    default:
      console.error(`[cli] 未知命令：${command}`);
      printUsage();
      code = 2;
  }
} catch (error) {
  console.error(`[cli] ${error instanceof Error ? error.message : String(error)}`);
  if (process.env.GT6TG_DEBUG) console.error(error);
  code = 1;
}

process.exitCode = code;

function printUsage(): void {
  console.log(`用法：gt6tg <command> [options]

命令：
  generate   生成并写入 packages/node/dist
  lint       检查 project.jsonc schema/lint（有 error 时退出码 1）
  parity     生成 -> 回读 -> 与 legacy golden 对比
  hash       生成并输出 sha256 前 16 位
  perf       性能记录；--compare 对比最近两次记录
  gate       lint + parity + hash + perf`);
}
