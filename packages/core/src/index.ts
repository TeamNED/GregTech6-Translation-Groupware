import type { ProjectConfigV2 } from './types/config';
import { buildLexicon } from './engine/lexicon';
import { compileProject, type CompiledProject } from './engine/compile';
import { buildModel } from './engine/model';

export * from './types/config';
export * from './types/issues';
export * from './types/lang';
export * from './types/api';

export { parseProjectJsonc, getTarget, updateTargetJsonc, stringifyProjectConfig } from './config/jsonc';
export { lintProject } from './config/lint';
export { convertLegacyYamlToProject, DEFAULT_LEGACY_TARGET } from './config/legacyYaml';

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
export { testEntry } from './engine/entryTest';
export { parseLegacyLang, writeLegacyLang } from './engine/legacyLang';
export { analyzeLangDocument, diffLangMaps } from './engine/stats';

/** 一次性把配置编译成可复用的 matcher 数据。 */
export function compileConfig(config: ProjectConfigV2): CompiledProject {
  const model = buildModel(config);
  const lexicon = buildLexicon(model);
  return compileProject(model, lexicon);
}
