import { describe, it, expect } from 'vitest';
import { generateProbesFromOpenAPI, generateYAMLFromProbes } from '../../src/openapi/generator.js';
import type { OpenAPISpec } from '../../src/openapi/parser.js';

describe('generateProbesFromOpenAPI', () => {
  it('generates probes from simple OpenAPI spec', () => {
    const spec: OpenAPISpec = {
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

    const probes = generateProbesFromOpenAPI(spec);

    expect(probes.length).toBeGreaterThan(0);
    expect(probes[0].type).toBe('api');
    expect(probes[0].requests.length).toBeGreaterThan(0);
    expect(probes[0].requests[0].method).toBe('GET');
    expect(probes[0].requests[0].path).toBe('/users');
  });

  it('handles path parameters', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            summary: 'Get user',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'integer', example: 123 }
              }
            ],
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    };

    const probes = generateProbesFromOpenAPI(spec);

    expect(probes[0].requests[0].path).toBe('/users/123');
  });

  it('handles query parameters', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            parameters: [
              {
                name: 'limit',
                in: 'query',
                schema: { type: 'integer', example: 10 }
              },
              {
                name: 'offset',
                in: 'query',
                schema: { type: 'integer', example: 0 }
              }
            ],
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    };

    const probes = generateProbesFromOpenAPI(spec);

    expect(probes[0].requests[0].path).toContain('?');
    expect(probes[0].requests[0].path).toContain('limit=10');
    expect(probes[0].requests[0].path).toContain('offset=0');
  });

  it('handles request bodies', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          post: {
            summary: 'Create user',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: { type: 'string', example: 'John' },
                      email: { type: 'string', example: 'john@example.com' }
                    }
                  }
                }
              }
            },
            responses: { '201': { description: 'Created' } }
          }
        }
      }
    };

    const probes = generateProbesFromOpenAPI(spec);

    expect(probes[0].requests[0].method).toBe('POST');
    expect(probes[0].requests[0].body).toEqual({
      name: 'John',
      email: 'john@example.com'
    });
  });

  it('handles multiple HTTP methods on same path', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            summary: 'List users',
            responses: { '200': { description: 'OK' } }
          },
          post: {
            summary: 'Create user',
            responses: { '201': { description: 'Created' } }
          }
        }
      }
    };

    const probes = generateProbesFromOpenAPI(spec);

    // May generate multiple probes or combine into one
    const allRequests = probes.flatMap(p => p.requests);
    const methods = allRequests.map(r => r.method);
    expect(methods).toContain('GET');
    expect(methods).toContain('POST');
  });

  it('adds standard ignore fields', () => {
    const spec: OpenAPISpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/users': {
          get: {
            responses: { '200': { description: 'OK' } }
          }
        }
      }
    };

    const probes = generateProbesFromOpenAPI(spec);

    expect(probes[0].diff.ignore_fields).toContain('requests[*].response.body.timestamp');
    expect(probes[0].diff.ignore_fields).toContain('requests[*].response.body.created_at');
    expect(probes[0].diff.ignore_fields).toContain('requests[*].response.headers.date');
  });
});

describe('generateYAMLFromProbes', () => {
  it('generates valid YAML', () => {
    const probes = [{
      type: 'api' as const,
      name: 'test probe',
      requests: [{
        method: 'GET',
        path: '/test'
      }],
      diff: {
        against: 'base_branch' as const,
        ignore_fields: ['timestamp']
      }
    }];

    const yaml = generateYAMLFromProbes(probes);

    expect(yaml).toContain('probes:');
    expect(yaml).toContain('type: api');
    expect(yaml).toContain('name: "test probe"');
    expect(yaml).toContain('method: GET');
    expect(yaml).toContain('path: /test');
    expect(yaml).toContain('against: base_branch');
    expect(yaml).toContain('- "timestamp"');
  });

  it('includes request bodies', () => {
    const probes = [{
      type: 'api' as const,
      name: 'test probe',
      requests: [{
        method: 'POST',
        path: '/users',
        body: { name: 'Test', email: 'test@example.com' }
      }],
      diff: {
        against: 'base_branch' as const,
        ignore_fields: []
      }
    }];

    const yaml = generateYAMLFromProbes(probes);

    expect(yaml).toContain('body:');
    expect(yaml).toContain('name');
    expect(yaml).toContain('Test');
    expect(yaml).toContain('email');
  });

  it('includes headers', () => {
    const probes = [{
      type: 'api' as const,
      name: 'test probe',
      requests: [{
        method: 'GET',
        path: '/protected',
        headers: { 'Authorization': 'Bearer token' }
      }],
      diff: {
        against: 'base_branch' as const,
        ignore_fields: []
      }
    }];

    const yaml = generateYAMLFromProbes(probes);

    expect(yaml).toContain('headers:');
    expect(yaml).toContain('Authorization');
    expect(yaml).toContain('Bearer token');
  });
});
