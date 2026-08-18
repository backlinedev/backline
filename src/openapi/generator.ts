import type { OpenAPISpec, PathItem, Operation } from './parser.js';
import { getParameterExample, getRequestBodyExample } from './parser.js';

export interface GeneratedProbe {
  type: 'api';
  name: string;
  requests: GeneratedRequest[];
  diff: {
    against: 'base_branch';
    ignore_fields: string[];
  };
}

export interface GeneratedRequest {
  method: string;
  path: string;
  body?: any;
  headers?: Record<string, string>;
}

/**
 * Generate Backline API probes from an OpenAPI specification.
 *
 * @remarks
 * Creates one probe per endpoint, using examples from the spec.
 * Groups related endpoints into logical probes.
 */
export function generateProbesFromOpenAPI(spec: OpenAPISpec): GeneratedProbe[] {
  const probes: GeneratedProbe[] = [];

  // Group endpoints by tag or path prefix
  const groupedPaths = groupPathsByTag(spec);

  for (const [groupName, paths] of Object.entries(groupedPaths)) {
    const requests: GeneratedRequest[] = [];

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!operation) continue;

        const request = generateRequest(path, method.toUpperCase(), operation);
        if (request) {
          requests.push(request);
        }
      }
    }

    if (requests.length > 0) {
      probes.push({
        type: 'api',
        name: groupName,
        requests,
        diff: {
          against: 'base_branch',
          ignore_fields: [
            'requests[*].response.body.timestamp',
            'requests[*].response.body.created_at',
            'requests[*].response.body.updated_at',
            'requests[*].response.body.id',
            'requests[*].response.headers.x-request-id',
            'requests[*].response.headers.date',
          ],
        },
      });
    }
  }

  return probes;
}

function groupPathsByTag(spec: OpenAPISpec): Record<string, Record<string, Record<string, Operation>>> {
  const groups: Record<string, Record<string, Record<string, Operation>>> = {};

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (!operation || typeof operation !== 'object') continue;

      const op = operation as Operation;

      // Determine group name (use first tag, or path prefix, or 'default')
      let groupName = 'API endpoints';

      if (op.summary) {
        // Use first word of summary as group
        groupName = op.summary.split(' ')[0];
      } else {
        // Use path prefix (e.g., /api/users -> users)
        const parts = path.split('/').filter(Boolean);
        if (parts.length > 0) {
          groupName = parts[parts.length - 1];
        }
      }

      if (!groups[groupName]) {
        groups[groupName] = {};
      }

      if (!groups[groupName][path]) {
        groups[groupName][path] = {};
      }

      groups[groupName][path][method] = op;
    }
  }

  return groups;
}

function generateRequest(
  path: string,
  method: string,
  operation: Operation
): GeneratedRequest | null {
  const request: GeneratedRequest = {
    method,
    path: path,
  };

  // Replace path parameters with example values
  if (operation.parameters) {
    const pathParams = operation.parameters.filter(p => p.in === 'path');
    for (const param of pathParams) {
      const example = getParameterExample(param);
      request.path = request.path.replace(`{${param.name}}`, String(example));
    }

    // Add query parameters if present
    const queryParams = operation.parameters.filter(p => p.in === 'query');
    if (queryParams.length > 0) {
      const queryString = queryParams
        .map(p => `${p.name}=${getParameterExample(p)}`)
        .join('&');
      request.path += `?${queryString}`;
    }

    // Add headers if present
    const headerParams = operation.parameters.filter(p => p.in === 'header');
    if (headerParams.length > 0) {
      request.headers = {};
      for (const param of headerParams) {
        request.headers[param.name] = String(getParameterExample(param));
      }
    }
  }

  // Add request body if present
  if (operation.requestBody && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    const example = getRequestBodyExample(operation.requestBody);
    if (example !== undefined) {
      request.body = example;
    }
  }

  return request;
}

/**
 * Convert generated probes to YAML format for .backline.yml.
 */
export function generateYAMLFromProbes(probes: GeneratedProbe[]): string {
  let yaml = 'probes:\n';

  for (const probe of probes) {
    yaml += `  - type: ${probe.type}\n`;
    yaml += `    name: "${probe.name}"\n`;
    yaml += `    requests:\n`;

    for (const request of probe.requests) {
      yaml += `      - method: ${request.method}\n`;
      yaml += `        path: ${request.path}\n`;

      if (request.headers) {
        yaml += `        headers:\n`;
        for (const [key, value] of Object.entries(request.headers)) {
          yaml += `          ${key}: "${value}"\n`;
        }
      }

      if (request.body !== undefined) {
        yaml += `        body:\n`;
        yaml += indentYAML(JSON.stringify(request.body, null, 2), 10);
      }
    }

    yaml += `    diff:\n`;
    yaml += `      against: base_branch\n`;
    yaml += `      ignore_fields:\n`;

    for (const field of probe.diff.ignore_fields) {
      yaml += `        - "${field}"\n`;
    }

    yaml += '\n';
  }

  return yaml;
}

function indentYAML(json: string, spaces: number): string {
  const indent = ' '.repeat(spaces);
  return json
    .split('\n')
    .map(line => indent + line)
    .join('\n') + '\n';
}
