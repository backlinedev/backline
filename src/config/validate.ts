/**
 * Semantic validation for a `.backline.yml` that has already passed
 * schema validation.
 *
 * @remarks
 * `schema.ts` only checks shape — is this a string, is this one of
 * these enum values. This file checks meaning — does the config make
 * sense given the actual repo it's sitting in. Zod has no way to peek
 * at the filesystem, so anything requiring that lives here instead.
 */
import { access } from "node:fs/promises";
import type { BacklineConfig } from "./schema.js";
import { ConfigError } from "./loader.js";

/**
 * Runs every semantic check against a validated config, collecting
 * *all* problems before failing — not stopping at the first one.
 *
 * @remarks
 * Someone fixing their config wants to see every mistake at once,
 * not discover them one at a time across five separate runs.
 *
 * @param config - A config that has already passed
 * {@link BacklineConfigSchema} validation.
 * @param fileExists - Injected rather than hardcoded to real
 * filesystem access, so this function is testable with fake data
 * instead of a real repo on disk.
 * @throws {@link ConfigError} listing every semantic problem found,
 * if any.
 */
export async function validateConfigSemantics(
  config: BacklineConfig,
  fileExists: (path: string) => Promise<boolean> = defaultFileExists,
): Promise<void> {
  const problems: string[] = [];

  for (const probe of config.probes) {
    if (probe.type === "api" && probe.openapi_spec) {
      if (!(await fileExists(probe.openapi_spec))) {
        problems.push(
          `probe "${probe.name}": openapi_spec "${probe.openapi_spec}" does not exist in this repo`,
        );
      }
    }
    if (probe.type === "cli") {
      if (!(await fileExists(probe.binary))) {
        problems.push(
          `probe "${probe.name}": binary "${probe.binary}" does not exist — did you forget to build it before running Backline?`,
        );
      }
    }
  }

  // Duplicate probe names make the diff-matching logic in the
  // orchestrator (and the base-result cache) ambiguous — two probes
  // can't share a name.
  const seenNames = new Set<string>();
  for (const probe of config.probes) {
    if (seenNames.has(probe.name)) {
      problems.push(`duplicate probe name "${probe.name}" — probe names must be unique`);
    }
    seenNames.add(probe.name);
  }

  if (problems.length > 0) {
    throw new ConfigError(
      `.backline.yml has semantic errors:\n${problems.map((p) => `  - ${p}`).join("\n")}`,
    );
  }
}

/**
 * Default `fileExists` check, backed by the real filesystem.
 *
 * @remarks
 * Only used when the caller doesn't inject their own — real usage
 * (the Action, the CLI) relies on this default; tests typically pass
 * in a fake instead.
 */
async function defaultFileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
