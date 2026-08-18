/**
 * Zod schema for `.backline.yml`.
 *
 * @remarks
 * This is the single source of truth for what a valid Backline config
 * looks like. The exported {@link BacklineConfig} type is generated
 * automatically from this schema via `z.infer` — it is never written
 * by hand, so the runtime validation and the TypeScript type can never
 * drift out of sync with each other.
 */
import { z } from "zod";

/**
 * One HTTP request an `api`-type probe fires at the preview instance.
 */
const ApiRequestSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string().min(1),
  body: z.unknown().optional(),
});

/**
 * Diff configuration shared by every probe type.
 *
 * @remarks
 * `ignore_fields` exists specifically to prevent false positives from
 * fields that are expected to change on every run regardless of
 * whether the PR introduced a real behavior change — timestamps,
 * request IDs, and similar noise.
 */
const DiffOptionsSchema = z.object({
  against: z.literal("base_branch").default("base_branch"),
  ignore_fields: z.array(z.string()).default([]),
});

/**
 * An `api` probe: fires a list of HTTP requests at the preview URL and
 * diffs the JSON responses against the base branch.
 */
const ApiProbeSchema = z.object({
  type: z.literal("api"),
  name: z.string().min(1),
  openapi_spec: z.string().optional(),
  requests: z.array(ApiRequestSchema).min(1),
  diff: DiffOptionsSchema.default({ against: "base_branch", ignore_fields: [] }),
});

/**
 * One invocation of a `cli` probe's binary — an argument list, plus
 * optional stdin input for interactive commands.
 */
const CliCommandSchema = z.object({
  args: z.array(z.string()),
  stdin: z.string().nullable().optional(),
});

/**
 * Diff options for `cli` probes.
 *
 * @remarks
 * Extends {@link DiffOptionsSchema} with `normalize` — cleanup steps
 * applied to captured output before diffing, since CLI output tends
 * to contain noise (color codes, timestamps) that `ignore_fields`
 * alone (built for JSON paths) can't address.
 */
const CliDiffOptionsSchema = DiffOptionsSchema.extend({
  normalize: z.array(z.enum(["strip_ansi", "strip_timestamps"])).default([]),
});
// todo: consider adding a `strip_paths` option to remove absolute paths from output, since those are often machine-specific and not relevant to the PR's behavior.
// todo: consider adding a strip_uuid option to remove UUIDs from output, since those are often generated on the fly and not relevant to the PR's behavior.

/**
 * A `cli` probe: runs a built binary with one or more argument sets
 * and diffs the captured stdout against the base branch.
 */
const CliProbeSchema = z.object({
  type: z.literal("cli"),
  name: z.string().min(1),
  binary: z.string().min(1),
  commands: z.array(CliCommandSchema).min(1),
  diff: CliDiffOptionsSchema.default({ against: "base_branch", ignore_fields: [], normalize: [] }),
});

/**
 * A `graphql` probe: runs GraphQL queries against the service.
 */
const GraphQLQuerySchema = z.object({
  query: z.string().min(1),
  variables: z.record(z.any()).optional(),
  operationName: z.string().optional(),
});

const GraphQLProbeSchema = z.object({
  type: z.literal("graphql"),
  name: z.string().min(1),
  endpoint: z.string().min(1),
  queries: z.array(GraphQLQuerySchema).min(1),
  diff: DiffOptionsSchema.default({ against: "base_branch", ignore_fields: [] }),
});

/**
 * A `database` probe: runs SQL queries against a database.
 */
const DatabaseQuerySchema = z.object({
  sql: z.string().min(1),
  params: z.array(z.any()).optional(),
});

const DatabaseProbeSchema = z.object({
  type: z.literal("database"),
  name: z.string().min(1),
  connection: z.string().min(1),
  queries: z.array(DatabaseQuerySchema).min(1),
  diff: DiffOptionsSchema.default({ against: "base_branch", ignore_fields: [] }),
});

/**
 * Discriminated union on `type`.
 *
 * @remarks
 * This is what lets the probe registry pick the right implementation
 * at runtime, and what lets TypeScript automatically narrow between
 * {@link ApiProbeConfig} and {@link CliProbeConfig} wherever a
 * `ProbeConfig`'s `.type` field is checked.
 */
const ProbeConfigSchema = z.discriminatedUnion("type", [
  ApiProbeSchema,
  CliProbeSchema,
  GraphQLProbeSchema,
  DatabaseProbeSchema,
]);

/**
 * A cross-repo dependency this PR needs running alongside it.
 *
 * @remarks
 * Usually an empty list — only relevant when a change spans more than
 * one repository (see the multi-repo preview discussion in
 * `backline-dev-plan.md`).
 */
/**
 * const DependencySchema = z.object({
  repo: z.string().min(1),
  ref: z.string().default("main"),
  required: z.boolean().default(true),
}); scoped for future multi-repo support, not used yet
*/

/**
 * Where the preview is reachable, and how to confirm it's actually
 * ready before probes run against it.
 */
const TargetSchema = z.object({
  base_url: z.string().min(1),
  wait_for: z
    .object({
      path: z.string().default("/health"),
      timeout_seconds: z.number().int().positive().default(120),
    })
    .default({ path: "/health", timeout_seconds: 120 }),
  adapter: z.enum(["compose", "webhook", "pullpreview"]).default("compose"),
});

/**
 * When the preview environment should be torn down.
 *
 * @remarks
 * `idle_timeout_minutes` is a safety net only — cleanup is expected
 * to happen via the `teardown_on` events; the timeout exists in case
 * one of those events is somehow missed.
 */
const LifecycleSchema = z.object({
  teardown_on: z.array(z.enum(["closed"])).default(["closed"]),
  idle_timeout_minutes: z.number().int().positive().default(60),
  /** If set, the Action fails (blocking merge if required) when any probe reports this status or worse. */
  fail_on: z.enum(["never", "diff_detected", "error"]).default("never"),
});

/**
 * The full `.backline.yml` schema.
 *
 * @example
 * ```yaml
 * version: 1
 * target:
 *   base_url: "http://localhost:4000"
 * probes:
 *   - type: api
 *     name: "core API smoke test"
 *     requests:
 *       - method: GET
 *         path: /health
 * ```
 */
export const BacklineConfigSchema = z.object({
  version: z.literal(1),
  target: TargetSchema,
  probes: z.array(ProbeConfigSchema).min(1),
  lifecycle: LifecycleSchema.default({
    teardown_on: ["closed"],
    idle_timeout_minutes: 60,
  }),
});

/** TypeScript type for a validated `api`-type probe, inferred from {@link ApiProbeSchema}. */
export type ApiProbeConfig = z.infer<typeof ApiProbeSchema>;

/** TypeScript type for a validated `cli`-type probe, inferred from {@link CliProbeSchema}. */
export type CliProbeConfig = z.infer<typeof CliProbeSchema>;

/** TypeScript type for a validated `graphql`-type probe, inferred from {@link GraphQLProbeSchema}. */
export type GraphQLProbeConfig = z.infer<typeof GraphQLProbeSchema>;

/** TypeScript type for a validated `database`-type probe, inferred from {@link DatabaseProbeSchema}. */
export type DatabaseProbeConfig = z.infer<typeof DatabaseProbeSchema>;

/** TypeScript type for any validated probe, inferred from {@link ProbeConfigSchema}. */
export type ProbeConfig = z.infer<typeof ProbeConfigSchema>;

/** TypeScript type for a fully validated `.backline.yml`, inferred from {@link BacklineConfigSchema}. */
export type BacklineConfig = z.infer<typeof BacklineConfigSchema>;
