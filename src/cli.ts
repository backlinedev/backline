#!/usr/bin/env node

import { loadConfigFromFile } from "./config/loader.js";
import { validateConfigSemantics } from "./config/validate.js";
import { ComposeAdapter } from "./adapters/ComposeAdapter.js";
import { FileCacheStore } from "./cache/FileCacheStore.js";
import { runBackline } from "./orchestrator.js";
import { runInit } from "./init/index.js";

const VERSION = "0.1.0";

/**
 * Main CLI entry point with subcommand support.
 */
async function main(): Promise<void> {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv[0] === '--help' || argv[0] === '-h') {
    printHelp();
    return;
  }

  if (argv[0] === '--version' || argv[0] === '-v') {
    console.log(`backline v${VERSION}`);
    return;
  }

  const command = argv[0];
  const args = parseArgs(argv.slice(1));

  switch (command) {
    case 'init':
      await runInitCommand(args);
      break;

    case 'test':
      await runTestCommand(args);
      break;

    case 'validate':
      await runValidateCommand(args);
      break;

    case 'generate':
      await runGenerateCommand(args);
      break;

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "backline --help" for usage information.');
      process.exit(1);
  }
}

async function runInitCommand(args: Record<string, string>): Promise<void> {
  const projectRoot = process.cwd();
  const force = args.force === 'true';
  const yes = args.yes === 'true' || args.y === 'true';
  const framework = args.framework;

  await runInit(projectRoot, { force, yes, framework });
}

async function runTestCommand(args: Record<string, string>): Promise<void> {
  const configPath = args.config ?? ".backline.yml";
  const headRef = args["head-ref"] ?? "HEAD";
  const baseRef = args["base-ref"] ?? "main";

  const config = await loadConfigFromFile(configPath);
  await validateConfigSemantics(config);

  const adapter = new ComposeAdapter();
  const cache = new FileCacheStore();

  const { commentBody } = await runBackline({
    config,
    adapter,
    cache,
    headRef,
    baseRef,
    // No postComment callback — local runs just print, never touch GitHub.
  });

  console.log(commentBody);
}

async function runValidateCommand(args: Record<string, string>): Promise<void> {
  const configPath = args.config ?? ".backline.yml";

  try {
    const config = await loadConfigFromFile(configPath);
    await validateConfigSemantics(config);

    console.log(`✓ Configuration is valid: ${configPath}`);
    console.log(`  Probes: ${config.probes.length}`);
    console.log(`  Adapter: ${config.target.adapter}`);

    if (config.target.base_url) {
      console.log(`  Base URL: ${config.target.base_url}`);
    }
  } catch (error) {
    console.error(`✗ Configuration is invalid: ${(error as Error).message}`);
    process.exit(1);
  }
}

async function runGenerateCommand(args: Record<string, string>): Promise<void> {
  const { generateProbesFromSpec } = await import('./openapi/index.js');

  const specPath = args.spec || args.openapi;

  if (!specPath) {
    console.error('Error: --spec or --openapi flag required');
    console.error('Usage: backline generate --spec openapi.yaml');
    process.exit(1);
  }

  try {
    const probesYaml = await generateProbesFromSpec(specPath);
    console.log('# Generated probes from OpenAPI spec');
    console.log('# Add this to your .backline.yml file\n');
    console.log(probesYaml);
  } catch (error) {
    console.error(`Error generating probes: ${(error as Error).message}`);
    process.exit(1);
  }
}

function printHelp(): void {
  console.log(`
backline v${VERSION}

Runtime behavior previews for pull requests.

USAGE:
  backline <command> [options]

COMMANDS:
  init              Set up Backline in your project
  test              Run Backline locally without CI
  validate          Validate .backline.yml configuration
  generate          Generate probes from OpenAPI spec

OPTIONS:
  --help, -h        Show this help message
  --version, -v     Show version number

EXAMPLES:
  # Initialize Backline (interactive)
  backline init

  # Initialize with defaults (non-interactive)
  backline init --yes

  # Test locally
  backline test --config .backline.yml --head-ref HEAD --base-ref main

  # Validate configuration
  backline validate --config .backline.yml

  # Generate probes from OpenAPI spec
  backline generate --spec openapi.yaml

For more information, visit https://github.com/backlinedev/backline
`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
      out[key] = value;
    }
  }
  return out;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
