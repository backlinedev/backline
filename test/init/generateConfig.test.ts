import { describe, it, expect } from 'vitest';
import { generateConfig } from '../../src/init/generateConfig.js';

describe('generateConfig', () => {
  it('generates Next.js config', () => {
    const config = generateConfig({
      framework: 'nextjs',
      baseUrl: 'http://localhost:3000',
      healthPath: '/api/hello',
      timeout: 60,
      endpoints: ['/api/users', '/api/posts']
    });

    expect(config).toContain('version: 1');
    expect(config).toContain('base_url: "http://localhost:3000"');
    expect(config).toContain('path: /api/hello');
    expect(config).toContain('timeout_seconds: 60');
    expect(config).toContain('/api/users');
    expect(config).toContain('/api/posts');
    expect(config).toContain('adapter: compose');
    expect(config).toContain('type: api');
  });

  it('generates Express config with default endpoints', () => {
    const config = generateConfig({
      framework: 'express',
      baseUrl: 'http://localhost:4000',
      healthPath: '/health',
      timeout: 30
    });

    expect(config).toContain('base_url: "http://localhost:4000"');
    expect(config).toContain('path: /health');
    expect(config).toContain('/api/users');
    expect(config).toContain('/api/status');
  });

  it('generates FastAPI config', () => {
    const config = generateConfig({
      framework: 'fastapi',
      baseUrl: 'http://localhost:8000',
      healthPath: '/docs',
      timeout: 30,
      endpoints: ['/health', '/api/v1/users']
    });

    expect(config).toContain('base_url: "http://localhost:8000"');
    expect(config).toContain('path: /docs');
    expect(config).toContain('/health');
    expect(config).toContain('/api/v1/users');
  });

  it('generates Rails config', () => {
    const config = generateConfig({
      framework: 'rails',
      baseUrl: 'http://localhost:3000',
      healthPath: '/api/v1/health',
      timeout: 30
    });

    expect(config).toContain('Rails API endpoints');
    expect(config).toContain('/api/v1/health');
    expect(config).toContain('created_at');
    expect(config).toContain('updated_at');
  });

  it('generates CLI config', () => {
    const config = generateConfig({
      framework: 'cli',
      baseUrl: '',
      healthPath: '',
      timeout: 30,
      binaryPath: './dist/mycli',
      endpoints: ['--version', 'process --input test.csv']
    });

    expect(config).toContain('type: cli');
    expect(config).toContain('binary: ./dist/mycli');
    expect(config).toContain('["--version"]');
    expect(config).toContain('["process","--input","test.csv"]');
    expect(config).toContain('normalize:');
    expect(config).toContain('strip_ansi');
    expect(config).not.toContain('base_url');
  });

  it('generates CLI config with default commands', () => {
    const config = generateConfig({
      framework: 'cli',
      baseUrl: '',
      healthPath: '',
      timeout: 30,
      binaryPath: './dist/cli'
    });

    expect(config).toContain('["--version"]');
    expect(config).toContain('["--help"]');
  });

  it('includes ignore_fields for timestamps', () => {
    const config = generateConfig({
      framework: 'nextjs',
      baseUrl: 'http://localhost:3000',
      healthPath: '/health',
      timeout: 30
    });

    expect(config).toContain('ignore_fields:');
    expect(config).toContain('timestamp');
  });

  it('generates generic API config for unknown framework', () => {
    const config = generateConfig({
      framework: 'unknown',
      baseUrl: 'http://localhost:5000',
      healthPath: '/status',
      timeout: 45,
      endpoints: ['/api/test']
    });

    expect(config).toContain('base_url: "http://localhost:5000"');
    expect(config).toContain('path: /status');
    expect(config).toContain('timeout_seconds: 45');
    expect(config).toContain('/api/test');
  });
});
