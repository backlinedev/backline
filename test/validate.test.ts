import { describe, it, expect } from "vitest";
import { validateConfigSemantics } from "../src/config/validate.js";
import { ConfigError } from "../src/config/loader.js";
import { BacklineConfigSchema, type BacklineConfig } from "../src/config/schema.js";

function parse(raw: unknown): BacklineConfig {
  return BacklineConfigSchema.parse(raw);
}

const alwaysExists = async () => true;
const neverExists = async () => false;

describe("validateConfigSemantics", () => {
  it("passes when every referenced file exists and probe names are unique", async () => {
    const config = parse({
      version: 1,
      target: { base_url: "http://localhost:4000" },
      probes: [
        { type: "api", name: "probe one", requests: [{ method: "GET", path: "/health" }] },
        {
          type: "cli",
          name: "probe two",
          binary: "./dist/mycli",
          commands: [{ args: ["--version"] }],
        },
      ],
    });

    await expect(validateConfigSemantics(config, alwaysExists)).resolves.toBeUndefined();
  });

  it("throws a ConfigError when a cli probe's binary does not exist", async () => {
    const config = parse({
      version: 1,
      target: { base_url: "http://localhost:4000" },
      probes: [
        {
          type: "cli",
          name: "missing binary check",
          binary: "./dist/does-not-exist",
          commands: [{ args: ["--version"] }],
        },
      ],
    });

    await expect(validateConfigSemantics(config, neverExists)).rejects.toBeInstanceOf(ConfigError);
  });

  it("throws when an api probe's openapi_spec does not exist", async () => {
    const config = parse({
      version: 1,
      target: { base_url: "http://localhost:4000" },
      probes: [
        {
          type: "api",
          name: "spec check",
          openapi_spec: "./openapi.yaml",
          requests: [{ method: "GET", path: "/health" }],
        },
      ],
    });

    await expect(validateConfigSemantics(config, neverExists)).rejects.toBeInstanceOf(ConfigError);
  });

  it("does not check for an openapi_spec file when none was configured", async () => {
    const config = parse({
      version: 1,
      target: { base_url: "http://localhost:4000" },
      probes: [{ type: "api", name: "no spec here", requests: [{ method: "GET", path: "/health" }] }],
    });

    await expect(validateConfigSemantics(config, neverExists)).resolves.toBeUndefined();
  });

  it("throws when two probes share the same name", async () => {
    const config = parse({
      version: 1,
      target: { base_url: "http://localhost:4000" },
      probes: [
        { type: "api", name: "duplicate", requests: [{ method: "GET", path: "/a" }] },
        { type: "api", name: "duplicate", requests: [{ method: "GET", path: "/b" }] },
      ],
    });

    await expect(validateConfigSemantics(config, alwaysExists)).rejects.toBeInstanceOf(ConfigError);
  });

  it("collects every problem in a single error rather than stopping at the first", async () => {
    const config = parse({
      version: 1,
      target: { base_url: "http://localhost:4000" },
      probes: [
        {
          type: "cli",
          name: "same name",
          binary: "./dist/missing",
          commands: [{ args: ["--version"] }],
        },
        { type: "api", name: "same name", requests: [{ method: "GET", path: "/health" }] },
      ],
    });

    try {
      await validateConfigSemantics(config, neverExists);
      throw new Error("expected validateConfigSemantics to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      const message = (err as ConfigError).message;
      expect(message).toContain("does not exist");
      expect(message).toContain("duplicate probe name");
    }
  });
});
