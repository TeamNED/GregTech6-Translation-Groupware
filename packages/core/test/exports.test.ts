import { describe, expect, it } from 'vitest';
import * as core from '../src/index';

describe('public exports', () => {
  it('exposes the algorithm/config/hook surface', () => {
    const functions = [
      'parseProjectJsonc',
      'lintProject',
      'compileConfig',
      'generateFromEntries',
      'testEntry',
      'parseLegacyLang',
      'writeLegacyLang',
      'compareToGolden',
      'diffLangMaps',
      'emitHook',
      'createTimer',
    ];

    for (const name of functions) {
      expect(core[name as keyof typeof core], name).toBeTypeOf('function');
    }
  });

  it('does not expose moved or Node-only utilities', () => {
    expect('hashOutput' in core).toBe(false);
    expect('distPathsForTarget' in core).toBe(false);
    expect('DEFAULT_DIST_ROOT' in core).toBe(false);
    expect('convertLegacyYamlToProject' in core).toBe(false);
    expect('DEFAULT_LEGACY_TARGET' in core).toBe(false);
  });
});
