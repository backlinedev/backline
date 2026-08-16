import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { CacheStore } from "./CacheStore.js";

/**
 * Backs the cache with plain JSON files under a directory. In CI,
 * that directory (default ".backline-cache") is exactly what
 * `actions/cache` saves and restores between runs, keyed on the base
 * branch's SHA — see the workflow example in backline-dev-plan.md.
 * Locally, it's just a gitignored folder on disk. Either way, this
 * class has no idea it's being cached by GitHub Actions — that's the
 * point.
 */
export class FileCacheStore implements CacheStore {
  constructor(private readonly cacheDir: string = ".backline-cache") {}

  async get(key: string): Promise<unknown | null> {
    try {
      const raw = await readFile(this.pathFor(key), "utf-8");
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async set(key: string, value: unknown): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value, null, 2), "utf-8");
  }

  private pathFor(key: string): string {
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.cacheDir, `${safeKey}.json`);
  }
}
