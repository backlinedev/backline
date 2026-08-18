import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CliProbe } from '../../src/probes/CliProbe.js';
import type { ProbeConfig } from '../../src/config/schema.js';
import { spawn } from 'cross-spawn';

vi.mock('cross-spawn');

describe('CliProbe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('executes CLI command successfully', async () => {
    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('output data'));
        })
      },
      stderr: {
        on: vi.fn()
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };

    (spawn as any).mockReturnValue(mockProcess);

    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'version check',
      binary: './dist/cli.js',
      commands: [{ args: ['--version'] }],
      diff: { against: 'base_branch', ignore_fields: [], normalize: [] }
    };

    const result = await probe.run(config, '', '/tmp/work');

    expect(result.probeName).toBe('version check');
    expect(result.probeType).toBe('cli');
    expect(result.commandRuns).toHaveLength(1);
    expect(result.commandRuns![0].stdout).toContain('output data');
    expect(result.commandRuns![0].exitCode).toBe(0);
  });

  it('captures stderr output', async () => {
    const mockProcess = {
      stdout: { on: vi.fn() },
      stderr: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('error output'));
        })
      },
      on: vi.fn((event, callback) => {
        if (event === 'close') callback(1);
      })
    };

    (spawn as any).mockReturnValue(mockProcess);

    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'error test',
      binary: './cli',
      commands: [{ args: ['--invalid'] }],
      diff: { against: 'base_branch', ignore_fields: [], normalize: [] }
    };

    const result = await probe.run(config, '', '/tmp/work');

    expect(result.commandRuns![0].stderr).toContain('error output');
    expect(result.commandRuns![0].exitCode).toBe(1);
  });

  it('handles multiple commands', async () => {
    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('output'));
        })
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };

    (spawn as any).mockReturnValue(mockProcess);

    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'multi command',
      binary: './cli',
      commands: [
        { args: ['--version'] },
        { args: ['--help'] },
        { args: ['process', '--input', 'test.csv'] }
      ],
      diff: { against: 'base_branch', ignore_fields: [], normalize: [] }
    };

    const result = await probe.run(config, '', '/tmp/work');

    expect(result.commandRuns).toHaveLength(3);
    expect(spawn).toHaveBeenCalledTimes(3);
  });

  it('handles stdin input', async () => {
    const mockStdin = {
      write: vi.fn(),
      end: vi.fn()
    };

    const mockProcess = {
      stdin: mockStdin,
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('processed'));
        })
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };

    (spawn as any).mockReturnValue(mockProcess);

    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'stdin test',
      binary: './cli',
      commands: [{ args: ['process'], stdin: 'input data' }],
      diff: { against: 'base_branch', ignore_fields: [], normalize: [] }
    };

    await probe.run(config, '', '/tmp/work');

    expect(mockStdin.write).toHaveBeenCalledWith('input data');
    expect(mockStdin.end).toHaveBeenCalled();
  });

  it('strips ANSI codes when normalize includes strip_ansi', async () => {
    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('\x1b[32mgreen text\x1b[0m'));
        })
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };

    (spawn as any).mockReturnValue(mockProcess);

    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'ansi test',
      binary: './cli',
      commands: [{ args: ['--version'] }],
      diff: { against: 'base_branch', ignore_fields: [], normalize: ['strip_ansi'] }
    };

    const result = await probe.run(config, '', '/tmp/work');

    expect(result.commandRuns![0].stdout).not.toContain('\x1b[');
    expect(result.commandRuns![0].stdout).toContain('green text');
  });

  it('strips timestamps when normalize includes strip_timestamps', async () => {
    const mockProcess = {
      stdout: {
        on: vi.fn((event, callback) => {
          if (event === 'data') callback(Buffer.from('2024-01-01T12:00:00Z message'));
        })
      },
      stderr: { on: vi.fn() },
      on: vi.fn((event, callback) => {
        if (event === 'close') callback(0);
      })
    };

    (spawn as any).mockReturnValue(mockProcess);

    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'cli',
      name: 'timestamp test',
      binary: './cli',
      commands: [{ args: ['log'] }],
      diff: { against: 'base_branch', ignore_fields: [], normalize: ['strip_timestamps'] }
    };

    const result = await probe.run(config, '', '/tmp/work');

    expect(result.commandRuns![0].stdout).not.toContain('2024-01-01T12:00:00Z');
    expect(result.commandRuns![0].stdout).toContain('message');
  });

  it('throws error for non-cli config', async () => {
    const probe = new CliProbe();
    const config: ProbeConfig = {
      type: 'api',
      name: 'wrong type',
      requests: [],
      diff: { against: 'base_branch', ignore_fields: [] }
    };

    await expect(probe.run(config, '', '/tmp/work')).rejects.toThrow(
      'CliProbe received a non-cli config'
    );
  });
});
