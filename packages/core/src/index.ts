import { compileProject, type CompiledProject } from './engine/compile';
import { buildLexicon } from './engine/lexicon';
import { buildModel } from './engine/model';
import { createTimer } from './engine/timing';
import type { ProjectConfigV2 } from './types/config';

export * from './types/config';
export * from './types/issues';
export * from './types/lang';
export * from './types/api';
export * from './types/timing';

export { parseProjectJsonc, getTarget, updateTargetJsonc, stringifyProjectConfig } from './config/jsonc';
export { lintProject } from './config/lint';
export { convertLegacyYamlToProject, DEFAULT_LEGACY_TARGET } from './config/legacyYaml';
export { DEFAULT_DIST_ROOT, distPathsForTarget, type DistPathSet } from './config/dist';

export { tokenize, tokenizeAscii } from './engine/tokenizer';
export {
  buildModel,
  compileTemplate,
  combineNamespaces,
  isBetterOrder,
  generatorLabel,
  ruleLabel,
  type Generator as EngineGenerator,
  type GeneratorModel,
  type ResolvedEntry,
} from './engine/model';
export { buildLexicon, type Lexicon, type LexEntry, type RuleMeta } from './engine/lexicon';
export {
  compileProject,
  patternLabel,
  groupLexEntries,
  MAX_TOKENS,
  type CompiledPattern,
  type CompiledProject,
  type CompileStats,
  type NamespaceNode,
  type PatternOp,
} from './engine/compile';
export {
  Matcher,
  candidateViews,
  dedupeCandidates,
  selectCandidate,
  type Candidate,
  type MatchOptions,
  type MatchResult,
  type PatternAttempt,
} from './engine/matcher';
export { generateFromEntries, buildFallbackMap, type GenerationResult, type GenerationStats } from './engine/apply';
export {
  compareToGolden,
  type ParityInput,
  type ParityReport,
  type ParityUnknownSample,
  type ParityValueSample,
} from './engine/parity';
export { testEntry } from './engine/entryTest';
export { parseLegacyLang, writeLegacyLang } from './engine/legacyLang';
export { analyzeLangDocument, diffLangMaps } from './engine/stats';
export { Timer, createTimer, formatTiming, roundMs } from './engine/timing';

/** 一次性把配置编译成可复用的 matcher 数据；`timings` 记录各编译阶段耗时。 */
export function compileConfig(config: ProjectConfigV2): CompiledProject {
  const timer = createTimer('compile');
  const model = timer.measure('model', () => buildModel(config));
  const lexicon = timer.measure('lexicon', () => buildLexicon(model));
  const compiled = compileProject(model, lexicon, timer);
  compiled.timings = timer.finish();
  return compiled;
}
