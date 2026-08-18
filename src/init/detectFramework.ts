import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export type Framework =
  | 'nextjs'
  | 'express'
  | 'fastapi'
  | 'rails'
  | 'cli'
  | 'unknown';

export interface FrameworkDetectionResult {
  framework: Framework;
  confidence: 'high' | 'medium' | 'low';
  details: {
    packageManager?: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'bundler';
    hasDockerfile?: boolean;
    hasDockerCompose?: boolean;
    detectedPaths?: string[];
  };
}

/**
 * Detect the framework used in the current project.
 *
 * @remarks
 * Checks for framework-specific files and patterns to determine
 * which framework (if any) is being used. This informs what kind
 * of default `.backline.yml` to generate.
 */
export function detectFramework(projectRoot: string): FrameworkDetectionResult {
  const details: FrameworkDetectionResult['details'] = {
    hasDockerfile: existsSync(join(projectRoot, 'Dockerfile')),
    hasDockerCompose: existsSync(join(projectRoot, 'docker-compose.yml')),
  };

  // Check for Next.js
  if (existsSync(join(projectRoot, 'next.config.js')) ||
      existsSync(join(projectRoot, 'next.config.mjs')) ||
      existsSync(join(projectRoot, 'next.config.ts'))) {
    details.packageManager = detectPackageManager(projectRoot);
    details.detectedPaths = ['next.config.js'];

    // Check for App Router vs Pages Router
    const hasAppDir = existsSync(join(projectRoot, 'app'));
    const hasPagesDir = existsSync(join(projectRoot, 'pages'));

    if (hasAppDir) {
      details.detectedPaths.push('app/');
    }
    if (hasPagesDir) {
      details.detectedPaths.push('pages/');
    }

    return {
      framework: 'nextjs',
      confidence: 'high',
      details,
    };
  }

  // Check for Express (look for express in package.json dependencies)
  const packageJsonPath = join(projectRoot, 'package.json');
  if (existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      if (deps.express) {
        details.packageManager = detectPackageManager(projectRoot);
        details.detectedPaths = ['package.json'];

        return {
          framework: 'express',
          confidence: 'high',
          details,
        };
      }

      // Check if this is a CLI tool (has bin field)
      if (packageJson.bin) {
        details.packageManager = detectPackageManager(projectRoot);
        details.detectedPaths = ['package.json (bin field)'];

        return {
          framework: 'cli',
          confidence: 'high',
          details,
        };
      }
    } catch (e) {
      // Invalid package.json, continue checking
    }
  }

  // Check for FastAPI/Python
  if (existsSync(join(projectRoot, 'requirements.txt')) ||
      existsSync(join(projectRoot, 'pyproject.toml'))) {
    try {
      const reqPath = join(projectRoot, 'requirements.txt');
      if (existsSync(reqPath)) {
        const requirements = readFileSync(reqPath, 'utf-8');
        if (requirements.includes('fastapi') || requirements.includes('uvicorn')) {
          details.packageManager = 'pip';
          details.detectedPaths = ['requirements.txt'];

          return {
            framework: 'fastapi',
            confidence: 'high',
            details,
          };
        }
      }
    } catch (e) {
      // Continue checking
    }
  }

  // Check for Rails
  if (existsSync(join(projectRoot, 'Gemfile')) &&
      existsSync(join(projectRoot, 'config/application.rb'))) {
    details.packageManager = 'bundler';
    details.detectedPaths = ['Gemfile', 'config/application.rb'];

    return {
      framework: 'rails',
      confidence: 'high',
      details,
    };
  }

  // Check if it's a generic CLI (has a bin/ or src/cli.* file)
  if (existsSync(join(projectRoot, 'src/cli.ts')) ||
      existsSync(join(projectRoot, 'src/cli.js')) ||
      existsSync(join(projectRoot, 'bin'))) {
    details.packageManager = detectPackageManager(projectRoot);
    details.detectedPaths = ['src/cli.ts or bin/'];

    return {
      framework: 'cli',
      confidence: 'medium',
      details,
    };
  }

  // Unknown framework
  return {
    framework: 'unknown',
    confidence: 'low',
    details,
  };
}

function detectPackageManager(projectRoot: string): 'npm' | 'yarn' | 'pnpm' | 'pip' | 'bundler' {
  if (existsSync(join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(projectRoot, 'yarn.lock'))) return 'yarn';
  if (existsSync(join(projectRoot, 'package-lock.json'))) return 'npm';
  if (existsSync(join(projectRoot, 'requirements.txt'))) return 'pip';
  if (existsSync(join(projectRoot, 'Gemfile'))) return 'bundler';
  return 'npm'; // default
}
