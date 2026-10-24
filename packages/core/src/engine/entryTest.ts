import type { EntryTestResult, TraceStep } from '../types/api';
import type { ConfigIssue } from '../types/issues';
import type { CompiledProject } from './compile';
import { Matcher, candidateViews, dedupeCandidates, selectCandidate } from './matcher';

/** 对单个 key/value 运行完整匹配，并返回候选、最终选择和逐步 trace。 */
export function testEntry(
  compiled: CompiledProject,
  key: string,
  value: string,
  fallbackMap: Map<string, string>,
  issues: ConfigIssue[] = [],
): EntryTestResult {
  const trace: TraceStep[] = [];
  const matcher = new Matcher(compiled);
  const matched = matcher.match(key, value, { trace, maxSteps: 400 });
  const deduped = dedupeCandidates(compiled, matched.candidates);
  const selected = selectCandidate(compiled, key, deduped);
  const fallback = fallbackMap.get(key);

  if (selected) {
    trace.push({
      stage: 'select',
      message: selected.target,
      data: {
        namespace: selected.namespace,
        combo: selected.combo,
        candidates: deduped.length,
      },
    });
  } else if (fallback !== undefined) {
    trace.push({ stage: 'fallback', message: fallback, data: { key } });
  } else {
    trace.push({ stage: 'reject', message: '未命中且没有 fallback，将进入 unknown', data: { key } });
  }

  const candidateList = candidateViews(compiled, deduped);
  return {
    key,
    value,
    targetId: '',
    tokens: matched.tokens,
    matchedNamespace: selected?.namespace,
    selected: selected ? candidateViews(compiled, [selected])[0] : undefined,
    candidates: candidateList,
    fallback,
    unknown: !selected && fallback === undefined,
    steps: trace,
    issues,
  };
}
