import { describe, it, expect } from 'vitest';
import { generateWorkflow } from '../../src/init/generateWorkflow.js';

describe('generateWorkflow', () => {
  it('generates basic GitHub Actions workflow', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('name: Backline');
    expect(workflow).toContain('on:');
    expect(workflow).toContain('pull_request:');
    expect(workflow).toContain('types: [opened, synchronize, closed]');
  });

  it('includes correct permissions', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('permissions:');
    expect(workflow).toContain('contents: read');
    expect(workflow).toContain('pull-requests: write');
  });

  it('uses correct action version', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('uses: backlinedev/backline@v1');
  });

  it('includes fetch-depth: 0 for checkout', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('fetch-depth: 0');
  });

  it('passes GITHUB_TOKEN', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('github-token: ${{ secrets.GITHUB_TOKEN }}');
  });

  it('uses default config path', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('config: .backline.yml');
  });

  it('accepts custom config path', () => {
    const workflow = generateWorkflow('.custom/backline.yml');

    expect(workflow).toContain('config: .custom/backline.yml');
  });

  it('runs on ubuntu-latest', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('runs-on: ubuntu-latest');
  });

  it('uses actions/checkout@v4', () => {
    const workflow = generateWorkflow();

    expect(workflow).toContain('uses: actions/checkout@v4');
  });

  it('generates valid YAML structure', () => {
    const workflow = generateWorkflow();

    // Should not have syntax errors
    expect(workflow).not.toContain('undefined');
    expect(workflow).not.toContain('null');

    // Should have proper indentation (2 spaces)
    const lines = workflow.split('\n');
    const jobsLine = lines.find(l => l.startsWith('jobs:'));
    expect(jobsLine).toBeDefined();

    const backlineLine = lines.find(l => l.trim().startsWith('backline:'));
    expect(backlineLine).toBeDefined();
    expect(backlineLine!.startsWith('  ')).toBe(true); // 2 space indent
  });
});
