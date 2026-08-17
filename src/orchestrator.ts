/**
 * Wires every component together into the actual run lifecycle.
 *
 * @remarks
 * Contains almost no logic of its own — every interesting decision
 * lives in the module that owns that concern. Reading this file top
 * to bottom tells you the whole system's control flow without needing
 * to read any implementation details underneath it.
 */
import type { BacklineConfig } from "./config/schema.js";
import type { DeployAdapter } from "./adapters/DeployAdapter.js";
import { resolveProbe } from "./probes/registry.js";
import type { ProbeOutput } from "./probes/ProbeModule.js";
import { diffOutputs, type DiffResult } from "./diff/jsonDiff.js";
import type { CacheStore } from "./cache/CacheStore.js";
import { scrubSecrets } from "./render/secretScrub.js";
import { renderPrComment, renderJobSummary } from "./render/prComment.js";

export interface RunBacklineOptions {
  config: BacklineConfig;
  adapter: DeployAdapter;
  cache: CacheStore;
  headRef: string;
  baseRef: string;
  /** Link to the full Job Summary — passed through to the PR comment. */
  reportUrl?: string;
  /** If omitted, results are returned but never posted to GitHub. */
  postComment?: (body: string) => Promise<void>;
}

export interface RunBacklineResult {
  results: DiffResult[];
  commentBody: string;
  jobSummaryBody: string;
}

/**
 * Runs the full lifecycle: deploy, wait for health, probe head fully,
 * then deploy/probe/teardown base, then diff, scrub, render, post.
 *
 * @remarks
 * Head is deployed and fully probed *before* base's deploy/teardown
 * cycle runs. With the default Compose adapter, both head and base
 * now run as fully separate, simultaneous deployments (separate git
 * worktrees, separate ports, separate Compose project names) — but
 * the ordering here is kept deliberately defensive regardless, so a
 * bug in any future adapter that reuses shared resources across refs
 * can never tear down head's environment out from under it mid-run.
 */
export async function runBackline(options: RunBacklineOptions): Promise<RunBacklineResult> {
  const { config, adapter, cache, headRef, baseRef } = options;

  const { previewUrl: headUrl, workingDirectory: headDir } = await adapter.deploy(headRef);
  await adapter.healthCheck(
    headUrl,
    config.target.wait_for.path,
    config.target.wait_for.timeout_seconds * 1000,
  );

  const headOutputs: ProbeOutput[] = [];
  for (const probeConfig of config.probes) {
    const probeModule = resolveProbe(probeConfig.type);
    headOutputs.push(await probeModule.run(probeConfig, headUrl, headDir));
  }

  const baseOutputs = await getBaseOutputs(config, adapter, cache, baseRef);

  const results: DiffResult[] = [];
  for (const probeConfig of config.probes) {
    const headOutput = headOutputs.find((o) => o.probeName === probeConfig.name);
    const baseOutput = baseOutputs.find((o) => o.probeName === probeConfig.name);

    if (!headOutput || !baseOutput) {
      results.push({
        probeName: probeConfig.name,
        status: "error",
        changedPaths: [],
        error: "missing head or base output to diff against",
      });
      continue;
    }

    results.push(
      diffOutputs(baseOutput, headOutput, { ignorePaths: probeConfig.diff.ignore_fields }),
    );
  }

  const scrubbedResults = scrubSecrets(results);
  const commentBody = renderPrComment(scrubbedResults, options.reportUrl);
  const jobSummaryBody = renderJobSummary(scrubbedResults);

  if (options.postComment) {
    await options.postComment(commentBody);
  }

  return { results: scrubbedResults, commentBody, jobSummaryBody };
}

/**
 * Cache-first: if base-branch output already exists for this exact
 * ref, skip deploying it again. Not exported — internal detail.
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

  const { previewUrl: baseUrl, workingDirectory: baseDir } = await adapter.deploy(baseRef);
  await adapter.healthCheck(
    baseUrl,
    config.target.wait_for.path,
    config.target.wait_for.timeout_seconds * 1000,
  );

  const probeOutputs: ProbeOutput[] = [];
  for (const probeConfig of config.probes) {
    const probeModule = resolveProbe(probeConfig.type);
    probeOutputs.push(await probeModule.run(probeConfig, baseUrl, baseDir));
  }

  await cache.set(cacheKey, {
    baseSha: baseRef,
    generatedAt: new Date().toISOString(),
    probeOutputs,
  });
  await adapter.teardown(baseRef);

  return probeOutputs;
}
