/**
 * Runs `cli`-type probes: executes a built binary with each
 * configured argument set and captures its output.
 */
import { spawn } from "node:child_process";
import type { CliProbeConfig, ProbeConfig } from "../config/schema.js";
import type { ProbeModule, ProbeOutput } from "./ProbeModule.js";

export class CliProbe implements ProbeModule {
  /**
   * @remarks
   * `_targetUrl` is unused — a cli probe runs a local binary, it has
   * no network target. It's still accepted as a parameter to satisfy
   * the shared {@link ProbeModule} interface uniformly across both
   * probe types.
   */
  async run(config: ProbeConfig, _targetUrl: string): Promise<ProbeOutput> {
    if (config.type !== "cli") {
      throw new Error(`CliProbe received a non-cli config: "${config.type}"`);
    }
    const cliConfig = config as CliProbeConfig;
    const start = Date.now();
    const commandRuns: ProbeOutput["commandRuns"] = [];

    try {
      for (const command of cliConfig.commands) {
        const result = await runOnce(cliConfig.binary, command.args, command.stdin ?? undefined);
        commandRuns.push({ args: command.args, ...result });
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
 * Runs one command invocation as a subprocess.
 *
 * @remarks
 * A 15-second timeout is passed directly to `spawn` — if the process
 * hangs (e.g. waiting on stdin that never arrives because `stdin`
 * wasn't configured), it gets killed rather than hanging the whole
 * probe run indefinitely.
 */
function runOnce(
  binary: string,
  args: string[],
  stdin?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { timeout: 15_000 });
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
