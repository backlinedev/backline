# CLI Tool Example

This example demonstrates how to use Backline to test command-line tools and binaries.

## What This Example Tests

This example shows Backline testing a CLI tool with:
- **Version and help output** - Tests `--version` and `--help` flags
- **File analysis** - Analyzes CSV files and outputs JSON
- **Data transformation** - Transforms text with different options
- **System info** - Outputs system information

## What Backline Catches

Backline will detect changes such as:
- Different command output after refactoring
- Breaking changes to CLI arguments or flags
- Changes in error messages or validation
- Dependency upgrades affecting CLI behavior
- Different default behaviors

## CLI Testing vs API Testing

### Key Differences

1. **No health check** - CLI tools don't have a `/health` endpoint
2. **Stdout/stderr capture** - Tests capture command output
3. **Exit codes matter** - Non-zero exit codes indicate errors
4. **ANSI color codes** - Must be stripped with `normalize: [strip_ansi]`

### Configuration

For CLI tools, the target config is minimal:

```yaml
target:
  adapter: compose  # Just need a container to run commands in
```

No `base_url` or `wait_for` needed.

## Probes Configuration

The [.backline.yml](.backline.yml) defines 4 CLI probes:

### 1. Version and Help
```yaml
- type: cli
  binary: ./dist/cli.js
  commands:
    - args: ["--version"]
    - args: ["--help"]
```

Tests basic CLI output that should be stable.

### 2. Analyze Command
```yaml
- type: cli
  binary: ./dist/cli.js
  commands:
    - args: ["analyze", "--file", "fixtures/sample.csv"]
```

Tests data processing logic with fixture files.

### 3. Transform Command
```yaml
commands:
  - args: ["transform", "--input", "fixtures/input.txt", "--type", "uppercase"]
```

Tests different transformation types.

### 4. Info Command
```yaml
diff:
  ignore_fields:
    - "uptime"
    - "cwd"
```

Ignores fields that change between runs (process uptime, working directory).

## Normalization Options

CLI output often contains ANSI color codes and timestamps. Use `normalize` to clean these:

```yaml
diff:
  normalize:
    - strip_ansi        # Remove color codes
    - strip_timestamps  # Remove common timestamp patterns
```

## Running Locally

```bash
# Install dependencies
npm install

# Build the CLI
npm run build

# Test manually
./dist/cli.js --version
./dist/cli.js analyze --file fixtures/sample.csv

# Test with Backline
npx backline test --config .backline.yml --head-ref HEAD --base-ref main
```

## Docker Setup

The Dockerfile builds the CLI and keeps the container running:

```dockerfile
CMD ["tail", "-f", "/dev/null"]
```

This allows Backline to execute commands in the running container without the container exiting.

## Common CLI Testing Patterns

### Testing Error Cases

```yaml
commands:
  - args: ["analyze", "--file", "nonexistent.csv"]  # Should exit with error
```

Backline captures exit codes and stderr. Changes to error handling will be detected.

### Testing Stdin

```yaml
commands:
  - args: ["process"]
    stdin: "input data here"
```

Some commands read from stdin. Backline supports piping input.

### Testing with Environment Variables

Add environment variables to the Docker Compose file:

```yaml
services:
  cli:
    environment:
      - DEBUG=true
      - API_KEY=${{ secrets.API_KEY }}
```

### Multiple Binaries

Test multiple executables:

```yaml
probes:
  - type: cli
    binary: ./dist/cli.js
    commands: [...]
  
  - type: cli
    binary: ./scripts/deploy.sh
    commands: [...]
```

## Use Cases

This pattern works for:
- Data processing CLIs
- Build tools and compilers
- Code generators
- Database migration tools
- DevOps scripts
- Any executable that takes arguments and produces output

## Troubleshooting

### Binary Not Found

Make sure to build before testing:

```yaml
# In GitHub Actions, add a build step
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
  - run: npm install && npm run build
  - uses: backlinedev/backline@v1
```

### Permission Denied

Make the binary executable:

```bash
chmod +x dist/cli.js
```

Or in package.json build script:
```json
"build": "tsc && chmod +x dist/cli.js"
```

### ANSI Color Codes in Diff

Add normalization:
```yaml
diff:
  normalize:
    - strip_ansi
```

### Path Issues

CLI probes run from the container's working directory. Use relative paths:
```yaml
binary: ./dist/cli.js          # Relative path
binary: /app/dist/cli.js        # Absolute path (breaks in different environments)
```

## Next Steps

- See [examples/01-express-api](../01-express-api) for API testing
- See [examples/04-docker-compose-multi](../04-docker-compose-multi) for multi-service setups
- Read the [full config reference](../../docs/config-reference.md)
