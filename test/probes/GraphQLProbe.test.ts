import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GraphQLProbe } from '../../src/probes/GraphQLProbe.js';
import type { ProbeConfig } from '../../src/config/schema.js';

// Mock fetch
global.fetch = vi.fn();

describe('GraphQLProbe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes GraphQL query successfully', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        data: { user: { id: 1, name: 'John' } }
      })
    };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const probe = new GraphQLProbe();
    const config: ProbeConfig = {
      type: 'graphql',
      name: 'user query',
      endpoint: '/graphql',
      queries: [{
        query: '{ user(id: 1) { name } }'
      }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000', '/tmp/work');

    expect(result.probeName).toBe('user query');
    expect(result.probeType).toBe('graphql');
    expect(result.error).toBeUndefined();
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:3000/graphql',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
    );
  });

  it('handles query with variables', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ data: { user: { name: 'John' } } })
    };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const probe = new GraphQLProbe();
    const config: ProbeConfig = {
      type: 'graphql',
      name: 'user query',
      endpoint: '/graphql',
      queries: [{
        query: 'query GetUser($id: ID!) { user(id: $id) { name } }',
        variables: { id: '123' },
        operationName: 'GetUser'
      }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    await probe.run(config, 'http://localhost:3000');

    const fetchCall = (global.fetch as any).mock.calls[0];
    const body = JSON.parse(fetchCall[1].body);

    expect(body.variables).toEqual({ id: '123' });
    expect(body.operationName).toBe('GetUser');
  });

  it('handles GraphQL errors', async () => {
    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({
        errors: [{ message: 'User not found' }],
        data: null
      })
    };
    (global.fetch as any).mockResolvedValueOnce(mockResponse);

    const probe = new GraphQLProbe();
    const config: ProbeConfig = {
      type: 'graphql',
      name: 'user query',
      endpoint: '/graphql',
      queries: [{ query: '{ user(id: 999) { name } }' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.probeType).toBe('graphql');
    expect(result.commandRuns).toBeDefined();
    expect(result.commandRuns![0].stdout).toContain('User not found');
  });

  it('handles network errors', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const probe = new GraphQLProbe();
    const config: ProbeConfig = {
      type: 'graphql',
      name: 'user query',
      endpoint: '/graphql',
      queries: [{ query: '{ users { id } }' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    // Error is in stderr, not a separate error field
    expect(result.commandRuns![0].stderr).toContain('Network error');
    expect(result.commandRuns![0].exitCode).toBe(1);
  });

  it('handles multiple queries', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { users: [] } })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: { posts: [] } })
      });

    const probe = new GraphQLProbe();
    const config: ProbeConfig = {
      type: 'graphql',
      name: 'multiple queries',
      endpoint: '/graphql',
      queries: [
        { query: '{ users { id } }' },
        { query: '{ posts { id } }' }
      ],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.commandRuns).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws error for non-graphql config', async () => {
    const probe = new GraphQLProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'wrong type',
      requests: [],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    await expect(probe.run(config, 'http://localhost:3000')).rejects.toThrow(
      'GraphQLProbe received a non-graphql config'
    );
  });
});
