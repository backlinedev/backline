/**
 * Structural diff between two `ProbeOutput`s.
 *
 * @remarks
 * This is the actual reason Backline exists — everything else in the
 * system exists to get two things worth comparing into this
 * function's hands. Pure, dependency-free logic: given the same
 * inputs, always the same output, nothing external involved.
 */
import type { ProbeOutput } from "../probes/ProbeModule.js";

/** Configuration for how a diff should be run. */
export interface DiffOptions {
  /**
   * Dot/bracket paths to ignore, e.g.
   * `"requests[0].response.body.timestamp"`, or a wildcard array index
   * like `"requests[*].response.body.timestamp"` to cover every item
   * in a list at once.
   */
  ignorePaths: string[];
}

/** One field that differs between the base and head outputs. */
export interface ChangedPath {
  path: string;
  before: unknown;
  after: unknown;
}

/** The result of comparing one probe's base output against its head output. */
export interface DiffResult {
  probeName: string;
  status: "pass" | "diff_detected" | "error";
  changedPaths: ChangedPath[];
  error?: string;
}

/**
 * How much slower (as a fraction of base's duration) head must be
 * before it's flagged as a real regression rather than ordinary
 * run-to-run timing noise. 0.5 means head must take at least 50%
 * longer than base to be reported.
 */
const DURATION_REGRESSION_THRESHOLD = 0.5;

/**
 * Compares a base-branch {@link ProbeOutput} against a head-branch one.
 *
 * @remarks
 * If either side recorded an error (the probe itself failed to run),
 * this reports `"error"` rather than attempting a comparison — never
 * silently reports `"pass"` when there was nothing trustworthy to
 * compare in the first place.
 *
 * @param base - The probe's output when run against the base branch.
 * @param head - The probe's output when run against the head branch.
 * @param options - Which field paths to ignore when comparing.
 * @returns A {@link DiffResult} describing what, if anything, changed.
 */
export function diffOutputs(
  base: ProbeOutput,
  head: ProbeOutput,
  options: DiffOptions = { ignorePaths: [] },
): DiffResult {
  if (base.error || head.error) {
    return {
      probeName: head.probeName,
      status: "error",
      changedPaths: [],
      error: head.error ?? base.error,
    };
  }

  const changedPaths: ChangedPath[] = [];
  const ignoreSet = new Set(options.ignorePaths);

  const rootField = base.requests || head.requests ? "requests" : "commandRuns";
  const beforeList = base.requests ?? base.commandRuns ?? [];
  const afterList = head.requests ?? head.commandRuns ?? [];

  collectDiffs(beforeList, afterList, rootField, ignoreSet, changedPaths);

  if (base.durationMs > 0) {
    const slowdownRatio = (head.durationMs - base.durationMs) / base.durationMs;
    if (slowdownRatio > DURATION_REGRESSION_THRESHOLD) {
      changedPaths.push({
        path: "durationMs",
        before: `${base.durationMs}ms`,
        after: `${head.durationMs}ms`,
      });
    }
  }

  return {
    probeName: head.probeName,
    status: changedPaths.length > 0 ? "diff_detected" : "pass",
    changedPaths,
  };
}

/**
 * Recursively walks two values in parallel, building a JSON-path-like
 * string as it goes (e.g. "[0].response.body.rank_score"), and records
 * a {@link ChangedPath} wherever the values differ — unless that exact
 * path (or a wildcard match, see {@link pathIsIgnored}) is in the
 * ignore set.
 */
function collectDiffs(
  before: unknown,
  after: unknown,
  path: string,
  ignoreSet: Set<string>,
  out: ChangedPath[],
): void {
  if (pathIsIgnored(path, ignoreSet)) return;

  if (Array.isArray(before) && Array.isArray(after)) {
    const maxLen = Math.max(before.length, after.length);
    for (let i = 0; i < maxLen; i++) {
      collectDiffs(before[i], after[i], `${path}[${i}]`, ignoreSet, out);
    }
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    for (const key of keys) {
      const childPath = path ? `${path}.${key}` : key;
      collectDiffs(
        (before as Record<string, unknown>)[key],
        (after as Record<string, unknown>)[key],
        childPath,
        ignoreSet,
        out,
      );
    }
    return;
  }

  if (!deepEqual(before, after)) {
    out.push({ path: path || "(root)", before, after });
  }
}

/**
 * Supports exact matches ("requests[0].response.body.timestamp") and a
 * single trailing wildcard segment ("requests[*].response.body.timestamp")
 * so one ignore rule covers every item in an array of requests.
 */
function pathIsIgnored(path: string, ignoreSet: Set<string>): boolean {
  if (ignoreSet.has(path)) return true;
  const wildcardPath = path.replace(/\[\d+\]/g, "[*]");
  return ignoreSet.has(wildcardPath);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}
