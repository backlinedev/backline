import { describe, it, expect } from "vitest";
import { diffOutputs } from "../src/diff/jsonDiff.js";
import type { ProbeOutput } from "../src/probes/ProbeModule.js";

function makeOutput(body: unknown): ProbeOutput {
  return {
    probeName: "core API smoke test",
    probeType: "api",
    requests: [{ method: "GET", path: "/papers", response: { status: 200, body } }],
    durationMs: 10,
  };
}

describe("diffOutputs", () => {
  it("reports pass when nothing changed", () => {
    const base = makeOutput({ rank_score: 0.8, title: "Climate policy review" });
    const head = makeOutput({ rank_score: 0.8, title: "Climate policy review" });

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.status).toBe("pass");
    expect(result.changedPaths).toHaveLength(0);
  });

  it("detects a changed field and reports its exact path", () => {
    const base = makeOutput({ rank_score: 0.812 });
    const head = makeOutput({ rank_score: 0.941 });

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.status).toBe("diff_detected");
    expect(result.changedPaths).toEqual([
      {
        path: "requests[0].response.body.rank_score",
        before: 0.812,
        after: 0.941,
      },
    ]);
  });

  it("ignores fields matched by an exact ignore path", () => {
    const base = makeOutput({ timestamp: "2026-01-01T00:00:00Z", rank_score: 0.8 });
    const head = makeOutput({ timestamp: "2026-08-15T10:00:00Z", rank_score: 0.8 });

    const result = diffOutputs(base, head, {
      ignorePaths: ["requests[0].response.body.timestamp"],
    });

    expect(result.status).toBe("pass");
  });

  it("ignores fields matched by a wildcard array-index path", () => {
    const base = makeOutput({ timestamp: "2026-01-01T00:00:00Z" });
    const head = makeOutput({ timestamp: "2026-08-15T10:00:00Z" });

    const result = diffOutputs(base, head, {
      ignorePaths: ["requests[*].response.body.timestamp"],
    });

    expect(result.status).toBe("pass");
  });

  it("still detects a real diff alongside an ignored noisy field", () => {
    const base = makeOutput({ timestamp: "2026-01-01T00:00:00Z", rank_score: 0.812 });
    const head = makeOutput({ timestamp: "2026-08-15T10:00:00Z", rank_score: 0.941 });

    const result = diffOutputs(base, head, {
      ignorePaths: ["requests[*].response.body.timestamp"],
    });

    expect(result.status).toBe("diff_detected");
    expect(result.changedPaths).toHaveLength(1);
    expect(result.changedPaths[0].path).toBe("requests[0].response.body.rank_score");
  });

  it("reports error status when either side failed to produce output", () => {
    const base = makeOutput({ ok: true });
    const head: ProbeOutput = { ...makeOutput({}), error: "connection refused" };

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.status).toBe("error");
    expect(result.error).toBe("connection refused");
  });
});

describe("duration regression detection", () => {
  it("does not flag a small timing difference", () => {
    const base = makeOutput({ ok: true });
    base.durationMs = 100;
    const head = makeOutput({ ok: true });
    head.durationMs = 120; // 20% slower — under the 50% threshold

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.status).toBe("pass");
  });

  it("flags a real slowdown past the threshold", () => {
    const base = makeOutput({ ok: true });
    base.durationMs = 100;
    const head = makeOutput({ ok: true });
    head.durationMs = 200; // 100% slower

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.status).toBe("diff_detected");
    expect(result.changedPaths.some((c) => c.path === "durationMs")).toBe(true);
  });

  it("does not flag head being faster than base", () => {
    const base = makeOutput({ ok: true });
    base.durationMs = 200;
    const head = makeOutput({ ok: true });
    head.durationMs = 50;

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.status).toBe("pass");
  });

  it("does not divide by zero when base duration is zero", () => {
    const base = makeOutput({ ok: true });
    base.durationMs = 0;
    const head = makeOutput({ ok: true });
    head.durationMs = 500;

    const result = diffOutputs(base, head, { ignorePaths: [] });

    expect(result.changedPaths.some((c) => c.path === "durationMs")).toBe(false);
  });
});
