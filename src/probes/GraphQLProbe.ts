import type { ProbeConfig, GraphQLProbeConfig } from "../config/schema.js";
import type { ProbeModule, ProbeOutput } from "./ProbeModule.js";

/**
 * GraphQL probe: runs GraphQL queries against the deployed service.
 *
 * @remarks
 * Sends GraphQL queries via POST, captures responses, and compares
 * them between PR and base branch. Supports queries, mutations,
 * variables, and operation names.
 */
export class GraphQLProbe implements ProbeModule {
  async run(config: ProbeConfig, targetUrl: string, _workingDirectory?: string): Promise<ProbeOutput> {
    if (config.type !== "graphql") {
      throw new Error(`GraphQLProbe received a non-graphql config: "${config.type}"`);
    }
    const graphqlConfig = config as GraphQLProbeConfig;
    const start = Date.now();

    const results: any[] = [];

    try {
      for (const queryConfig of graphqlConfig.queries) {
        try {
          const url = targetUrl + graphqlConfig.endpoint;
          const body = {
            query: queryConfig.query,
            variables: queryConfig.variables || {},
            operationName: queryConfig.operationName,
          };

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          const responseData = await response.json() as any;

          results.push({
            query: queryConfig.query.substring(0, 100),
            operationName: queryConfig.operationName,
            status: response.status,
            data: responseData.data,
            errors: responseData.errors,
          });
        } catch (error) {
          results.push({
            query: queryConfig.query.substring(0, 100),
            error: (error as Error).message,
          });
        }
      }

      return {
        probeName: graphqlConfig.name,
        probeType: "graphql",
        durationMs: Date.now() - start,
        commandRuns: results.map(r => ({
          args: [r.query],
          stdout: JSON.stringify(r),
          stderr: r.error || '',
          exitCode: r.error ? 1 : 0,
        })),
      };
    } catch (err) {
      return {
        probeName: graphqlConfig.name,
        probeType: "graphql",
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }
}
