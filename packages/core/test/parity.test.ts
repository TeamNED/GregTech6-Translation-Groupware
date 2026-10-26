import { describe, expect, it } from 'vitest';
import { distPathsForTarget } from '../src/config/dist';
import { parseLegacyLang } from '../src/engine/legacyLang';
import { compareToGolden } from '../src/engine/parity';
import type { TargetConfig } from '../src/types/config';

const golden = parseLegacyLang(`# Configuration file
languagefile {
    S:a=甲
    S:b=乙
}
`);

const expectedUnknown = parseLegacyLang(`languagefile {
    S:c=丙
}
`);

function input(entries: Array<[string, string]>, unknown: string[] = []) {
  return { output: new Map(entries), unknown: new Set(unknown) };
}

describe('parity', () => {
  it('passes when the generated map matches golden and unknown sets', () => {
    const report = compareToGolden(
      golden,
      input(
        [
          ['S:a', '甲'],
          ['S:b', '乙'],
          ['S:c', '丙'],
        ],
        ['S:c'],
      ),
      expectedUnknown,
    );

    expect(report.ok).toBe(true);
    expect(report.mismatch).toBe(0);
    expect(report.unknownMismatch).toBe(0);
    expect(report.goldenKeys).toBe(2);
    expect(report.expectedUnknownKeys).toBe(1);
  });

  it('counts changed values and missing golden keys', () => {
    const report = compareToGolden(golden, input([['S:a', 'wrong']]), expectedUnknown);

    expect(report.ok).toBe(false);
    expect(report.mismatch).toBe(2);
    expect(report.samples).toContainEqual({ key: 'S:a', expected: '甲', actual: 'wrong' });
    expect(report.samples).toContainEqual({ key: 'S:b', expected: '乙', actual: null });
  });

  it('compares unknown in both directions', () => {
    const report = compareToGolden(
      golden,
      input(
        [
          ['S:a', '甲'],
          ['S:b', '乙'],
          ['S:extra', '多余'],
        ],
        ['S:extra'],
      ),
      expectedUnknown,
    );

    expect(report.unknownMismatch).toBe(2);
    expect(report.unknownSamples).toContainEqual({ key: 'S:c', expected: true });
    expect(report.unknownSamples).toContainEqual({ key: 'S:extra', expected: false });
  });
});

describe('dist paths', () => {
  const target: TargetConfig = {
    id: 'gt6-legacy',
    label: 'GT6',
    format: 'legacy-lang',
    workplace: 'packages/legacy/workplace',
    source: 'en/GregTech.lang',
    fallback: 'zh/GregTech.fallback.lang',
    output: 'zh/GregTech.lang',
    unknown: 'zh/GregTech.unknown.lang',
    encoding: 'utf-8',
    lineEnding: 'crlf',
  };

  it('writes under core/dist by target id', () => {
    const paths = distPathsForTarget(target);

    expect(paths.root).toBe('packages/core/dist/gt6-legacy');
    expect(paths.output).toBe('packages/core/dist/gt6-legacy/GregTech.lang');
    expect(paths.unknown).toBe('packages/core/dist/gt6-legacy/GregTech.unknown.lang');
  });

  it('never points into the legacy workplace', () => {
    const paths = distPathsForTarget(target);

    expect(paths.output.startsWith('packages/legacy/')).toBe(false);
    expect(paths.unknown.startsWith('packages/legacy/')).toBe(false);
  });
});
