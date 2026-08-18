import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiProbe } from '../../src/probes/ApiProbe.js';
import type { ProbeConfig } from '../../src/config/schema.js';

describe('ApiProbe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes GET request successfully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({ result: 'success' })
    });

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'get test',
      requests: [{ method: 'GET', path: '/users' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.probeName).toBe('get test');
    expect(result.probeType).toBe('api');
    expect(result.requests).toHaveLength(1);
    expect(result.requests![0].method).toBe('GET');
    expect(result.requests![0].path).toBe('/users');
    expect(result.requests![0].response.status).toBe(200);
    expect(result.requests![0].response.body).toEqual({ result: 'success' });
  });

  it('executes POST request with body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({ id: 123, created: true })
    });

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'post test',
      requests: [{
        method: 'POST',
        path: '/users',
        body: { name: 'John', email: 'john@example.com' }
      }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    await probe.run(config, 'http://localhost:3000');

    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/users',
      expect.objectContaining({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'John', email: 'john@example.com' })
      })
    );
  });

  it('handles multiple requests', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ users: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({ posts: [] })
      });

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'multi request',
      requests: [
        { method: 'GET', path: '/users' },
        { method: 'GET', path: '/posts' }
      ],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.requests).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles text responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => 'text/plain'
      },
      text: async () => 'plain text response'
    });

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'text test',
      requests: [{ method: 'GET', path: '/text' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.requests![0].response.body).toBe('plain text response');
  });

  it('handles 404 responses', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: {
        get: () => 'application/json'
      },
      json: async () => ({ error: 'Not found' })
    });

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: '404 test',
      requests: [{ method: 'GET', path: '/nonexistent' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.requests![0].response.status).toBe(404);
    expect(result.requests![0].response.body).toEqual({ error: 'Not found' });
    expect(result.error).toBeUndefined(); // 404 is not an error, just a response
  });

  it('handles network errors', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'error test',
      requests: [{ method: 'GET', path: '/users' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.error).toBe('Connection refused');
  });

  it('handles timeout', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), 100)
      )
    );

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'timeout test',
      requests: [{ method: 'GET', path: '/slow' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.error).toBeDefined();
  });

  it('handles invalid JSON gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => 'application/json'
      },
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'invalid json',
      requests: [{ method: 'GET', path: '/broken' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.requests![0].response.body).toBe(null);
  });

  it('throws error for non-api config', async () => {
    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'wrong type',
      binary: './cli',
      commands: [],
      diff: { against: 'base_branch', ignore_fields: [], normalize: [] }
    };

    await expect(probe.run(config, 'http://localhost:3000')).rejects.toThrow(
      'ApiProbe received a non-api config'
    );
  });

  it('measures duration', async () => {
    global.fetch = vi.fn().mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({})
        }), 50)
      )
    );

    const probe = new ApiProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'duration test',
      requests: [{ method: 'GET', path: '/test' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.durationMs).toBeGreaterThan(40);
  });
});
