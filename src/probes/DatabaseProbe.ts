import type { ProbeConfig, DatabaseProbeConfig } from "../config/schema.js";
import type { ProbeModule, ProbeOutput } from "./ProbeModule.js";

/**
 * Database probe: runs SQL queries directly against a database.
 *
 * @remarks
 * Executes queries and compares results between PR and base branch.
 * Useful for detecting schema changes, data changes, or query
 * behavior differences.
 *
 * Security: Connection strings should use environment variables.
 * Never log connection strings or credentials.
 */
export class DatabaseProbe implements ProbeModule {
  async run(config: ProbeConfig, _targetUrl: string, _workingDirectory?: string): Promise<ProbeOutput> {
    if (config.type !== "database") {
      throw new Error(`DatabaseProbe received a non-database config: "${config.type}"`);
    }
    const dbConfig = config as DatabaseProbeConfig;
    const start = Date.now();

    const results: any[] = [];

    try {
      const dbType = detectDatabaseType(dbConfig.connection);

      for (const queryConfig of dbConfig.queries) {
        try {
          const result = await executeQuery(dbType, dbConfig.connection, queryConfig.sql, queryConfig.params);

          results.push({
            sql: queryConfig.sql,
            rowCount: result.rows.length,
            rows: result.rows,
          });
        } catch (error) {
          results.push({
            sql: queryConfig.sql,
            error: (error as Error).message,
          });
        }
      }

      return {
        probeName: dbConfig.name,
        probeType: "database",
        durationMs: Date.now() - start,
        commandRuns: results.map(r => ({
          args: [r.sql],
          stdout: JSON.stringify({ rowCount: r.rowCount, rows: r.rows }),
          stderr: r.error || '',
          exitCode: r.error ? 1 : 0,
        })),
      };
    } catch (err) {
      return {
        probeName: dbConfig.name,
        probeType: "database",
        durationMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }
}

function detectDatabaseType(connectionString: string): 'postgres' | 'mysql' | 'sqlite' | 'unknown' {
  if (connectionString.startsWith('postgres://') || connectionString.startsWith('postgresql://')) {
    return 'postgres';
  }
  if (connectionString.startsWith('mysql://')) {
    return 'mysql';
  }
  if (connectionString.startsWith('sqlite://') || connectionString.endsWith('.db') || connectionString.endsWith('.sqlite')) {
    return 'sqlite';
  }
  return 'unknown';
}

async function executeQuery(
  dbType: string,
  connectionString: string,
  sql: string,
  params?: any[]
): Promise<{ rows: any[] }> {
  switch (dbType) {
    case 'postgres':
      return executePostgresQuery(connectionString, sql, params);

    case 'mysql':
      return executeMysqlQuery(connectionString, sql, params);

    case 'sqlite':
      return executeSqliteQuery(connectionString, sql, params);

    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

async function executePostgresQuery(
  connectionString: string,
  sql: string,
  params?: any[]
): Promise<{ rows: any[] }> {
  try {
    // @ts-ignore - Optional peer dependency
    const pg = await import('pg');
    const { Client } = pg.default || pg;
    const client = new Client({ connectionString });

    await client.connect();
    const result = await client.query(sql, params);
    await client.end();

    return { rows: result.rows };
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('PostgreSQL support requires the "pg" package. Install with: npm install pg');
    }
    throw error;
  }
}

async function executeMysqlQuery(
  connectionString: string,
  sql: string,
  params?: any[]
): Promise<{ rows: any[] }> {
  try {
    // @ts-ignore - Optional peer dependency
    const mysql = await import('mysql2/promise');
    const mysqlLib = mysql.default || mysql;
    const connection = await mysqlLib.createConnection(connectionString);

    const [rows] = await connection.execute(sql, params);
    await connection.end();

    return { rows: rows as any[] };
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('MySQL support requires the "mysql2" package. Install with: npm install mysql2');
    }
    throw error;
  }
}

async function executeSqliteQuery(
  connectionString: string,
  sql: string,
  params?: any[]
): Promise<{ rows: any[] }> {
  try {
    // @ts-ignore - Optional peer dependency
    const sqlite3Module = await import('sqlite3');
    // @ts-ignore - Optional peer dependency
    const sqliteModule = await import('sqlite');

    const sqlite3 = sqlite3Module.default || sqlite3Module;
    const { open } = sqliteModule;

    const dbPath = connectionString.replace('sqlite://', '');
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    const rows = await db.all(sql, params);
    await db.close();

    return { rows };
  } catch (error: any) {
    if (error.code === 'MODULE_NOT_FOUND' || error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('SQLite support requires the "sqlite" and "sqlite3" packages. Install with: npm install sqlite sqlite3');
    }
    throw error;
  }
}
