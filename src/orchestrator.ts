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
import { renderPrComment } from "./render/prComment.js";

export interface RunBacklineOptions {
  config: BacklineConfig;
  adapter: DeployAdapter;
  cache: CacheStore;
  headRef: string;
  baseRef: string;
  postComment?: (body: string) => Promise<void>;
}

export interface RunBacklineResult {
  results: DiffResult[];
  commentBody: string;
}

export async function runBackline(options: RunBacklineOptions): Promise<RunBacklineResult> {
  const { config, adapter, cache, headRef, baseRef } = options;

  // 1. Deploy head and run every probe against it FIRST, while it's the
  //    only thing deployed. This matters because ComposeAdapter (the
  //    default, zero-cloud adapter) ignores `ref` entirely and reuses
  //    the same container/port for both head and base — so head must be
  //    fully probed and its results captured before base's deploy or
  //    teardown cycle ever runs, or head's container gets torn down out
  //    from under it.
  const { previewUrl: headUrl } = await adapter.deploy(headRef);
  await adapter.healthCheck(
    headUrl,
    config.target.wait_for.path,
    config.target.wait_for.timeout_seconds * 1000,
  );

  const headOutputs: ProbeOutput[] = [];
  for (const probeConfig of config.probes) {
    const probeModule = resolveProbe(probeConfig.type);
    headOutputs.push(await probeModule.run(probeConfig, headUrl));
  }

  // 2. Only now, with head's results safely captured, deal with base.
  const baseOutputs = await getBaseOutputs(config, adapter, cache, baseRef);

  // 3. Diff using the captured outputs — no more deploy/teardown calls
  //    happen after this point, so nothing can pull the rug out.
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
  const commentBody = renderPrComment(scrubbedResults);

  if (options.postComment) {
    await options.postComment(commentBody);
  }

  return { results: scrubbedResults, commentBody };
}

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
  await adapter.healthCheck(
    baseUrl,
    config.target.wait_for.path,
    config.target.wait_for.timeout_seconds * 1000,
  );

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
