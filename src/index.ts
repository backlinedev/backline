import * as core from "@actions/core";
import { loadConfigFromFile } from "./config/loader.js";
import { validateConfigSemantics } from "./config/validate.js";
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

    const adapter =
      config.target.adapter === "webhook"
        ? new WebhookAdapter(core.getInput("deploy-webhook-url", { required: true }))
        : new ComposeAdapter();

    const cache = new FileCacheStore();
    const github = new GitHubClient(token);

    const [owner, repo] = (process.env.GITHUB_REPOSITORY ?? "").split("/");
    const prNumber = Number(process.env.GITHUB_EVENT_NUMBER ?? core.getInput("pr-number"));
    const prMeta = await github.getPrMeta(owner, repo, prNumber);

    const { commentBody } = await runBackline({
      config,
      adapter,
      cache,
      headRef: prMeta.headRef,
      baseRef: prMeta.baseRef,
      postComment: (body) => github.postComment(owner, repo, prNumber, body),
    });

    core.info(commentBody);
  } catch (err) {
    core.setFailed((err as Error).message);
  }
}

main();
