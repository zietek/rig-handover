// Plan morning-digest § 1. The contract every part of § 2 builds on.

export type Status = 'ok' | 'retry' | 'fail';

// One row per job in a night's log. Times are the log's own `at` strings, offset kept.
export type DigestRow = {
  job: string;
  owner: string | null; // null in the log stays null; views show it as '—'
  runs: number; // log lines for this job, any status
  retries: number; // log lines for this job with status 'retry'
  lastStatus: Status; // status of the job's last line in the log
  lastError: string | null; // most recent `error` on any of the job's lines, null if none
  first: string; // `at` of the job's first line in the log
  last: string; // `at` of the job's last line in the log
};

// Count of valid log lines by status (not of jobs). Bad lines are not in it.
export type StatusCounts = Record<Status, number>;

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job; empty for an empty file ("nothing ran")
  badLines: number; // non-blank lines that didn't parse or didn't match the shape
  counts: StatusCounts;
};

// Reads <runsDir>/<night>.jsonl. Returns null when there is no such file (or the night isn't
// YYYY-MM-DD): that is the 404. An empty file returns a Night with no rows. Never throws on
// a bad line.
export type ReadNight = (runsDir: string, night: string) => Night | null;
