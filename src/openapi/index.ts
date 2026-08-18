import { parseOpenAPISpec } from './parser.js';
import { generateProbesFromOpenAPI, generateYAMLFromProbes } from './generator.js';

export { parseOpenAPISpec, generateProbesFromOpenAPI, generateYAMLFromProbes };

/**
 * Main entry point for OpenAPI integration.
 *
 * @remarks
 * Reads an OpenAPI spec file and generates Backline probe configuration.
 */
export async function generateProbesFromSpec(specPath: string): Promise<string> {
  const spec = parseOpenAPISpec(specPath);
  const probes = generateProbesFromOpenAPI(spec);
  return generateYAMLFromProbes(probes);
}
