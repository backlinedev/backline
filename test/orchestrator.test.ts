import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runBackline } from '../src/orchestrator.js';
import type { BacklineConfig } from '../src/config/schema.js';
import type { DeployAdapter } from '../src/adapters/DeployAdapter.js';
import type { CacheStore } from '../src/cache/CacheStore.js';

describe('orchestrator', () => {
  const mockConfig: BacklineConfig = {
    version: 1,
    target: {
      base_url: 'http://localhost:3000',
      wait_for: { path: '/health', timeout_seconds: 30 },
      adapter: 'compose'
    },
    probes: [
      {
        type: 'api',
        name: 'test probe',
        requests: [{ method: 'GET', path: '/test' }],
        diff: { against: 'base_branch', ignore_fields: [] }
      }
    ],
    lifecycle: {
      teardown_on: ['closed'],
      idle_timeout_minutes: 60,
      fail_on: 'never'
    }
  };

  let mockAdapter: DeployAdapter;
  let mockCache: CacheStore;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdapter = {
      deploy: vi.fn().mockResolvedValue({
        previewUrl: 'http://localhost:3000',
        workingDirectory: '/tmp/work'
      }),
      healthCheck: vi.fn().mockResolvedValue(undefined),
      teardown: vi.fn().mockResolvedValue(undefined)
    };

    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined)
    };

    // Mock fetch for API probes
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({ result: 'success' })
    });
  });

  it('deploys head and base branches', async () => {
    await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature-branch',
      baseRef: 'main'
    });

    expect(mockAdapter.deploy).toHaveBeenCalledWith('feature-branch');
    expect(mockAdapter.deploy).toHaveBeenCalledWith('main');
  });

  it('runs health checks after deployment', async () => {
    await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature-branch',
      baseRef: 'main'
    });

    expect(mockAdapter.healthCheck).toHaveBeenCalledWith(
      'http://localhost:3000',
      '/health',
      30000
    );
  });

  it('runs all probes against both branches', async () => {
    await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature-branch',
      baseRef: 'main'
    });

    // Should call fetch twice (head and base)
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/test',
      expect.any(Object)
    );
  });

  it('returns diff results', async () => {
    // Make responses different
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ result: 'head' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ result: 'base' })
      });

    const result = await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature',
      baseRef: 'main'
    });

    expect(result.results).toHaveLength(1);
    expect(result.results[0].probeName).toBe('test probe');
    expect(result.results[0].status).toBe('diff_detected');
    expect(result.results[0].changedPaths.length).toBeGreaterThan(0);
  });

  it('uses cached base results when available', async () => {
    // Mock cache to return proper structure (wrapped in object with probeOutputs)
    const cachedData = {
      baseSha: 'main',
      generatedAt: new Date().toISOString(),
      probeOutputs: [{
        probeName: 'test probe',
        probeType: 'api',
        requests: [{
          method: 'GET',
          path: '/test',
          response: { status: 200, body: { result: 'cached-base' } }
        }],
        durationMs: 100
      }]
    };

    mockCache.get = vi.fn().mockResolvedValue(cachedData);

    const result = await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature',
      baseRef: 'main'
    });

    // Should only deploy head once (base uses cache)
    expect(mockAdapter.deploy).toHaveBeenCalledTimes(1);
    expect(mockAdapter.deploy).toHaveBeenCalledWith('feature');
    expect(mockCache.get).toHaveBeenCalledWith('base-main');

    // Should still get results (diff between head and cached base)
    expect(result.results).toBeDefined();
    expect(result.results.length).toBeGreaterThan(0);
  });

  it('posts comment when callback provided', async () => {
    const postComment = vi.fn();

    await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature',
      baseRef: 'main',
      postComment
    });

    expect(postComment).toHaveBeenCalledWith(expect.stringContaining('Backline Results'));
  });

  it('scrubs secrets from results', async () => {
    // Return responses with secrets that DIFFER to create a diff
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          api_key: 'sk_test_FakeKeyForTestingPurposeOnly123',
          value: 'head-data'
        })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          api_key: 'sk_test_AnotherFakeTestKeyNotRealData456',
          value: 'base-data'
        })
      });

    const result = await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature',
      baseRef: 'main'
    });

    // Secrets should not appear in comment body or job summary
    const allOutput = result.commentBody + result.jobSummaryBody;
    expect(allOutput).not.toContain('sk_test_FakeKeyForTestingPurposeOnly123');
    expect(allOutput).not.toContain('sk_test_AnotherFakeTestKeyNotRealData456');
    // Redacted placeholder should appear (since there's a diff)
    expect(allOutput).toContain('[redacted]');
  });

  it('handles probe errors gracefully', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature',
      baseRef: 'main'
    });

    expect(result.results[0].status).toBe('error');
    expect(result.results[0].error).toBeDefined();
  });

  it('includes report URL in comment when provided', async () => {
    const result = await runBackline({
      config: mockConfig,
      adapter: mockAdapter,
      cache: mockCache,
      headRef: 'feature',
      baseRef: 'main',
      reportUrl: 'https://github.com/actions/123'
    });

    expect(result.commentBody).toContain('https://github.com/actions/123');
  });
});
