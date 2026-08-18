import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ComposeAdapter } from '../../src/adapters/ComposeAdapter.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  exec: vi.fn()
}));

vi.mock('node:util', () => ({
  promisify: vi.fn((fn) => fn)
}));

describe('ComposeAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deploys using docker-compose', async () => {
    const mockExec = exec as any;
    mockExec.mockResolvedValue({ stdout: '', stderr: '' });

    const adapter = new ComposeAdapter();
    const result = await adapter.deploy('feature-branch');

    expect(result.previewUrl).toContain('http://localhost:');
    expect(result.workingDirectory).toContain('backline-');

    // Verify git worktree and docker compose commands were called
    const calls = mockExec.mock.calls.map((call: any) => call[0]);
    expect(calls.some((cmd: string) => cmd.includes('git worktree add'))).toBe(true);
    expect(calls.some((cmd: string) => cmd.includes('docker compose'))).toBe(true);
  });

  it('checks health with retry', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Not ready'))
      .mockRejectedValueOnce(new Error('Not ready'))
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const adapter = new ComposeAdapter();

    await expect(
      adapter.healthCheck('http://localhost:3000', '/health', 5000)
    ).resolves.not.toThrow();

    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('times out if health check never succeeds', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Not ready'));

    const adapter = new ComposeAdapter();

    await expect(
      adapter.healthCheck('http://localhost:3000', '/health', 100)
    ).rejects.toThrow('did not become healthy within');
  });

  it('tears down deployment', async () => {
    const mockExec = exec as any;
    mockExec.mockResolvedValue({ stdout: '', stderr: '' });

    const adapter = new ComposeAdapter();

    // Deploy first to create deployment
    await adapter.deploy('feature-branch');

    // Now tear down
    await adapter.teardown('feature-branch');

    // Verify teardown calls were made (docker compose down and git worktree remove)
    const calls = mockExec.mock.calls.map((call: any) => call[0]);
    expect(calls.some((cmd: string) => cmd.includes('docker compose') && cmd.includes('down'))).toBe(true);
    expect(calls.some((cmd: string) => cmd.includes('git worktree remove'))).toBe(true);
  });
});
