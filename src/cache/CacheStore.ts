/**
 * This is the entire persistence layer Backline has. Compare to a
 * typical ORM/database interface — deliberately this small, because
 * everything that needs to persist between runs (the base branch's
 * probe output) fits in one JSON blob per cache key. See
 * FileCacheStore for the implementation backed by actions/cache.
 */
export interface CacheStore {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
}
