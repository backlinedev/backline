import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileCacheStore } from '../../src/cache/FileCacheStore.js';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';

const TEST_CACHE_DIR = join(process.cwd(), '.test-cache');

describe('FileCacheStore', () => {
  beforeEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_CACHE_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_CACHE_DIR)) {
      rmSync(TEST_CACHE_DIR, { recursive: true, force: true });
    }
  });

  it('stores and retrieves data', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);
    const data = { test: 'value', number: 123 };

    await cache.set('test-key', data);
    const result = await cache.get('test-key');

    expect(result).toEqual(data);
  });

  it('returns null for non-existent key', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);

    const result = await cache.get('nonexistent');

    expect(result).toBeNull();
  });

  it('overwrites existing data', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);

    await cache.set('key', { value: 'first' });
    await cache.set('key', { value: 'second' });

    const result = await cache.get('key');

    expect(result).toEqual({ value: 'second' });
  });

  it('handles complex nested objects', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);
    const complex = {
      nested: {
        deep: {
          array: [1, 2, 3],
          object: { key: 'value' }
        }
      },
      array: ['a', 'b', 'c']
    };

    await cache.set('complex', complex);
    const result = await cache.get('complex');

    expect(result).toEqual(complex);
  });

  it('handles arrays', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);
    const array = [
      { id: 1, name: 'first' },
      { id: 2, name: 'second' }
    ];

    await cache.set('array', array);
    const result = await cache.get('array');

    expect(result).toEqual(array);
  });

  it('creates cache directory if it does not exist', async () => {
    const newCacheDir = join(TEST_CACHE_DIR, 'nested', 'deep');
    const cache = new FileCacheStore(newCacheDir);

    await cache.set('test', { value: 'data' });

    expect(existsSync(newCacheDir)).toBe(true);
  });

  it('handles special characters in keys', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);
    const data = { test: 'value' };

    // Should sanitize keys to be filesystem-safe
    await cache.set('key:with:colons', data);
    const result = await cache.get('key:with:colons');

    expect(result).toEqual(data);
  });

  it('handles corrupted cache files', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);

    // Manually create a corrupted cache file
    const { writeFileSync } = await import('fs');
    writeFileSync(
      join(TEST_CACHE_DIR, 'corrupted.json'),
      'this is not valid JSON {'
    );

    const result = await cache.get('corrupted');

    // Should return null for corrupted data
    expect(result).toBeNull();
  });

  it('uses default cache directory', async () => {
    const cache = new FileCacheStore();

    await cache.set('default-dir-test', { value: 123 });
    const result = await cache.get('default-dir-test');

    expect(result).toEqual({ value: 123 });

    // Cleanup
    if (existsSync('.backline-cache')) {
      rmSync('.backline-cache', { recursive: true, force: true });
    }
  });

  it('handles concurrent writes', async () => {
    const cache = new FileCacheStore(TEST_CACHE_DIR);

    // Write multiple keys concurrently
    await Promise.all([
      cache.set('key1', { value: 1 }),
      cache.set('key2', { value: 2 }),
      cache.set('key3', { value: 3 })
    ]);

    const results = await Promise.all([
      cache.get('key1'),
      cache.get('key2'),
      cache.get('key3')
    ]);

    expect(results).toEqual([
      { value: 1 },
      { value: 2 },
      { value: 3 }
    ]);
  });
});
