import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight', () => {
  const n = readNight('runs', '2026-10-28');
  const row = (job: string) => n?.rows.find((r) => r.job === job);

  it('reads 2026-10-28: 5 jobs sorted, 1 bad line', () => {
    expect(n?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(n?.badLines).toBe(1);
  });

  it('keeps retries, failures, null owners and offsets', () => {
    expect(row('fixtures/refresh')).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: 'upstream 503' });
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
    expect(row('digest/render')?.owner).toBeNull();
    expect(row('lane/sync')?.first).toBe('2026-10-28T23:00:06+01:00');
    expect(n?.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
  });

  it('tells no file (null) from an empty file (no rows)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toBeNull();
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', rows: [], badLines: 0, counts: { ok: 0, retry: 0, fail: 0 } });
  });
});
