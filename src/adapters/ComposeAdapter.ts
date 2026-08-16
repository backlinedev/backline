import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import type { DeployAdapter } from "./DeployAdapter.js";
import { DeployTimeoutError } from "./DeployAdapter.js";

const exec = promisify(execCb);

/**
 * Deploys by shelling out to `docker compose`, running wherever this
 * process runs — a GitHub Actions runner, a self-hosted runner, or a
 * developer's own machine for `backline test --local`. No cloud
 * account, no hosted control plane; this is the whole "deploy" step.
 */
export class ComposeAdapter implements DeployAdapter {
  constructor(
    private readonly composeFile: string = "docker-compose.yml",
    private readonly previewPort: number = 4000,
  ) {}

  async deploy(ref: string, envFile?: string): Promise<{ previewUrl: string }> {
    const envFlag = envFile ? `--env-file ${envFile}` : "";
    // A real implementation would checkout `ref` into an isolated worktree
    // first; omitted here since the calling workflow already checks out
    // the right ref before invoking Backline.
    const command = `docker compose -f ${this.composeFile} ${envFlag} up -d --build`;
    console.log(`[ComposeAdapter] running: ${command}`);
    try {
      const { stdout, stderr } = await exec(command);
      console.log(`[ComposeAdapter] stdout:\n${stdout}`);
      if (stderr) console.log(`[ComposeAdapter] stderr:\n${stderr}`);
    } catch (err) {
      console.error(`[ComposeAdapter] docker compose failed:`, err);
      throw err;
    }
    return { previewUrl: `http://localhost:${this.previewPort}` };
  }

  async teardown(_ref: string): Promise<void> {
    await exec(`docker compose -f ${this.composeFile} down -v`);
  }

  async healthCheck(previewUrl: string, path: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const url = `${previewUrl}${path}`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {
        // Not up yet — fall through and retry.
      }
      await sleep(1000);
    }
    throw new DeployTimeoutError(url, timeoutMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
