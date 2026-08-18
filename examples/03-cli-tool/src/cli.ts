#!/usr/bin/env node

import { program } from 'commander';
import { readFileSync } from 'fs';
import { join } from 'path';

program
  .name('datatool')
  .description('CLI tool for data processing')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze a CSV file')
  .requiredOption('-f, --file <path>', 'Path to CSV file')
  .option('-s, --stats', 'Show statistics', false)
  .action((options) => {
    try {
      const content = readFileSync(options.file, 'utf-8');
      const lines = content.trim().split('\n');
      const headers = lines[0].split(',');
      const rows = lines.slice(1);

      console.log(JSON.stringify({
        file: options.file,
        rows: rows.length,
        columns: headers.length,
        headers: headers,
        sample: rows.slice(0, 3).map(row => {
          const values = row.split(',');
          return headers.reduce((obj, header, i) => {
            obj[header] = values[i];
            return obj;
          }, {} as Record<string, string>);
        }),
        ...(options.stats && {
          stats: {
            avgRowLength: Math.round(rows.reduce((sum, row) => sum + row.length, 0) / rows.length),
            totalSize: content.length
          }
        })
      }, null, 2));
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('transform')
  .description('Transform data')
  .requiredOption('-i, --input <path>', 'Input file')
  .option('-t, --type <type>', 'Transform type', 'uppercase')
  .action((options) => {
    try {
      const content = readFileSync(options.input, 'utf-8');

      let result: string;
      switch (options.type) {
        case 'uppercase':
          result = content.toUpperCase();
          break;
        case 'lowercase':
          result = content.toLowerCase();
          break;
        case 'reverse':
          result = content.split('').reverse().join('');
          break;
        default:
          throw new Error(`Unknown transform type: ${options.type}`);
      }

      console.log(result);
    } catch (error) {
      console.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program
  .command('info')
  .description('Show system information')
  .action(() => {
    console.log(JSON.stringify({
      platform: process.platform,
      nodeVersion: process.version,
      arch: process.arch,
      cwd: process.cwd(),
      uptime: process.uptime()
    }, null, 2));
  });

program.parse();
