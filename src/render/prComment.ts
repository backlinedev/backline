/**
 * Builds two separate outputs from a run's diff results: a short PR
 * comment (status table, badges, a link to the full report) and a
 * longer, detailed Job Summary (every field, every value).
 *
 * @remarks
 * Enhanced with syntax highlighting, collapsible sections, and
 * side-by-side diffs for better visual clarity.
 */
import type { DiffResult } from "../diff/jsonDiff.js";

const BADGE_STYLE: Record<DiffResult["status"], { label: string; color: string; emoji: string }> = {
  pass: { label: "pass", color: "brightgreen", emoji: "✓" },
  diff_detected: { label: "diff detected", color: "yellow", emoji: "⚠" },
  error: { label: "error", color: "red", emoji: "✗" },
};

function statusBadge(status: DiffResult["status"]): string {
  const { label, color, emoji } = BADGE_STYLE[status];
  const encodedLabel = encodeURIComponent(label);
  return `${emoji} ![${label}](https://img.shields.io/badge/status-${encodedLabel}-${color})`;
}

/**
 * The short comment posted on the PR itself.
 */
export function renderPrComment(results: DiffResult[], reportUrl?: string): string {
  const lines: string[] = [];

  const passCount = results.filter(r => r.status === 'pass').length;
  const diffCount = results.filter(r => r.status === 'diff_detected').length;
  const errorCount = results.filter(r => r.status === 'error').length;

  lines.push(`### Backline Results`);
  lines.push("");

  if (diffCount > 0 || errorCount > 0) {
    lines.push(`<details open>`);
    lines.push(`<summary><strong>${diffCount + errorCount} issue${diffCount + errorCount === 1 ? '' : 's'} detected</strong> (${passCount} passing)</summary>`);
    lines.push("");
  }

  lines.push("| Probe | Status | Changes |");
  lines.push("|---|---|---|");
  for (const result of results) {
    const changeCount = result.status === 'diff_detected' ? result.changedPaths.length : 0;
    const changeText = changeCount > 0 ? `${changeCount} field${changeCount === 1 ? '' : 's'}` : '—';
    lines.push(`| ${result.probeName} | ${statusBadge(result.status)} | ${changeText} |`);
  }

  if (diffCount > 0 || errorCount > 0) {
    lines.push("");
    lines.push(`</details>`);
  }

  lines.push("");

  if (reportUrl) {
    lines.push(`[📊 View detailed diff report](${reportUrl})`);
  }

  return lines.join("\n");
}

/**
 * The full, detailed report written to `$GITHUB_STEP_SUMMARY`.
 *
 * @remarks
 * Enhanced with syntax-highlighted JSON, collapsible sections,
 * and side-by-side comparison.
 */
export function renderJobSummary(results: DiffResult[]): string {
  const lines: string[] = [];

  lines.push(`# Backline — Detailed Diff Report`);
  lines.push("");

  const summary = getSummary(results);
  lines.push(`**${summary.passed}** passed · **${summary.changed}** changed · **${summary.failed}** failed`);
  lines.push("");

  for (const result of results) {
    const { emoji } = BADGE_STYLE[result.status];

    lines.push(`<details${result.status !== 'pass' ? ' open' : ''}>`);
    lines.push(`<summary><h2>${emoji} ${result.probeName}</h2></summary>`);
    lines.push("");

    if (result.status === "pass") {
      lines.push("✓ No differences detected.");
    } else if (result.status === "error") {
      lines.push("```");
      lines.push(`Error: ${result.error}`);
      lines.push("```");
    } else {
      lines.push("### Changed Fields");
      lines.push("");

      for (const change of result.changedPaths) {
        lines.push(`#### \`${change.path}\``);
        lines.push("");
        lines.push("<table>");
        lines.push("<tr><th>Base Branch</th><th>PR Branch</th></tr>");
        lines.push("<tr>");
        lines.push("<td>");
        lines.push("");
        lines.push("```json");
        lines.push(formatValue(change.before));
        lines.push("```");
        lines.push("");
        lines.push("</td>");
        lines.push("<td>");
        lines.push("");
        lines.push("```json");
        lines.push(formatValue(change.after));
        lines.push("```");
        lines.push("");
        lines.push("</td>");
        lines.push("</tr>");
        lines.push("</table>");
        lines.push("");
      }
    }

    lines.push("</details>");
    lines.push("");
  }

  return lines.join("\n");
}

function getSummary(results: DiffResult[]): { passed: number; changed: number; failed: number } {
  return {
    passed: results.filter(r => r.status === 'pass').length,
    changed: results.filter(r => r.status === 'diff_detected').length,
    failed: results.filter(r => r.status === 'error').length,
  };
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
