/**
 * For anyone who already has a deploy pipeline (Uffizzi, Fly.io, a
 * custom script) and just wants Backline to consume the resulting URL.
 *
 * @remarks
 * CLI probes are meaningfully limited with this adapter: there is no
 * per-ref isolated checkout to run a binary from, so `workingDirectory`
 * is always the current process directory. A webhook-deployed target
 * is only reliably diffable via `api` probes.
 */
import type { DeployAdapter } from "./DeployAdapter.js";
import { DeployTimeoutError } from "./DeployAdapter.js";

interface WebhookDeployResponse {
  preview_url: string;
}

export class WebhookAdapter implements DeployAdapter {
  constructor(
    private readonly deployWebhookUrl: string,
    private readonly teardownWebhookUrl?: string,
  ) {}

  async deploy(ref: string): Promise<{ previewUrl: string; workingDirectory: string }> {
    const res = await fetch(this.deployWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref }),
    });
    if (!res.ok) {
      throw new Error(`Deploy webhook returned ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as WebhookDeployResponse;
    if (!body.preview_url) {
      throw new Error(`Deploy webhook response missing "preview_url" field`);
    }
    return { previewUrl: body.preview_url, workingDirectory: process.cwd() };
  }

  async teardown(ref: string): Promise<void> {
    if (!this.teardownWebhookUrl) return;
    await fetch(this.teardownWebhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ref }),
    });
  }

  async healthCheck(previewUrl: string, path: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const url = `${previewUrl}${path}`;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {
        // retry
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new DeployTimeoutError(url, timeoutMs);
  }
}
