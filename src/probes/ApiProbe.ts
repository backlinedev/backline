/**
 * Runs `api`-type probes: fires each configured HTTP request at the
 * preview URL and captures the response.
 */
import type { ApiProbeConfig, ProbeConfig } from "../config/schema.js";
import type { ProbeModule, ProbeOutput } from "./ProbeModule.js";

export class ApiProbe implements ProbeModule {
  /**
   * @remarks
   * Continues capturing whatever requests succeeded even if a later
   * one in the list throws — the caught error is attached to the
   * whole {@link ProbeOutput} so the diff engine reports it as
   * `"error"` rather than silently returning partial, misleading data.
   */
  async run(config: ProbeConfig, targetUrl: string): Promise<ProbeOutput> {
    if (config.type !== "api") {
      throw new Error(`ApiProbe received a non-api config: "${config.type}"`);
    }
    const apiConfig = config as ApiProbeConfig;
    const start = Date.now();
    const requests: ProbeOutput["requests"] = [];

    try {
      for (const req of apiConfig.requests) {
        const url = `${targetUrl}${req.path}`;
        const res = await fetch(url, {
          method: req.method,
          headers: req.body ? { "content-type": "application/json" } : undefined,
          body: req.body ? JSON.stringify(req.body) : undefined,
          signal: AbortSignal.timeout(15_000),
        });

        let body: unknown;
        const contentType = res.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          body = await res.json().catch(() => null);
        } else {
          body = await res.text();
        }

        requests.push({
          method: req.method,
          path: req.path,
          response: { status: res.status, body },
        });
      }

      return {
        probeName: apiConfig.name,
        probeType: "api",
        requests,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        probeName: apiConfig.name,
        probeType: "api",
        requests,
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }
}
