/**
 * Maps a probe's `type` string to its implementation.
 *
 * @remarks
 * This is the composition root for probes — the one place allowed to
 * know about concrete classes like `ApiProbe`/`CliProbe`. Adding a
 * new probe type (e.g. `graphql`, `pipeline`) means writing a class
 * implementing {@link ProbeModule} and adding one line here — nothing
 * in the orchestrator, the diff engine, or the renderer needs to
 * change, since they only ever operate on the generic
 * {@link ProbeOutput} shape.
 */
import type { ProbeModule } from "./ProbeModule.js";
import { ApiProbe } from "./ApiProbe.js";
import { CliProbe } from "./CliProbe.js";
import { GraphQLProbe } from "./GraphQLProbe.js";
import { DatabaseProbe } from "./DatabaseProbe.js";

export const probeRegistry: Record<string, ProbeModule> = {
  api: new ApiProbe(),
  cli: new CliProbe(),
  graphql: new GraphQLProbe(),
  database: new DatabaseProbe(),
};

/**
 * Looks up the right {@link ProbeModule} for a given probe `type`.
 *
 * @throws Error if `type` doesn't match any registered probe type —
 * this is a real, user-facing failure mode (a typo in `.backline.yml`
 * that somehow got past schema validation, or a config written for a
 * probe type that isn't implemented yet), so the message lists what's
 * actually available.
 */
export function resolveProbe(type: string): ProbeModule {
  const probe = probeRegistry[type];
  if (!probe) {
    throw new Error(
      `Unknown probe type "${type}". Known types: ${Object.keys(probeRegistry).join(", ")}`,
    );
  }
  return probe;
}
