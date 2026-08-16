import type { DeployAdapter } from "./DeployAdapter.js";
import { DeployTimeoutError } from "./DeployAdapter.js";

interface WebhookDeployResponse {
  preview_url: string;
}

/**
 * For anyone who already has a deploy pipeline (Uffizzi, Fly.io, a
 * custom script) and just wants Backline to consume the resulting
 * URL. POSTs { ref } to a configured endpoint and expects
 * { preview_url } back — that's the entire contract, deliberately
 * as small as possible so it works with almost anything.
 */
export class WebhookAdapter implements DeployAdapter {
  constructor(
    private readonly deployWebhookUrl: string,
    private readonly teardownWebhookUrl?: string,
  ) {}

  async deploy(ref: string): Promise<{ previewUrl: string }> {
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
    return { previewUrl: body.preview_url };
  }

  async teardown(ref: string): Promise<void> {
    if (!this.teardownWebhookUrl) return; // teardown is optional for this adapter
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
