/**
 * Runs `cli`-type probes: executes a built binary with each
 * configured argument set, from the deployed ref's own working
 * directory, and captures its output.
 */
import { spawn } from "node:child_process";
import { resolve, isAbsolute } from "node:path";
import type { CliProbeConfig, ProbeConfig } from "../config/schema.js";
import type { ProbeModule, ProbeOutput } from "./ProbeModule.js";

export class CliProbe implements ProbeModule {
  async run(config: ProbeConfig, _targetUrl: string, workingDirectory?: string): Promise<ProbeOutput> {
    if (config.type !== "cli") {
      throw new Error(`CliProbe received a non-cli config: "${config.type}"`);
    }
    const cliConfig = config as CliProbeConfig;
    const start = Date.now();
    const commandRuns: ProbeOutput["commandRuns"] = [];
    const cwd = workingDirectory ?? process.cwd();
    // Resolve a relative binary path against the ref's own checkout, so
    // "./dist/mycli" means that ref's build output, not whatever's
    // sitting in the shared top-level checkout.
    const resolvedBinary = isAbsolute(cliConfig.binary)
      ? cliConfig.binary
      : resolve(cwd, cliConfig.binary);

    try {
      for (const command of cliConfig.commands) {
        const result = await runOnce(resolvedBinary, command.args, cwd, command.stdin ?? undefined);
        commandRuns.push({
          args: command.args,
          stdout: normalize(result.stdout, cliConfig.diff.normalize),
          stderr: normalize(result.stderr, cliConfig.diff.normalize),
          exitCode: result.exitCode,
        });
      }

      return {
        probeName: cliConfig.name,
        probeType: "cli",
        commandRuns,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        probeName: cliConfig.name,
        probeType: "cli",
        commandRuns,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }
}

/**
 * Applies each configured cleanup operation to captured text before
 * it reaches the diff engine — this is what makes `normalize:` in
 * `.backline.yml` actually do something, rather than just being
 * declared and silently ignored.
 */
function normalize(text: string, operations: ("strip_ansi" | "strip_timestamps")[]): string {
  let result = text;
  for (const op of operations) {
    if (op === "strip_ansi") {
      result = result.replace(/\x1b\[[0-9;]*m/g, "");
    }
    if (op === "strip_timestamps") {
      result = result.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, "[timestamp]");
    }
  }
  return result;
}

function runOnce(
  binary: string,
  args: string[],
  cwd: string,
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { timeout: 15_000, cwd });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));

    if (stdin) {
      child.stdin.write(stdin);
    }
    child.stdin.end();
  });
}
