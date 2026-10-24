import { describe, expect, it } from 'vitest';
import { parseProjectJsonc } from '../src/config/jsonc';
import { lintProject } from '../src/config/lint';

const minimalProject = `{
  // 允许注释
  "schemaVersion": 2,
  "defaultTarget": "gt6-legacy",
  "targets": [
    {
      "id": "gt6-legacy",
      "label": "GT6",
      "format": "legacy-lang",
      "workplace": "packages/legacy/workplace",
      "source": "en/GregTech.lang",
      "fallback": "zh/GregTech.fallback.lang",
      "output": "zh/GregTech.lang",
      "unknown": "zh/GregTech.unknown.lang",
      "encoding": "utf-8",
      "lineEnding": "crlf",
    },
  ],
  "generators": [
    { "group": "dust", "namespace": "S:", "dict": { "Iron Dust": "铁粉" } },
    { "group": "crate", "namespace": "S:", "rules": [{ "s": "Crate of {0}", "t": "{0}板条箱", "subs": ["dust"] }] },
  ],
}`;

describe('project config', () => {
  it('parses JSONC with comments and trailing commas', () => {
    const parsed = parseProjectJsonc(minimalProject);
    expect(parsed.issues).toEqual([]);
    expect(parsed.config?.generators).toHaveLength(2);
  });

  it('reports a missing group', () => {
    const parsed = parseProjectJsonc(minimalProject.replace('"subs": ["dust"]', '"subs": ["missing"]'));
    expect(parsed.config).not.toBeNull();
    const lint = lintProject(parsed.config!);
    expect(lint.stats.missingGroups).toContain('missing');
    expect(lint.issues.some((issue) => issue.code === 'group.missing')).toBe(true);
  });

  it('accepts a block with both dict and rules', () => {
    const parsed = parseProjectJsonc(
      minimalProject.replace(
        '{ "group": "dust", "namespace": "S:", "dict": { "Iron Dust": "铁粉" } }',
        '{ "group": "dust", "namespace": "S:", "dict": { "Iron Dust": "铁粉" }, "rules": [{ "s": "{0} Dust", "t": "{0}粉", "subs": ["dust"] }] }',
      ),
    );
    expect(parsed.issues).toEqual([]);
    expect(parsed.config?.generators[0]?.dict).toBeDefined();
    expect(parsed.config?.generators[0]?.rules).toBeDefined();
  });
});
