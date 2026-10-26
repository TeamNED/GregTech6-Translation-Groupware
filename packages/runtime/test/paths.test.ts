import type { TargetConfig } from '@gt6tg/core';
import { describe, expect, it } from 'vitest';
import { distPathsForTarget } from '../src/paths';

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

describe('dist paths', () => {
  it('writes under the configured dist root by target id', () => {
    const paths = distPathsForTarget(target, 'packages/node/dist');

    expect(paths.root).toBe('packages/node/dist/gt6-legacy');
    expect(paths.output).toBe('packages/node/dist/gt6-legacy/GregTech.lang');
    expect(paths.unknown).toBe('packages/node/dist/gt6-legacy/GregTech.unknown.lang');
  });

  it('never points into the legacy workplace', () => {
    const paths = distPathsForTarget(target);

    expect(paths.output.startsWith('packages/legacy/')).toBe(false);
    expect(paths.unknown.startsWith('packages/legacy/')).toBe(false);
  });
});
