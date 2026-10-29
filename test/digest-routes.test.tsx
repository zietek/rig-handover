import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const config = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: 'runs' };

const GOOD = '2026-01-01';
const EMPTY = '2026-01-02';
const BAD = '2026-01-03';
const MISSING = '2026-01-04';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error !== undefined && { error }) });

let tmp: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rig-digest-'));
  // Jobs deliberately out of order in the file; the digest sorts by job.
  fs.writeFileSync(
    path.join(tmp, `${GOOD}.jsonl`),
    [
      line('2026-01-01T02:00:00+01:00', 'zeta-sync', 'ok', 'ola'),
      line('2026-01-01T02:05:00+01:00', 'alpha-backup', 'retry', null, 'timeout'),
      line('2026-01-01T02:10:00+01:00', 'alpha-backup', 'ok', null),
      line('2026-01-01T02:15:00+01:00', 'mid-report', 'fail', 'kasia', 'boom'),
    ].join('\n') + '\n',
  );
  fs.writeFileSync(path.join(tmp, `${EMPTY}.jsonl`), '');
  fs.writeFileSync(
    path.join(tmp, `${BAD}.jsonl`),
    [line('2026-01-03T02:00:00+01:00', 'only-job', 'ok', 'ola'), 'this is not json'].join('\n') + '\n',
  );
  app = createApp({ ...config, runsDir: tmp });
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders a good night', async () => {
    const res = await app.request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('alpha-backup');
    expect(html).toContain('—');
  });

  it('404s for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders a night with a bad line', async () => {
    const res = await app.request(`/digest/${BAD}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('only-job');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the Night for a good night', async () => {
    const res = await app.request(`/api/digest/${GOOD}`);
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.night).toBe(GOOD);
    expect(night.rows.map((r) => r.job)).toEqual(['alpha-backup', 'mid-report', 'zeta-sync']);
    expect(night.rows[0]?.owner).toBeNull();
    expect(night.badLines).toBe(0);
    expect(night.counts).toEqual({ ok: 2, retry: 1, fail: 1 });
  });

  it('404s for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
  });

  it('returns no rows for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.rows).toEqual([]);
    expect(night.badLines).toBe(0);
  });

  it('counts the bad line and still answers 200', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows.map((r) => r.job)).toEqual(['only-job']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const night = (await (await app.request(`/api/digest/${GOOD}`)).json()) as Night;
    const html = await (await app.request(`/digest/${GOOD}`)).text();
    const jobs = night.rows.map((r) => r.job);
    const positions = jobs.map((j) => html.indexOf(j));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
