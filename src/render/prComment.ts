/**
 * Builds two separate outputs from a run's diff results: a short PR
 * comment (status table, badges, a link to the full report) and a
 * longer, detailed Job Summary (every field, every value).
 *
 * @remarks
 * Kept as two functions rather than one, because a PR comment should
 * stay short enough to skim in the conversation view, while the full
 * detail belongs somewhere a reviewer deliberately clicks into — the
 * GitHub Actions Job Summary, which renders as its own dedicated,
 * full-width page with zero new infrastructure required.
 */
import type { DiffResult } from "../diff/jsonDiff.js";

const BADGE_STYLE: Record<DiffResult["status"], { label: string; color: string }> = {
  pass: { label: "pass", color: "brightgreen" },
  diff_detected: { label: "diff detected", color: "yellow" },
  error: { label: "error", color: "red" },
};

function statusBadge(status: DiffResult["status"]): string {
  const { label, color } = BADGE_STYLE[status];
  const encodedLabel = encodeURIComponent(label);
  return `![${label}](https://img.shields.io/badge/status-${encodedLabel}-${color})`;
}

/**
 * The short comment posted on the PR itself.
 *
 * @param results - Diff results, one per configured probe. Expected
 * to already be scrubbed via `scrubSecrets` before reaching here.
 * @param reportUrl - Link to the full Job Summary for this run.
 * Omitted entirely if not provided (e.g. a local CLI run has nowhere
 * to link to).
 */
export function renderPrComment(results: DiffResult[], reportUrl?: string): string {
  const lines: string[] = [];

  lines.push(`### Backline results — ${results.length} probe${results.length === 1 ? "" : "s"}`);
  lines.push("");
  lines.push("| Probe | Status |");
  lines.push("|---|---|");
  for (const result of results) {
    lines.push(`| ${result.probeName} | ${statusBadge(result.status)} |`);
  }
  lines.push("");

  if (reportUrl) {
    lines.push(`[View full diff report](${reportUrl})`);
  }

  return lines.join("\n");
}

/**
 * The full, detailed report written to `$GITHUB_STEP_SUMMARY`.
 *
 * @remarks
 * This is where every changed field and its before/after value lives
 * — the PR comment intentionally doesn't carry this much detail
 * inline, to stay skimmable.
 */
export function renderJobSummary(results: DiffResult[]): string {
  const lines: string[] = [];

  lines.push(`# Backline — full diff report`);
  lines.push("");

  for (const result of results) {
    lines.push(`## ${result.probeName} — ${result.status.replace("_", " ")}`);
    lines.push("");

    if (result.status === "pass") {
      lines.push("No differences detected.");
    } else if (result.status === "error") {
      lines.push(`Failed to run: ${result.error}`);
    } else {
      lines.push("| Field | Base | Head |");
      lines.push("|---|---|---|");
      for (const change of result.changedPaths) {
        lines.push(`| \`${change.path}\` | ${stringify(change.before)} | ${stringify(change.after)} |`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}
