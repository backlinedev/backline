import type { BacklineConfig } from "./config/schema.js";
import type { DeployAdapter } from "./adapters/DeployAdapter.js";
import { resolveProbe } from "./probes/registry.js";
import type { ProbeOutput } from "./probes/ProbeModule.js";
import { diffOutputs, type DiffResult } from "./diff/jsonDiff.js";
import type { CacheStore } from "./cache/CacheStore.js";
import { scrubSecrets } from "./render/secretScrub.js";
import { renderPrComment } from "./render/prComment.js";

export interface RunBacklineOptions {
  config: BacklineConfig;
  adapter: DeployAdapter;
  cache: CacheStore;
  headRef: string;
  baseRef: string;
  /** If false, skip posting to GitHub — used by the local CLI / dry runs. */
  postComment?: (body: string) => Promise<void>;
}

export interface RunBacklineResult {
  results: DiffResult[];
  commentBody: string;
}

/**
 * The full run lifecycle, matching Section 5 of backline-architecture.md
 * step for step. This function contains almost no logic of its own —
 * every interesting decision lives in the module that owns that
 * concern. Reading this top to bottom should tell you the whole
 * system's control flow without needing to read any implementation
 * details underneath it.
 */
export async function runBackline(options: RunBacklineOptions): Promise<RunBacklineResult> {
  const { config, adapter, cache, headRef, baseRef } = options;

  const { previewUrl: headUrl } = await adapter.deploy(headRef);
  await adapter.healthCheck(headUrl, config.target.wait_for.path, config.target.wait_for.timeout_seconds * 1000);

  const baseOutputs = await getBaseOutputs(config, adapter, cache, baseRef);

  const results: DiffResult[] = [];
  for (const probeConfig of config.probes) {
    const probeModule = resolveProbe(probeConfig.type);
    const headOutput = await probeModule.run(probeConfig, headUrl);
    const baseOutput = baseOutputs.find((o) => o.probeName === probeConfig.name);

    if (!baseOutput) {
      results.push({
        probeName: probeConfig.name,
        status: "error",
        changedPaths: [],
        error: "no base branch reference output available to diff against",
      });
      continue;
    }

    results.push(diffOutputs(baseOutput, headOutput, { ignorePaths: probeConfig.diff.ignore_fields }));
  }

  const scrubbedResults = scrubSecrets(results);
  const commentBody = renderPrComment(scrubbedResults);

  if (options.postComment) {
    await options.postComment(commentBody);
  }

  return { results: scrubbedResults, commentBody };
}

/**
 * Cache-first: if we already have base-branch output for this SHA,
 * skip deploying it again entirely. Only deploy + probe the base
 * branch when the cache misses (i.e. this is the first PR to compare
 * against this particular base commit).
 */
async function getBaseOutputs(
  config: BacklineConfig,
  adapter: DeployAdapter,
  cache: CacheStore,
  baseRef: string,
): Promise<ProbeOutput[]> {
  const cacheKey = `base-${baseRef}`;
  const cached = (await cache.get(cacheKey)) as { probeOutputs: ProbeOutput[] } | null;
  if (cached) {
    return cached.probeOutputs;
  }

  const { previewUrl: baseUrl } = await adapter.deploy(baseRef);
  await adapter.healthCheck(baseUrl, config.target.wait_for.path, config.target.wait_for.timeout_seconds * 1000);

  const probeOutputs: ProbeOutput[] = [];
  for (const probeConfig of config.probes) {
    const probeModule = resolveProbe(probeConfig.type);
    probeOutputs.push(await probeModule.run(probeConfig, baseUrl));
  }

  await cache.set(cacheKey, {
    baseSha: baseRef,
    generatedAt: new Date().toISOString(),
    probeOutputs,
  });
  await adapter.teardown(baseRef);

  return probeOutputs;
}
