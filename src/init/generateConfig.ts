import type { Framework } from './detectFramework.js';

export interface ConfigOptions {
  framework: Framework;
  baseUrl: string;
  healthPath: string;
  timeout: number;
  endpoints?: string[];
  binaryPath?: string;
}

/**
 * Generate a `.backline.yml` config based on the detected framework
 * and user preferences.
 */
export function generateConfig(options: ConfigOptions): string {
  const { framework, baseUrl, healthPath, timeout, endpoints, binaryPath } = options;

  switch (framework) {
    case 'nextjs':
      return generateNextJsConfig(baseUrl, healthPath, timeout, endpoints);

    case 'express':
      return generateExpressConfig(baseUrl, healthPath, timeout, endpoints);

    case 'fastapi':
      return generateFastApiConfig(baseUrl, healthPath, timeout, endpoints);

    case 'rails':
      return generateRailsConfig(baseUrl, healthPath, timeout, endpoints);

    case 'cli':
      return generateCliConfig(binaryPath || './dist/cli', endpoints);

    default:
      return generateGenericApiConfig(baseUrl, healthPath, timeout, endpoints);
  }
}

function generateNextJsConfig(
  baseUrl: string,
  healthPath: string,
  timeout: number,
  endpoints?: string[]
): string {
  const endpointsList = endpoints && endpoints.length > 0
    ? endpoints.map(path => `      - method: GET\n        path: ${path}`).join('\n')
    : `      - method: GET
        path: /api/hello`;

  return `version: 1

target:
  base_url: "${baseUrl}"
  wait_for:
    path: ${healthPath}
    timeout_seconds: ${timeout}
  adapter: compose

probes:
  - type: api
    name: "API routes"
    requests:
${endpointsList}
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
        - "requests[*].response.body.created_at"
        - "requests[*].response.body.request_id"
`;
}

function generateExpressConfig(
  baseUrl: string,
  healthPath: string,
  timeout: number,
  endpoints?: string[]
): string {
  const endpointsList = endpoints && endpoints.length > 0
    ? endpoints.map(path => `      - method: GET\n        path: ${path}`).join('\n')
    : `      - method: GET
        path: /api/users
      - method: GET
        path: /api/status`;

  return `version: 1

target:
  base_url: "${baseUrl}"
  wait_for:
    path: ${healthPath}
    timeout_seconds: ${timeout}
  adapter: compose

probes:
  - type: api
    name: "API endpoints"
    requests:
${endpointsList}
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
        - "requests[*].response.body.request_id"
`;
}

function generateFastApiConfig(
  baseUrl: string,
  healthPath: string,
  timeout: number,
  endpoints?: string[]
): string {
  const endpointsList = endpoints && endpoints.length > 0
    ? endpoints.map(path => `      - method: GET\n        path: ${path}`).join('\n')
    : `      - method: GET
        path: /docs
      - method: GET
        path: /health`;

  return `version: 1

target:
  base_url: "${baseUrl}"
  wait_for:
    path: ${healthPath}
    timeout_seconds: ${timeout}
  adapter: compose

probes:
  - type: api
    name: "FastAPI endpoints"
    requests:
${endpointsList}
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
`;
}

function generateRailsConfig(
  baseUrl: string,
  healthPath: string,
  timeout: number,
  endpoints?: string[]
): string {
  const endpointsList = endpoints && endpoints.length > 0
    ? endpoints.map(path => `      - method: GET\n        path: ${path}`).join('\n')
    : `      - method: GET
        path: /api/v1/health
      - method: GET
        path: /api/v1/users`;

  return `version: 1

target:
  base_url: "${baseUrl}"
  wait_for:
    path: ${healthPath}
    timeout_seconds: ${timeout}
  adapter: compose

probes:
  - type: api
    name: "Rails API endpoints"
    requests:
${endpointsList}
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
        - "requests[*].response.body.created_at"
        - "requests[*].response.body.updated_at"
`;
}

function generateCliConfig(binaryPath: string, commands?: string[]): string {
  const commandsList = commands && commands.length > 0
    ? commands.map(cmd => `      - args: ${JSON.stringify(cmd.split(' '))}`).join('\n')
    : `      - args: ["--version"]
      - args: ["--help"]`;

  return `version: 1

target:
  adapter: compose

probes:
  - type: cli
    name: "CLI commands"
    binary: ${binaryPath}
    commands:
${commandsList}
    diff:
      against: base_branch
      normalize:
        - strip_ansi
        - strip_timestamps
`;
}

function generateGenericApiConfig(
  baseUrl: string,
  healthPath: string,
  timeout: number,
  endpoints?: string[]
): string {
  const endpointsList = endpoints && endpoints.length > 0
    ? endpoints.map(path => `      - method: GET\n        path: ${path}`).join('\n')
    : `      - method: GET
        path: /health`;

  return `version: 1

target:
  base_url: "${baseUrl}"
  wait_for:
    path: ${healthPath}
    timeout_seconds: ${timeout}
  adapter: compose

probes:
  - type: api
    name: "API endpoints"
    requests:
${endpointsList}
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
`;
}
