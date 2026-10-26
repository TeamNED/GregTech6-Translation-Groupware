import { describe, expect, it } from 'vitest';
import { EngineHost, createRuntimeDispatcher, type HashProvider } from '../src/index';

const configText = JSON.stringify({
  schemaVersion: 2,
  defaultTarget: 't',
  targets: [
    {
      id: 't',
      label: 'T',
      format: 'legacy-lang',
      workplace: 'packages/legacy/workplace',
      source: 'en/GregTech.lang',
      fallback: 'zh/GregTech.fallback.lang',
      output: 'zh/GregTech.lang',
      unknown: 'zh/GregTech.unknown.lang',
      encoding: 'utf-8',
      lineEnding: 'crlf',
    },
  ],
  generators: [{ group: 'g', namespace: 'S:', dict: { Foo: 'Bar' } }],
});

const sourceText = `languagefile {
    S:Foo=Foo
    S:Other=Other
}
`;

describe('runtime dispatcher', () => {
  it('rejects a concurrent job.start while another job is active', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const hash: HashProvider = {
      async sha256Hex() {
        await gate;
        return 'a'.repeat(64);
      },
    };

    const host = new EngineHost({ hash });
    const compiled = host.compile(configText);
    const dispatcher = createRuntimeDispatcher(host, () => undefined);
    const params = {
      compileId: compiled.compileId,
      sourceText,
      lineEnding: 'crlf' as const,
      scope: 'all' as const,
      includeArtifacts: false,
    };

    const first = dispatcher.handle('job.start', params);
    try {
      await expect(dispatcher.handle('job.start', params)).rejects.toMatchObject({
        code: 'job-busy',
      });
    } finally {
      release();
    }

    const result = (await first) as { jobId: string; summary: { stats: { sourceKeys: number } } };
    expect(result.jobId).toMatch(/^job-/);
    expect(result.summary.stats.sourceKeys).toBe(2);
  });
});
