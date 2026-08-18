import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseOpenAPISpec, getParameterExample, getRequestBodyExample } from '../../src/openapi/parser.js';
import { writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const TEST_SPEC_PATH = join(process.cwd(), 'test-openapi-spec.yaml');

describe('parseOpenAPISpec', () => {
  afterEach(() => {
    if (existsSync(TEST_SPEC_PATH)) {
      rmSync(TEST_SPEC_PATH);
    }
  });

  it('parses JSON OpenAPI spec', () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            summary: 'Get users',
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    };
    writeFileSync(TEST_SPEC_PATH, JSON.stringify(spec));

    const result = parseOpenAPISpec(TEST_SPEC_PATH);

    expect(result.openapi).toBe('3.0.0');
    expect(result.info.title).toBe('Test API');
    expect(result.paths['/users']).toBeDefined();
    expect(result.paths['/users'].get).toBeDefined();
  });

  it('parses YAML OpenAPI spec', () => {
    const yaml = `
openapi: 3.0.0
info:
  title: Test API
  version: 1.0.0
paths:
  /users:
    get:
      summary: Get users
      responses:
        '200':
          description: OK
`;
    writeFileSync(TEST_SPEC_PATH, yaml);

    const result = parseOpenAPISpec(TEST_SPEC_PATH);

    expect(result.openapi).toBe('3.0.0');
    expect(result.info.title).toBe('Test API');
    expect(result.paths['/users'].get).toBeDefined();
  });
});

describe('getParameterExample', () => {
  it('uses explicit example if provided', () => {
    const param = {
      name: 'userId',
      in: 'path' as const,
      schema: { type: 'integer' },
      example: 42
    };

    const result = getParameterExample(param);
    expect(result).toBe(42);
  });

  it('uses schema example if no explicit example', () => {
    const param = {
      name: 'status',
      in: 'query' as const,
      schema: { type: 'string', example: 'active' }
    };

    const result = getParameterExample(param);
    expect(result).toBe('active');
  });

  it('uses schema default if no example', () => {
    const param = {
      name: 'limit',
      in: 'query' as const,
      schema: { type: 'integer', default: 10 }
    };

    const result = getParameterExample(param);
    expect(result).toBe(10);
  });

  it('generates placeholder for string without example', () => {
    const param = {
      name: 'name',
      in: 'query' as const,
      schema: { type: 'string' }
    };

    const result = getParameterExample(param);
    expect(result).toBe('example');
  });

  it('generates 1 for ID parameters', () => {
    const param = {
      name: 'userId',
      in: 'path' as const,
      schema: { type: 'integer' }
    };

    const result = getParameterExample(param);
    expect(result).toBe(1);
  });

  it('generates true for boolean parameters', () => {
    const param = {
      name: 'active',
      in: 'query' as const,
      schema: { type: 'boolean' }
    };

    const result = getParameterExample(param);
    expect(result).toBe(true);
  });
});

describe('getRequestBodyExample', () => {
  it('uses explicit example from content', () => {
    const requestBody = {
      required: true,
      content: {
        'application/json': {
          schema: { type: 'object' },
          example: { name: 'Test', age: 30 }
        }
      }
    };

    const result = getRequestBodyExample(requestBody);
    expect(result).toEqual({ name: 'Test', age: 30 });
  });

  it('uses first example from examples object', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: { type: 'object' },
          examples: {
            example1: { value: { id: 1, name: 'First' } },
            example2: { value: { id: 2, name: 'Second' } }
          }
        }
      }
    };

    const result = getRequestBodyExample(requestBody);
    expect(result).toEqual({ id: 1, name: 'First' });
  });

  it('generates example from schema', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'John' },
              age: { type: 'integer', example: 25 }
            }
          }
        }
      }
    };

    const result = getRequestBodyExample(requestBody);
    expect(result).toEqual({ name: 'John', age: 25 });
  });

  it('returns undefined for non-JSON content', () => {
    const requestBody = {
      content: {
        'text/plain': {
          schema: { type: 'string' }
        }
      }
    };

    const result = getRequestBodyExample(requestBody);
    expect(result).toBeUndefined();
  });

  it('handles nested objects', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              user: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  email: { type: 'string', format: 'email' }
                }
              }
            }
          }
        }
      }
    };

    const result = getRequestBodyExample(requestBody);
    expect(result.user).toBeDefined();
    expect(result.user.name).toBe('string');
    expect(result.user.email).toBe('user@example.com');
  });

  it('handles arrays', () => {
    const requestBody = {
      content: {
        'application/json': {
          schema: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string' }
              }
            }
          }
        }
      }
    };

    const result = getRequestBodyExample(requestBody);
    expect(result.tags).toEqual(['string']);
  });
});
