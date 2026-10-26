import { describe, expect, it } from 'vitest';
import type { LangEntry } from '@gt6tg/core';
import {
  CompileCache,
  DirectClient,
  DirectTransport,
  EngineHost,
  hashOutput,
  type Clock,
  type HashProvider,
  type JobProgress,
} from '../src/index';

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
  generators: [{ group: 'dust', namespace: 'S:', dict: { 'Iron Dust': '铁粉' } }],
});

const fakeHash: HashProvider = {
  async sha256Hex(parts) {
    const joined = [...parts].join('');
    return `${joined.length.toString(16).padStart(64, '0')}`;
  },
};

function fakeClock(): Clock {
  let value = 100;
  return {
    now() {
      value += 1;
      return value;
    },
  };
}

function entry(key: string, value: string): LangEntry {
  return { key, value, line: 1 };
}

function createHost(): EngineHost {
  return new EngineHost({ hash: fakeHash, clock: fakeClock(), maxCompiles: 2 });
}

describe('runtime hash', () => {
  it('hashes key\\0value\\n in map order and takes the first 16 chars', async () => {
    const seen: string[] = [];
    const hash: HashProvider = {
      async sha256Hex(parts) {
        for (const part of parts) seen.push(part);
        return 'abcdef0123456789'.padEnd(64, 'f');
      },
    };

    const result = await hashOutput(
      hash,
      new Map([
        ['S:a', '甲'],
        ['S:b', '乙'],
      ]),
    );

    expect(seen).toEqual(['S:a', '\u0000', '甲', '\n', 'S:b', '\u0000', '乙', '\n']);
    expect(result).toBe('abcdef0123456789');
  });
});

describe('compile cache', () => {
  it('evicts the least recently used compile when over capacity', () => {
    const cache = new CompileCache(2);
    const compiled = {} as never;
    const timings = { label: 'compile', totalMs: 0, phases: [] };
    const stats = { topPatterns: 0, allPatterns: 0, maxGroupPatterns: 0, lexEntries: 0 };

    cache.set({ compileId: 'a', compiled, stats, timings, lastUsed: 1 });
    cache.set({ compileId: 'b', compiled, stats, timings, lastUsed: 2 });
    cache.get('a', 3);
    cache.set({ compileId: 'c', compiled, stats, timings, lastUsed: 4 });

    expect(cache.size).toBe(2);
    expect(cache.peek('a')).toBeDefined();
    expect(cache.peek('b')).toBeUndefined();
    expect(cache.peek('c')).toBeDefined();
  });
});

describe('EngineHost', () => {
  it('compiles once and reuses the compileId for unchanged config text', () => {
    const host = createHost();

    const first = host.compile(configText);
    const second = host.compile(configText);

    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.compileId).toBe(first.compileId);
    expect(host.metrics().compileCacheSize).toBe(1);
  });

  it('rejects invalid config with a runtime error', () => {
    const host = createHost();

    expect(() => host.compile('{ "schemaVersion": 2 }')).toThrowError(/配置校验失败/);
  });

  it('runs all entries, falls back, and reports unknown keys', async () => {
    const host = createHost();
    const { compileId } = host.compile(configText);
    const progress: JobProgress[] = [];

    const result = await host.run({
      compileId,
      sourceEntries: [
        entry('S:Iron Dust', 'Iron Dust'),
        entry('S:Unknown', 'Unknown'),
        entry('S:Fallback', 'Fallback'),
      ],
      fallbackEntries: [entry('S:Fallback', '回退')],
      onProgress: (item) => progress.push(item),
    });

    expect(result.output.get('S:Iron Dust')).toBe('铁粉');
    expect(result.output.get('S:Unknown')).toBe('Unknown');
    expect(result.output.get('S:Fallback')).toBe('回退');
    expect([...result.unknown]).toEqual(['S:Unknown']);
    expect(result.summary.stats).toMatchObject({
      sourceKeys: 3,
      outputKeys: 3,
      unknownKeys: 1,
      matchedKeys: 1,
    });
    expect(progress.map((item) => item.phase)).toEqual(['prepare', 'run', 'run', 'done']);
    expect(progress.at(-1)).toMatchObject({ processed: 3, total: 3 });
    expect(result.candidatesByValue.size).toBe(0);
  });

  it('limits a job to an explicit key list', async () => {
    const host = createHost();
    const { compileId } = host.compile(configText);

    const result = await host.run({
      compileId,
      sourceEntries: [
        entry('S:Iron Dust', 'Iron Dust'),
        entry('S:Unknown', 'Unknown'),
      ],
      scope: { kind: 'keys', keys: ['S:Iron Dust'] },
    });

    expect(result.summary.scope).toBe('keys');
    expect(result.summary.requestedKeys).toBe(1);
    expect(result.summary.sourceKeys).toBe(1);
    expect([...result.output.keys()]).toEqual(['S:Iron Dust']);
  });

  it('runs a single entry test with trace data', () => {
    const host = createHost();
    const { compileId } = host.compile(configText);

    const result = host.testEntry({
      compileId,
      targetId: 't',
      key: 'S:Iron Dust',
      value: 'Iron Dust',
    });

    expect(result.targetId).toBe('t');
    expect(result.selected?.target).toBe('铁粉');
    expect(result.unknown).toBe(false);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('tracks and clears compiled cache entries', () => {
    const host = createHost();
    const { compileId } = host.compile(configText);

    expect(host.hasCompiled(compileId)).toBe(true);
    expect(host.metrics().compileIds).toContain(compileId);

    host.clearCache();
    expect(host.hasCompiled(compileId)).toBe(false);
    expect(host.metrics().compileCacheSize).toBe(0);
  });

  it('throws for an unknown compileId', async () => {
    const host = createHost();

    await expect(
      host.run({ compileId: 'missing', sourceEntries: [entry('S:a', 'a')] }),
    ).rejects.toThrowError(/找不到编译结果/);
  });
});

describe('DirectTransport', () => {
  it('round-trips requests and events', async () => {
    const transport = new DirectTransport((method) => {
      if (method === 'metrics.snapshot') {
        return { compileCacheSize: 0, compileIds: [] };
      }
      throw new Error(`unknown method: ${method}`);
    });
    const client = new DirectClient(transport);
    const events: string[] = [];
    client.onEvent((event) => events.push(event.event));

    await expect(client.request('metrics.snapshot', {})).resolves.toEqual({
      compileCacheSize: 0,
      compileIds: [],
    });

    transport.emitEvent('job.progress', {
      jobId: 'job-1',
      phase: 'run',
      processed: 1,
      total: 2,
    });

    expect(events).toEqual(['job.progress']);
    client.close();
  });

  it('preserves structured error codes and rejects requests after close', async () => {
    const failing = new DirectTransport(() => {
      const error = new Error('boom');
      Object.assign(error, { code: 'boom-code', details: { field: 'x' } });
      throw error;
    });
    const failingClient = new DirectClient(failing);

    await expect(failingClient.request('metrics.snapshot', {})).rejects.toMatchObject({
      code: 'boom-code',
      details: { field: 'x' },
    });
    failingClient.close();

    const transport = new DirectTransport(() => ({ compileCacheSize: 0, compileIds: [] }));
    const client = new DirectClient(transport);
    client.close();

    await expect(client.request('metrics.snapshot', {})).rejects.toMatchObject({
      code: 'client-closed',
    });
  });
});
