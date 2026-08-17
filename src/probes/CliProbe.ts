/**
 * Runs `cli`-type probes: executes a built binary with each
 * configured argument set, from the deployed ref's own working
 * directory, and captures its output.
 *
 * @remarks
 * Uses `cross-spawn` instead of Node's built-in `child_process.spawn`
 * specifically for correct cross-platform behavior — plain `spawn`
 * has known issues resolving `.cmd` shims and escaping arguments on
 * Windows, which `cross-spawn` handles as a drop-in replacement.
 */
import spawn from "cross-spawn";
import { resolve } from "node:path";
import type { CliProbeConfig, ProbeConfig } from "../config/schema.js";
import type { ProbeModule, ProbeOutput } from "./ProbeModule.js";

interface RunOnceResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export class CliProbe implements ProbeModule {
  async run(
    config: ProbeConfig,
    _targetUrl: string,
    workingDirectory?: string,
  ): Promise<ProbeOutput> {
    if (config.type !== "cli") {
      throw new Error("CliProbe received a non-cli config: " + config.type);
    }
    const cliConfig = config as CliProbeConfig;
    const start = Date.now();
    const commandRuns: ProbeOutput["commandRuns"] = [];
    const cwd = workingDirectory ?? process.cwd();

    // Only resolve paths that actually look like a path (Unix or
    // Windows style) — a bare command name like "node" or "python3"
    // should be resolved from PATH as-is, not joined onto the
    // working directory.
    const looksLikeAPath = /^(\.[\\/]|\.\.[\\/]|[\\/])/.test(cliConfig.binary);
    const resolvedBinary = looksLikeAPath ? resolve(cwd, cliConfig.binary) : cliConfig.binary;

    try {
      for (const command of cliConfig.commands) {
        const result: RunOnceResult = await runOnce(
          resolvedBinary,
          command.args,
          cwd,
          command.stdin ?? undefined,
        );
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

/**
 * Runs one command invocation as a subprocess.
 *
 * @remarks
 * `child.stdout`/`stderr`/`stdin` are typed as possibly `null` by
 * Node's own types — that's only true if `stdio` is explicitly
 * overridden, which never happens here, so the `if (child.stdout)`
 * style checks are just satisfying the type system, not handling a
 * real runtime case.
 */
function runOnce(
  binary: string,
  args: string[],
  cwd: string,
  stdin: string | undefined,
): Promise<RunOnceResult> {
  return new Promise(function (resolvePromise, reject) {
    const child = spawn(binary, args, { timeout: 15000, cwd: cwd });
    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", function (chunk: Buffer) {
        stdout += chunk.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on("data", function (chunk: Buffer) {
        stderr += chunk.toString();
      });
    }
    child.on("error", reject);
    child.on("close", function (exitCode: number | null) {
      resolvePromise({ stdout: stdout, stderr: stderr, exitCode: exitCode });
    });

    if (stdin && child.stdin) {
      child.stdin.write(stdin);
    }
    if (child.stdin) {
      child.stdin.end();
    }
  });
}
