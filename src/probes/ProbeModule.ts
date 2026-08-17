/**
 * The shared contract every probe type implements.
 *
 * @remarks
 * This is the "port" in the hexagonal-architecture sense — the
 * boundary the orchestrator depends on, satisfied by concrete
 * implementations (`ApiProbe`, `CliProbe`) that the orchestrator
 * never imports directly.
 */
import type { ProbeConfig } from "../config/schema.js";

/**
 * The shape every probe type normalizes its results into, regardless
 * of whether it ran HTTP requests or a CLI binary.
 */
export interface ProbeOutput {
  probeName: string;
  probeType: string;
  /** Populated by `api`-type probes; undefined for `cli`-type ones. */
  requests?: Array<{
    method: string;
    path: string;
    response: { status: number; body: unknown };
  }>;
  /** Populated by `cli`-type probes; undefined for `api`-type ones. */
  commandRuns?: Array<{
    args: string[];
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }>;
  durationMs: number;
  /** Set if the probe itself failed to run — distinct from "diff detected". */
  error?: string;
}

/** Implemented once per probe type, registered in `registry.ts`. */
export interface ProbeModule {
  /**
   * Run this probe and return its result.
   *
   * @param config - The specific probe's config.
   * @param targetUrl - The deployed preview's base URL. An `api`
   * probe sends requests here; a `cli` probe ignores it entirely.
   * @param workingDirectory - The isolated checkout the deployed ref
   * lives in, if the adapter provides one. `ApiProbe` ignores this
   * entirely; `CliProbe` runs its binary from here specifically so it
   * executes that ref's actual code, not whatever's on the shared
   * top-level checkout.
   */
  run(config: ProbeConfig, targetUrl: string, workingDirectory?: string): Promise<ProbeOutput>;
}
