import { describe, it, expect } from "vitest";
import { BacklineConfigSchema } from "../src/config/schema.js";

const validApiProbe = {
  type: "api",
  name: "core API smoke test",
  requests: [{ method: "GET", path: "/health" }],
};

const validCliProbe = {
  type: "cli",
  name: "CLI version check",
  binary: "./dist/mycli",
  commands: [{ args: ["--version"] }],
};

function minimalConfig(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    target: { base_url: "http://localhost:4000" },
    probes: [validApiProbe],
    ...overrides,
  };
}

describe("BacklineConfigSchema — valid configs", () => {
  it("accepts a minimal valid config and fills in every default", () => {
    const result = BacklineConfigSchema.safeParse(minimalConfig());

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.target.wait_for).toEqual({ path: "/health", timeout_seconds: 120 });
    expect(result.data.target.adapter).toBe("compose");
    expect(result.data.lifecycle).toEqual({
      teardown_on: ["closed"],
      idle_timeout_minutes: 60,
      fail_on: "never",
    });
  });

  it("accepts an api probe and a cli probe in the same probes list", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({ probes: [validApiProbe, validCliProbe] }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.probes).toHaveLength(2);
    expect(result.data.probes[0].type).toBe("api");
    expect(result.data.probes[1].type).toBe("cli");
  });

  it("fills in api probe diff defaults when diff is omitted", () => {
    const result = BacklineConfigSchema.safeParse(minimalConfig());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.probes[0]).toMatchObject({
      diff: { against: "base_branch", ignore_fields: [] },
    });
  });

  it("fills in cli probe diff defaults including normalize", () => {
    const result = BacklineConfigSchema.safeParse(minimalConfig({ probes: [validCliProbe] }));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.probes[0]).toMatchObject({
      diff: { against: "base_branch", ignore_fields: [], normalize: [] },
    });
  });

  it("respects an explicitly provided wait_for, overriding only what's given", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({
        target: { base_url: "http://localhost:4000", wait_for: { path: "/status" } },
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.target.wait_for).toEqual({ path: "/status", timeout_seconds: 120 });
  });

  it("accepts a fully specified lifecycle, including a non-default fail_on", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({
        lifecycle: { teardown_on: ["closed"], idle_timeout_minutes: 30, fail_on: "diff_detected" },
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.lifecycle.fail_on).toBe("diff_detected");
  });
});

describe("BacklineConfigSchema — rejections", () => {
  it("rejects a version other than 1", () => {
    const result = BacklineConfigSchema.safeParse(minimalConfig({ version: 2 }));
    expect(result.success).toBe(false);
  });

  it("rejects a config with an empty probes list", () => {
    const result = BacklineConfigSchema.safeParse(minimalConfig({ probes: [] }));
    expect(result.success).toBe(false);
  });

  it("rejects a config missing target entirely", () => {
    const { target, ...withoutTarget } = minimalConfig();
    const result = BacklineConfigSchema.safeParse(withoutTarget);
    expect(result.success).toBe(false);
  });

  it("rejects an unknown probe type", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({ probes: [{ ...validApiProbe, type: "banana" }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an api probe with an invalid HTTP method", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({
        probes: [{ ...validApiProbe, requests: [{ method: "GTE", path: "/health" }] }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an api probe with zero requests", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({ probes: [{ ...validApiProbe, requests: [] }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a cli probe missing binary", () => {
    const { binary, ...withoutBinary } = validCliProbe;
    const result = BacklineConfigSchema.safeParse(minimalConfig({ probes: [withoutBinary] }));
    expect(result.success).toBe(false);
  });

  it("rejects an unknown target.adapter value", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({ target: { base_url: "http://localhost:4000", adapter: "kubernetes" } }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown cli normalize operation", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({
        probes: [{ ...validCliProbe, diff: { normalize: ["strip_everything"] } }],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects an unknown lifecycle.fail_on value", () => {
    const result = BacklineConfigSchema.safeParse(
      minimalConfig({ lifecycle: { fail_on: "always" } }),
    );
    expect(result.success).toBe(false);
  });
});
