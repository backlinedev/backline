import { loadConfigFromFile } from "./config/loader.js";
import { validateConfigSemantics } from "./config/validate.js";
import { ComposeAdapter } from "./adapters/ComposeAdapter.js";
import { FileCacheStore } from "./cache/FileCacheStore.js";
import { runBackline } from "./orchestrator.js";

/**
 * `backline test --local` — same orchestrator as the GitHub Action,
 * just with GitHub entirely out of the loop. Useful for developing
 * Backline itself, or for anyone who wants to see a result before
 * ever pushing a PR.
 */
async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config ?? ".backline.yml";
  const headRef = args["head-ref"] ?? "HEAD";
  const baseRef = args["base-ref"] ?? "main";

  const config = await loadConfigFromFile(configPath);
  await validateConfigSemantics(config);

  const adapter = new ComposeAdapter();
  const cache = new FileCacheStore();

  const { commentBody } = await runBackline({
    config,
    adapter,
    cache,
    headRef,
    baseRef,
    // No postComment callback — local runs just print, never touch GitHub.
  });

  console.log(commentBody);
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = value;
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
