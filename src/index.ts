import { readFileSync } from "node:fs";
import { appendFile } from "node:fs/promises";
import * as core from "@actions/core";
import { loadConfigFromFile } from "./config/loader.js";
import { validateConfigSemantics } from "./config/validate.js";
import type { DeployAdapter } from "./adapters/DeployAdapter.js";
import { ComposeAdapter } from "./adapters/ComposeAdapter.js";
import { WebhookAdapter } from "./adapters/WebhookAdapter.js";
import { FileCacheStore } from "./cache/FileCacheStore.js";
import { GitHubClient } from "./github/octokitClient.js";
import { runBackline } from "./orchestrator.js";

/**
 * This file is what actually runs inside the user's own CI job — it
 * never runs on any server of ours. See action.yml for the declared
 * inputs this reads via @actions/core.
 */
async function main(): Promise<void> {
  try {
    const configPath = core.getInput("config") || ".backline.yml";
    const token = core.getInput("github-token", { required: true });

    const config = await loadConfigFromFile(configPath);
    await validateConfigSemantics(config);

    // The composition root for adapters — the one place allowed to know
    // about concrete adapter classes. Adding a new adapter later means
    // adding one line here, without touching how it's selected or used
    // anywhere else.
    const adapterRegistry: Record<string, () => DeployAdapter> = {
      compose: () => new ComposeAdapter(),
      webhook: () => new WebhookAdapter(core.getInput("deploy-webhook-url", { required: true })),
    };
    const adapter = adapterRegistry[config.target.adapter]();

    const cache = new FileCacheStore();
    const github = new GitHubClient(token);

    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");

    // GitHub Actions writes the triggering event's full payload to a JSON
    // file at GITHUB_EVENT_PATH. For a pull_request event, that payload
    // contains the PR number (as both `pull_request.number` and the
    // top-level `number`). Reading it here is the standard way to get the
    // PR number — there is no `GITHUB_EVENT_NUMBER` env var.
    const eventPath = process.env.GITHUB_EVENT_PATH;
    let prNumber: number;
    if (eventPath) {
      const event = JSON.parse(readFileSync(eventPath, "utf-8"));
      prNumber = event.pull_request?.number ?? event.number;
    } else {
      prNumber = Number(core.getInput("pr-number"));
    }

    if (!prNumber || Number.isNaN(prNumber)) {
      throw new Error("Could not determine the pull request number from the event payload");
    }

    const prMeta = await github.getPrMeta(owner, repo, prNumber);

    // The Job Summary itself has no separately linkable URL — the run
    // page is where GitHub renders it, at the top, so that's what gets
    // linked from the PR comment.
    const reportUrl =
      process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined;

    const { commentBody, jobSummaryBody, results } = await runBackline({
      config,
      adapter,
      cache,
      headRef: prMeta.headSha,
      baseRef: prMeta.baseSha,
      reportUrl,
      postComment: (body) => github.upsertComment(owner, repo, prNumber, body),
    });

    if (process.env.GITHUB_STEP_SUMMARY) {
      await appendFile(process.env.GITHUB_STEP_SUMMARY, jobSummaryBody);
    }

    core.info(commentBody);

    // Off by default (`fail_on: never`) — a real diff is informational
    // unless the developer explicitly opts into gating merges on it.
    const failOn = config.lifecycle.fail_on;
    const shouldFail =
      (failOn === "diff_detected" &&
        results.some((r) => r.status === "diff_detected" || r.status === "error")) ||
      (failOn === "error" && results.some((r) => r.status === "error"));

    if (shouldFail) {
      core.setFailed(
        `Backline: at least one probe reported "${failOn}" or worse (fail_on: ${failOn})`,
      );
    }
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

main();
