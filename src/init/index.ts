import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { detectFramework } from './detectFramework.js';
import { generateConfig, type ConfigOptions } from './generateConfig.js';
import { generateWorkflow } from './generateWorkflow.js';
import { prompt, confirm, multiSelect } from './prompts.js';

export interface InitOptions {
  force?: boolean;
  yes?: boolean;
  framework?: string;
}

/**
 * Run the `backline init` command to set up a new Backline configuration.
 *
 * @remarks
 * Detects the framework, prompts for configuration options, and generates
 * `.backline.yml` and `.github/workflows/backline.yml` files.
 */
export async function runInit(projectRoot: string, options: InitOptions = {}): Promise<void> {
  console.log('🔍 Detecting framework...\n');

  const detection = detectFramework(projectRoot);

  console.log(`Framework: ${detection.framework} (${detection.confidence} confidence)`);
  if (detection.details.detectedPaths) {
    console.log(`Detected: ${detection.details.detectedPaths.join(', ')}`);
  }
  console.log();

  // Check if .backline.yml already exists
  const configPath = join(projectRoot, '.backline.yml');
  if (existsSync(configPath) && !options.force) {
    console.log('❌ .backline.yml already exists. Use --force to overwrite.');
    return;
  }

  // Prompt for configuration based on framework
  const framework = detection.framework;
  let configOptions: ConfigOptions;

  if (framework === 'cli') {
    configOptions = await promptCliConfig(options);
  } else {
    configOptions = await promptApiConfig(framework, detection.details.hasDockerCompose, options);
  }

  // Generate config
  console.log('\n📝 Generating configuration...\n');
  const configContent = generateConfig(configOptions);

  // Write .backline.yml
  writeFileSync(configPath, configContent, 'utf-8');
  console.log('✓ Created .backline.yml');

  // Generate workflow file
  const workflowDir = join(projectRoot, '.github', 'workflows');
  const workflowPath = join(workflowDir, 'backline.yml');

  if (!existsSync(workflowPath) || options.force) {
    if (!existsSync(workflowDir)) {
      mkdirSync(workflowDir, { recursive: true });
    }

    const workflowContent = generateWorkflow('.backline.yml');
    writeFileSync(workflowPath, workflowContent, 'utf-8');
    console.log('✓ Created .github/workflows/backline.yml');
  } else {
    console.log('⊘ Skipped .github/workflows/backline.yml (already exists)');
  }

  // Check for docker-compose.yml
  const dockerComposePath = join(projectRoot, 'docker-compose.yml');
  if (!existsSync(dockerComposePath)) {
    console.log('\n⚠️  docker-compose.yml not found. Backline requires Docker Compose to deploy your app.');
    console.log('   Create one before running Backline. See examples/ for reference.');
  }

  console.log('\n✅ Backline is ready! Next steps:');
  console.log('   1. Review and customize .backline.yml');
  console.log('   2. Ensure you have a docker-compose.yml');
  console.log('   3. Test locally: backline test --config .backline.yml --head-ref HEAD --base-ref main');
  console.log('   4. Open a PR to see Backline in action!');
}

async function promptApiConfig(
  framework: string,
  hasDockerCompose: boolean | undefined,
  options: InitOptions
): Promise<ConfigOptions> {
  const baseUrl = options.yes
    ? 'http://localhost:3000'
    : await prompt('Base URL', 'http://localhost:3000');

  const healthPath = options.yes
    ? '/health'
    : await prompt('Health check path', framework === 'fastapi' ? '/docs' : '/health');

  const timeout = options.yes
    ? 30
    : parseInt(await prompt('Health check timeout (seconds)', '30'), 10);

  // Suggest common endpoints based on framework
  let suggestedEndpoints: string[] = [];

  if (framework === 'nextjs') {
    suggestedEndpoints = ['/api/hello', '/api/users', '/api/posts'];
  } else if (framework === 'express') {
    suggestedEndpoints = ['/api/users', '/api/health', '/api/status'];
  } else if (framework === 'fastapi') {
    suggestedEndpoints = ['/docs', '/health', '/api/v1/users'];
  } else if (framework === 'rails') {
    suggestedEndpoints = ['/api/v1/health', '/api/v1/users'];
  } else {
    suggestedEndpoints = ['/api/health', '/api/users'];
  }

  let endpoints: string[] = [];

  if (!options.yes) {
    console.log('\nWhich endpoints should Backline test?');
    const selectedEndpoints = await multiSelect(
      'Select endpoints (or press Enter to use defaults)',
      suggestedEndpoints,
      [suggestedEndpoints[0]]
    );

    endpoints = selectedEndpoints;

    const addMore = await confirm('Add custom endpoints?', false);
    if (addMore) {
      const customEndpoint = await prompt('Custom endpoint path (e.g., /api/custom)');
      if (customEndpoint) {
        endpoints.push(customEndpoint);
      }
    }
  } else {
    endpoints = [suggestedEndpoints[0]];
  }

  return {
    framework: framework as any,
    baseUrl,
    healthPath,
    timeout,
    endpoints,
  };
}

async function promptCliConfig(options: InitOptions): Promise<ConfigOptions> {
  const binaryPath = options.yes
    ? './dist/cli'
    : await prompt('Path to CLI binary', './dist/cli');

  let commands: string[] = [];

  if (!options.yes) {
    const suggestedCommands = ['--version', '--help'];

    console.log('\nWhich commands should Backline test?');
    const selectedCommands = await multiSelect(
      'Select commands',
      suggestedCommands,
      suggestedCommands
    );

    commands = selectedCommands;

    const addMore = await confirm('Add custom commands?', false);
    if (addMore) {
      const customCommand = await prompt('Custom command (e.g., process --input file.csv)');
      if (customCommand) {
        commands.push(customCommand);
      }
    }
  } else {
    commands = ['--version', '--help'];
  }

  return {
    framework: 'cli',
    baseUrl: '',
    healthPath: '',
    timeout: 30,
    endpoints: commands,
    binaryPath,
  };
}
