import { readFileSync } from 'fs';
import yaml from 'js-yaml';

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
  };
  servers?: Array<{ url: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
  };
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'path' | 'header' | 'cookie';
  required?: boolean;
  schema: any;
  example?: any;
}

export interface RequestBody {
  required?: boolean;
  content: Record<string, MediaType>;
}

export interface MediaType {
  schema: any;
  example?: any;
  examples?: Record<string, { value: any }>;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
}

/**
 * Parse an OpenAPI/Swagger specification file.
 *
 * @remarks
 * Supports both OpenAPI 3.x and Swagger 2.x formats.
 * Handles JSON and YAML formats automatically.
 */
export function parseOpenAPISpec(filePath: string): OpenAPISpec {
  const content = readFileSync(filePath, 'utf-8');

  // Try parsing as JSON first
  try {
    return JSON.parse(content) as OpenAPISpec;
  } catch {
    // Fall back to YAML
    return yaml.load(content) as OpenAPISpec;
  }
}

/**
 * Extract example value from parameter schema.
 */
export function getParameterExample(param: Parameter): any {
  if (param.example !== undefined) {
    return param.example;
  }

  if (param.schema?.example !== undefined) {
    return param.schema.example;
  }

  if (param.schema?.default !== undefined) {
    return param.schema.default;
  }

  // Generate placeholder based on type
  const type = param.schema?.type;
  switch (type) {
    case 'string':
      return 'example';
    case 'number':
    case 'integer':
      return param.name.toLowerCase().includes('id') ? 1 : 0;
    case 'boolean':
      return true;
    default:
      return null;
  }
}

/**
 * Extract example request body from operation.
 */
export function getRequestBodyExample(requestBody: RequestBody): any {
  const jsonContent = requestBody.content['application/json'];
  if (!jsonContent) {
    return undefined;
  }

  // Use explicit example if provided
  if (jsonContent.example) {
    return jsonContent.example;
  }

  // Use first example from examples object
  if (jsonContent.examples) {
    const firstExample = Object.values(jsonContent.examples)[0];
    if (firstExample?.value) {
      return firstExample.value;
    }
  }

  // Generate from schema
  return generateExampleFromSchema(jsonContent.schema);
}

/**
 * Generate example value from JSON Schema.
 */
function generateExampleFromSchema(schema: any): any {
  if (!schema) {
    return undefined;
  }

  if (schema.example !== undefined) {
    return schema.example;
  }

  const type = schema.type;

  switch (type) {
    case 'object':
      if (!schema.properties) {
        return {};
      }

      const obj: Record<string, any> = {};
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        obj[propName] = generateExampleFromSchema(propSchema);
      }
      return obj;

    case 'array':
      if (schema.items) {
        return [generateExampleFromSchema(schema.items)];
      }
      return [];

    case 'string':
      if (schema.enum) {
        return schema.enum[0];
      }
      if (schema.format === 'email') {
        return 'user@example.com';
      }
      if (schema.format === 'date-time') {
        return new Date().toISOString();
      }
      return 'string';

    case 'number':
    case 'integer':
      return 0;

    case 'boolean':
      return true;

    default:
      return null;
  }
}
