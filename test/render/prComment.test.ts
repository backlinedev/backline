import { describe, it, expect } from 'vitest';
import { renderPrComment, renderJobSummary } from '../../src/render/prComment.js';
import type { DiffResult } from '../../src/diff/jsonDiff.js';

describe('renderPrComment', () => {
  it('renders basic PR comment with passing probes', () => {
    const results: DiffResult[] = [
      {
        probeName: 'test probe',
        status: 'pass',
        changedPaths: []
      }
    ];

    const comment = renderPrComment(results);

    expect(comment).toContain('Backline Results');
    expect(comment).toContain('test probe');
    expect(comment).toContain('pass');
  });

  it('includes change count for diffs', () => {
    const results: DiffResult[] = [
      {
        probeName: 'api test',
        status: 'diff_detected',
        changedPaths: [
          { path: 'field1', before: 'old', after: 'new' },
          { path: 'field2', before: 1, after: 2 }
        ]
      }
    ];

    const comment = renderPrComment(results);

    expect(comment).toContain('2 fields');
    expect(comment).toContain('diff detected');
  });

  it('shows error status', () => {
    const results: DiffResult[] = [
      {
        probeName: 'failing probe',
        status: 'error',
        changedPaths: [],
        error: 'Connection refused'
      }
    ];

    const comment = renderPrComment(results);

    expect(comment).toContain('failing probe');
    expect(comment).toContain('error');
  });

  it('includes report URL when provided', () => {
    const results: DiffResult[] = [
      { probeName: 'test', status: 'pass', changedPaths: [] }
    ];

    const comment = renderPrComment(results, 'https://github.com/actions/123');

    expect(comment).toContain('https://github.com/actions/123');
    expect(comment).toContain('View detailed diff report');
  });

  it('shows summary with issue count', () => {
    const results: DiffResult[] = [
      { probeName: 'test1', status: 'pass', changedPaths: [] },
      { probeName: 'test2', status: 'diff_detected', changedPaths: [{ path: 'x', before: 1, after: 2 }] },
      { probeName: 'test3', status: 'error', changedPaths: [], error: 'failed' }
    ];

    const comment = renderPrComment(results);

    expect(comment).toContain('2 issues detected');
    expect(comment).toContain('1 passing');
  });

  it('uses collapsible section for issues', () => {
    const results: DiffResult[] = [
      { probeName: 'test', status: 'diff_detected', changedPaths: [{ path: 'x', before: 1, after: 2 }] }
    ];

    const comment = renderPrComment(results);

    expect(comment).toContain('<details open>');
    expect(comment).toContain('</details>');
  });
});

describe('renderJobSummary', () => {
  it('renders job summary with pass status', () => {
    const results: DiffResult[] = [
      {
        probeName: 'test probe',
        status: 'pass',
        changedPaths: []
      }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('Backline — Detailed Diff Report');
    expect(summary).toContain('test probe');
    expect(summary).toContain('No differences detected');
  });

  it('renders changed fields with side-by-side comparison', () => {
    const results: DiffResult[] = [
      {
        probeName: 'api test',
        status: 'diff_detected',
        changedPaths: [
          { path: 'user.name', before: 'John', after: 'Jane' }
        ]
      }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('user.name');
    expect(summary).toContain('Base Branch');
    expect(summary).toContain('PR Branch');
    expect(summary).toContain('John');
    expect(summary).toContain('Jane');
    expect(summary).toContain('<table>');
  });

  it('uses syntax-highlighted code blocks', () => {
    const results: DiffResult[] = [
      {
        probeName: 'test',
        status: 'diff_detected',
        changedPaths: [
          { path: 'config', before: { key: 'value' }, after: { key: 'newValue' } }
        ]
      }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('```json');
    expect(summary).toContain('"key"');
    expect(summary).toContain('"value"');
    expect(summary).toContain('"newValue"');
  });

  it('shows error details', () => {
    const results: DiffResult[] = [
      {
        probeName: 'failing probe',
        status: 'error',
        changedPaths: [],
        error: 'Network timeout'
      }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('failing probe');
    expect(summary).toContain('Error: Network timeout');
  });

  it('uses collapsible sections with auto-open for failures', () => {
    const results: DiffResult[] = [
      { probeName: 'passing', status: 'pass', changedPaths: [] },
      { probeName: 'failing', status: 'diff_detected', changedPaths: [{ path: 'x', before: 1, after: 2 }] }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('<details>');  // closed for passing
    expect(summary).toContain('<details open>');  // open for failing
  });

  it('includes summary counts', () => {
    const results: DiffResult[] = [
      { probeName: 'test1', status: 'pass', changedPaths: [] },
      { probeName: 'test2', status: 'pass', changedPaths: [] },
      { probeName: 'test3', status: 'diff_detected', changedPaths: [{ path: 'x', before: 1, after: 2 }] },
      { probeName: 'test4', status: 'error', changedPaths: [], error: 'failed' }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('**2** passed');
    expect(summary).toContain('**1** changed');
    expect(summary).toContain('**1** failed');
  });

  it('formats complex objects', () => {
    const results: DiffResult[] = [
      {
        probeName: 'test',
        status: 'diff_detected',
        changedPaths: [{
          path: 'response',
          before: { nested: { deep: { value: 123 } } },
          after: { nested: { deep: { value: 456 } } }
        }]
      }
    ];

    const summary = renderJobSummary(results);

    expect(summary).toContain('"nested"');
    expect(summary).toContain('"deep"');
    expect(summary).toContain('123');
    expect(summary).toContain('456');
  });
});
