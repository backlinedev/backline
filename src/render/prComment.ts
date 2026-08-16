import type { DiffResult } from "../diff/jsonDiff.js";

const STATUS_LABEL: Record<DiffResult["status"], string> = {
  pass: "✅ pass",
  diff_detected: "⚠️ diff detected",
  error: "❌ error",
};

/**
 * Pure string templating — no logic beyond "loop over results, format
 * a table row, format a diff block for anything that changed." Kept
 * separate from secretScrub.ts so this file never has to think about
 * redaction; by the time results reach here, they're already clean.
 */
export function renderPrComment(results: DiffResult[], consoleUrl?: string): string {
  const lines: string[] = [];

  lines.push(`### Backline results — ${results.length} probe${results.length === 1 ? "" : "s"}`);
  lines.push("");
  lines.push("| Probe | Status |");
  lines.push("|---|---|");
  for (const result of results) {
    lines.push(`| ${result.probeName} | ${STATUS_LABEL[result.status]} |`);
  }
  lines.push("");

  for (const result of results) {
    if (result.status === "diff_detected") {
      lines.push(`<details>`);
      lines.push(`<summary>diff — ${result.probeName}</summary>`);
      lines.push("");
      lines.push("```diff");
      for (const change of result.changedPaths) {
        lines.push(`- ${change.path}: ${stringify(change.before)}`);
        lines.push(`+ ${change.path}: ${stringify(change.after)}`);
      }
      lines.push("```");
      lines.push(`</details>`);
      lines.push("");
    }
    if (result.status === "error") {
      lines.push(`> **${result.probeName}** failed to run: ${result.error}`);
      lines.push("");
    }
  }

  if (consoleUrl) {
    lines.push(`[Open interactive console](${consoleUrl})`);
  }

  return lines.join("\n");
}

function stringify(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  return JSON.stringify(value);
}
