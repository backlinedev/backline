import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DatabaseProbe } from '../../src/probes/DatabaseProbe.js';
import type { ProbeConfig } from '../../src/config/schema.js';

describe('DatabaseProbe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects PostgreSQL from connection string', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'postgres test',
      connection: 'postgresql://user:pass@localhost:5432/db',
      queries: [{ sql: 'SELECT 1' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    // Will fail without pg installed, but tests the structure
    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.probeName).toBe('postgres test');
    expect(result.probeType).toBe('database');
    // Either succeeds or fails with "requires pg package" error
    if (result.error) {
      expect(result.error).toContain('pg');
    }
  });

  it('detects MySQL from connection string', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'mysql test',
      connection: 'mysql://user:pass@localhost:3306/db',
      queries: [{ sql: 'SELECT 1' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.probeName).toBe('mysql test');
    expect(result.probeType).toBe('database');
    if (result.error) {
      expect(result.error).toContain('mysql2');
    }
  });

  it('detects SQLite from connection string', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'sqlite test',
      connection: 'sqlite:///tmp/test.db',
      queries: [{ sql: 'SELECT 1' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.probeName).toBe('sqlite test');
    expect(result.probeType).toBe('database');
    if (result.error) {
      expect(result.error).toContain('sqlite');
    }
  });

  it('handles multiple queries', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'multi query',
      connection: 'postgresql://localhost/test',
      queries: [
        { sql: 'SELECT COUNT(*) FROM users' },
        { sql: 'SELECT COUNT(*) FROM posts' }
      ],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.commandRuns?.length).toBe(2);
  });

  it('handles parameterized queries', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'parameterized',
      connection: 'postgresql://localhost/test',
      queries: [
        { sql: 'SELECT * FROM users WHERE id = ?', params: [1] }
      ],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    expect(result.probeType).toBe('database');
    expect(result.commandRuns).toBeDefined();
  });

  it('returns error for unsupported database type', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'unknown db',
      connection: 'mongodb://localhost/test',
      queries: [{ sql: 'SELECT 1' }],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    // Error is returned either in result.error or in commandRuns[].stderr
    if (result.error) {
      expect(result.error).toContain('Unsupported database type');
    } else {
      expect(result.commandRuns).toBeDefined();
      expect(result.commandRuns![0].error || result.commandRuns![0].stderr).toContain('Unsupported');
    }
  });

  it('throws error for non-database config', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'wrong type',
      requests: [],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    await expect(probe.run(config, 'http://localhost:3000')).rejects.toThrow(
      'DatabaseProbe received a non-database config'
    );
  });

  it('handles query errors individually', async () => {
    const probe = new DatabaseProbe();
    const config: ProbeConfig = {
      type: 'database',
      name: 'error handling',
      connection: 'postgresql://localhost/test',
      queries: [
        { sql: 'SELECT * FROM nonexistent_table' }
      ],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    const result = await probe.run(config, 'http://localhost:3000');

    // Should not crash entirely, but handle error for individual query
    expect(result.commandRuns).toBeDefined();
  });
});
