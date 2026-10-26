import { compileProject } from './engine/compile';
import type { CompiledProject } from './engine/compile';
import { buildLexicon } from './engine/lexicon';
import { buildModel } from './engine/model';
import { createTimer } from './engine/timing';
import type { ProjectConfigV2 } from './types/config';

/**
 * 一次性把配置编译成可复用的 matcher 数据；`timings` 记录各编译阶段耗时。
 *
 * 编译生命周期事件由 runtime 宿主发出，避免 core 与 runtime 双重上报。
 */
export function compileConfig(config: ProjectConfigV2): CompiledProject {
  const timer = createTimer('compile');
  const model = timer.measure('model', () => buildModel(config));
  const lexicon = timer.measure('lexicon', () => buildLexicon(model));
  const compiled = compileProject(model, lexicon, timer);
  compiled.timings = timer.finish();
  return compiled;
}
