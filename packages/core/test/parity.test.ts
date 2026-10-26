import { describe, expect, it } from 'vitest';
import { parseLegacyLang } from '../src/engine/legacyLang';
import { compareToGolden } from '../src/engine/parity';

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
