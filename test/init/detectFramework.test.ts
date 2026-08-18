import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { detectFramework } from '../../src/init/detectFramework.js';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_DIR = join(process.cwd(), 'test-temp-detect-framework');

describe('detectFramework', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it('detects Next.js from next.config.js', () => {
    writeFileSync(join(TEST_DIR, 'next.config.js'), 'module.exports = {}');

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('nextjs');
    expect(result.confidence).toBe('high');
    expect(result.details.detectedPaths).toContain('next.config.js');
  });

  it('detects Next.js App Router', () => {
    writeFileSync(join(TEST_DIR, 'next.config.js'), 'module.exports = {}');
    mkdirSync(join(TEST_DIR, 'app'));

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('nextjs');
    expect(result.details.detectedPaths).toContain('app/');
  });

  it('detects Express from package.json', () => {
    const packageJson = {
      dependencies: {
        express: '^4.18.0'
      }
    };
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson));

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('express');
    expect(result.confidence).toBe('high');
  });

  it('detects CLI tool from package.json bin field', () => {
    const packageJson = {
      bin: {
        mycli: './dist/cli.js'
      }
    };
    writeFileSync(join(TEST_DIR, 'package.json'), JSON.stringify(packageJson));

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('cli');
    expect(result.confidence).toBe('high');
  });

  it('detects FastAPI from requirements.txt', () => {
    writeFileSync(join(TEST_DIR, 'requirements.txt'), 'fastapi==0.104.0\nuvicorn==0.24.0');

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('fastapi');
    expect(result.confidence).toBe('high');
    expect(result.details.packageManager).toBe('pip');
  });

  it('detects Rails from Gemfile and config', () => {
    writeFileSync(join(TEST_DIR, 'Gemfile'), 'gem "rails"');
    mkdirSync(join(TEST_DIR, 'config'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'config/application.rb'), '');

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('rails');
    expect(result.confidence).toBe('high');
    expect(result.details.packageManager).toBe('bundler');
  });

  it('detects CLI from src/cli.ts', () => {
    mkdirSync(join(TEST_DIR, 'src'), { recursive: true });
    writeFileSync(join(TEST_DIR, 'src/cli.ts'), '');

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('cli');
    expect(result.confidence).toBe('medium');
  });

  it('returns unknown for unrecognized project', () => {
    writeFileSync(join(TEST_DIR, 'README.md'), '# Some project');

    const result = detectFramework(TEST_DIR);

    expect(result.framework).toBe('unknown');
    expect(result.confidence).toBe('low');
  });

  it('detects Docker Compose presence', () => {
    writeFileSync(join(TEST_DIR, 'docker-compose.yml'), 'version: 3.8');
    writeFileSync(join(TEST_DIR, 'next.config.js'), 'module.exports = {}');

    const result = detectFramework(TEST_DIR);

    expect(result.details.hasDockerCompose).toBe(true);
  });

  it('detects Dockerfile presence', () => {
    writeFileSync(join(TEST_DIR, 'Dockerfile'), 'FROM node:20');
    writeFileSync(join(TEST_DIR, 'next.config.js'), 'module.exports = {}');

    const result = detectFramework(TEST_DIR);

    expect(result.details.hasDockerfile).toBe(true);
  });

  it('detects package manager from lock files', () => {
    writeFileSync(join(TEST_DIR, 'pnpm-lock.yaml'), '');
    writeFileSync(join(TEST_DIR, 'next.config.js'), 'module.exports = {}');

    const result = detectFramework(TEST_DIR);

    expect(result.details.packageManager).toBe('pnpm');
  });
});
