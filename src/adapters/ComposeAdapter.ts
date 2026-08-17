/**
 * Deploys by checking out each ref into its own isolated git worktree,
 * then running `docker compose` there under a unique project name and
 * port — so head and base can run simultaneously without one
 * overwriting or tearing down the other.
 */
import { exec as execCb } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { DeployAdapter } from "./DeployAdapter.js";
import { DeployTimeoutError } from "./DeployAdapter.js";

const exec = promisify(execCb);

export class ComposeAdapter implements DeployAdapter {
  private readonly deployments = new Map<
    string,
    { worktreePath: string; port: number; projectName: string }
  >();
  private nextPort = 4000;

  constructor(private readonly composeFile: string = "docker-compose.yml") {}

  async deploy(ref: string, envFile?: string): Promise<{ previewUrl: string; workingDirectory: string }> {
    const worktreePath = await mkdtemp(join(tmpdir(), "backline-"));
    const projectName = `backline-${ref.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`;
    const port = this.nextPort++;

    // Check out this specific ref into its own folder — the main
    // checkout (and any other deployment's worktree) is untouched.
    await exec(`git worktree add --detach ${worktreePath} ${ref}`);

    const envFlag = envFile ? `--env-file ${envFile}` : "";
    await exec(
      `docker compose -f ${worktreePath}/${this.composeFile} -p ${projectName} ${envFlag} up -d --build`,
      { env: { ...process.env, BACKLINE_PORT: String(port) } },
    );

    this.deployments.set(ref, { worktreePath, port, projectName });
    return { previewUrl: `http://localhost:${port}`, workingDirectory: worktreePath };
  }

  async teardown(ref: string): Promise<void> {
    const deployment = this.deployments.get(ref);
    if (!deployment) return;

    await exec(`docker compose -p ${deployment.projectName} down -v`);
    await exec(`git worktree remove --force ${deployment.worktreePath}`);
    await rm(deployment.worktreePath, { recursive: true, force: true });
    this.deployments.delete(ref);
  }

  async healthCheck(previewUrl: string, path: string, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    const url = `${previewUrl}${path}`;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return;
      } catch {
        // Not up yet — retry.
      }
      await sleep(1000);
    }
    throw new DeployTimeoutError(url, timeoutMs);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
