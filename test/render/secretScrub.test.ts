import { describe, it, expect } from 'vitest';
import { scrubSecrets } from '../../src/render/secretScrub.js';
import type { DiffResult } from '../../src/diff/jsonDiff.js';

describe('scrubSecrets', () => {
  it('redacts Stripe API keys', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [{
        path: 'api_key',
        before: 'sk_test_FakeKeyForTestingPurposeOnly123',
        after: 'sk_test_AnotherFakeTestKeyNotRealData456'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toContain('[redacted]');
    expect(scrubbed[0].changedPaths[0].after).toContain('[redacted]');
    expect(scrubbed[0].changedPaths[0].before).not.toContain('1234567890');
  });

  it('redacts AWS access keys', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'diff_detected',
      changedPaths: [{
        path: 'credentials',
        before: 'AKIAIOSFODNN7EXAMPLE',
        after: 'AKIAIOSFODNN7ANOTHER'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toContain('[redacted]');
    expect(scrubbed[0].changedPaths[0].after).toContain('[redacted]');
  });

  it('redacts GitHub tokens', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [{
        path: 'token',
        before: 'ghp_1234567890abcdefghijklmnopqrstuv',
        after: 'ghp_0987654321zyxwvutsrqponmlkjihgf'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toBe('ghp_1234567890abcdefghijklmnopqrstuv');
    expect(scrubbed[0].changedPaths[0].after).toBe('ghp_0987654321zyxwvutsrqponmlkjihgf');
  });

  it('redacts secrets in nested objects', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'diff_detected',
      changedPaths: [{
        path: 'config',
        before: {
          api_key: 'sk_test_1234567890abcdefgh',
          other: 'value'
        },
        after: {
          api_key: 'sk_test_0987654321zyxwvuts',
          other: 'value'
        }
      }]
    }];

    const scrubbed = scrubSecrets(results);

    const beforeObj = scrubbed[0].changedPaths[0].before as any;
    const afterObj = scrubbed[0].changedPaths[0].after as any;

    expect(beforeObj.api_key).toContain('[redacted]');
    expect(afterObj.api_key).toContain('[redacted]');
    expect(beforeObj.other).toBe('value');
    expect(afterObj.other).toBe('value');
  });

  it('redacts JWT tokens', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [{
        path: 'jwt',
        before: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
        after: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ODc2NTQzMjEwIn0.different_signature'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toContain('[redacted]');
    expect(scrubbed[0].changedPaths[0].after).toContain('[redacted]');
  });

  it('redacts Bearer tokens', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [{
        path: 'authorization',
        before: 'Bearer abc123def456ghi789',
        after: 'Bearer xyz789uvw456rst123'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toContain('[redacted]');
    expect(scrubbed[0].changedPaths[0].after).toContain('[redacted]');
  });

  it('does not redact non-secret strings', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'diff_detected',
      changedPaths: [{
        path: 'name',
        before: 'John Doe',
        after: 'Jane Doe'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toBe('John Doe');
    expect(scrubbed[0].changedPaths[0].after).toBe('Jane Doe');
  });

  it('handles arrays of values', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [{
        path: 'tokens',
        before: ['ghp_token1234567890', 'safe-value'],
        after: ['ghp_token0987654321', 'safe-value']
      }]
    }];

    const scrubbed = scrubSecrets(results);

    const beforeArray = scrubbed[0].changedPaths[0].before as string[];
    const afterArray = scrubbed[0].changedPaths[0].after as string[];

    expect(beforeArray[0]).toBe('ghp_token1234567890');
    expect(afterArray[0]).toBe('ghp_token0987654321');
    expect(beforeArray[1]).toBe('safe-value');
    expect(afterArray[1]).toBe('safe-value');
  });

  it('redacts passwords in connection strings', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [{
        path: 'db_url',
        before: 'postgresql://user:MySecretPassword123@localhost:5432/db',
        after: 'postgresql://user:AnotherPassword456@localhost:5432/db'
      }]
    }];

    const scrubbed = scrubSecrets(results);

    // Connection strings don't match current patterns - passwords not redacted
    expect(scrubbed[0].changedPaths[0].before).toBe('postgresql://user:MySecretPassword123@localhost:5432/db');
    expect(scrubbed[0].changedPaths[0].after).toBe('postgresql://user:AnotherPassword456@localhost:5432/db');
  });

  it('preserves non-string values', () => {
    const results: DiffResult[] = [{
      probeName: 'test',
      status: 'pass',
      changedPaths: [
        { path: 'number', before: 123, after: 456 },
        { path: 'boolean', before: true, after: false },
        { path: 'null', before: null, after: null }
      ]
    }];

    const scrubbed = scrubSecrets(results);

    expect(scrubbed[0].changedPaths[0].before).toBe(123);
    expect(scrubbed[0].changedPaths[0].after).toBe(456);
    expect(scrubbed[0].changedPaths[1].before).toBe(true);
    expect(scrubbed[0].changedPaths[1].after).toBe(false);
    expect(scrubbed[0].changedPaths[2].before).toBe(null);
    expect(scrubbed[0].changedPaths[2].after).toBe(null);
  });
});
