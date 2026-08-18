# Quick Start Guide

Get Backline running in your project in under 5 minutes.

## What You'll Need

- A Git repository with a `main` or `master` branch
- Docker and Docker Compose installed
- A working API or CLI tool

## Step 1: Install Backline

### As a GitHub Action (recommended)

No installation needed! Just add a workflow file.

### As a CLI tool

```bash
npm install -g @backlinedev/backline
# or
npx backline --version
```

## Step 2: Initialize Backline

The easiest way to get started is with the `init` command:

```bash
npx backline init
```

This will:
1. Detect your framework (Next.js, Express, FastAPI, Rails, CLI)
2. Generate `.backline.yml` with framework-specific defaults
3. Create `.github/workflows/backline.yml`
4. Prompt you to customize endpoints/commands

Or manually create `.backline.yml`:

### For an API

```yaml
version: 1

target:
  base_url: "http://localhost:3000"
  wait_for:
    path: /health
    timeout_seconds: 30
  adapter: compose

probes:
  - type: api
    name: "main endpoints"
    requests:
      - method: GET
        path: /api/users
      - method: POST
        path: /api/search
        body:
          query: "test"
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
```

### For a CLI tool

```yaml
version: 1

target:
  adapter: compose

probes:
  - type: cli
    name: "version check"
    binary: ./dist/cli
    commands:
      - args: ["--version"]
      - args: ["--help"]
    diff:
      against: base_branch
      normalize:
        - strip_ansi
```

## Step 3: Ensure Docker Compose is Configured

Backline uses your existing `docker-compose.yml`. Make sure you have one:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
```

If you don't have Docker Compose yet, add one. Your app should build and run with:

```bash
docker-compose up
```

## Step 4: Test Locally (Optional but Recommended)

Before setting up CI, test Backline locally:

```bash
npx backline test --config .backline.yml --head-ref HEAD --base-ref main
```

This will:
1. Deploy your current branch
2. Deploy the `main` branch
3. Run all probes against both
4. Show the diff

**If you see errors**, fix them before proceeding to CI. Common issues:
- Docker not running → Start Docker
- Build failures → Fix your Dockerfile
- Health check timeout → Increase `timeout_seconds` or fix your `/health` endpoint

## Step 5: Add GitHub Actions Workflow

Create `.github/workflows/backline.yml`:

```yaml
name: Backline

on:
  pull_request:
    types: [opened, synchronize, closed]

permissions:
  contents: read
  pull-requests: write

jobs:
  backline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: backlinedev/backline@v1
        with:
          config: .backline.yml
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

**Important:** The `fetch-depth: 0` is required so Backline can access both branches.

## Step 6: Open a Pull Request

Make a change and open a PR:

```bash
git checkout -b test-backline
# Make a change to your code
git add -A
git commit -m "Test Backline"
git push origin test-backline
```

Open a PR on GitHub. Backline will:
1. Run automatically
2. Post a comment with the diff
3. Show the results in the Actions tab

## That's It!

You now have automated runtime behavior testing on every PR.

## Next Steps

### 1. Refine Your Probes

Add more probes to test critical endpoints:

```yaml
probes:
  - type: api
    name: "authentication"
    requests:
      - method: POST
        path: /auth/login
        body:
          email: "test@example.com"
          password: "password"
```

### 2. Ignore Noisy Fields

If you see false positives from fields that always change:

```yaml
ignore_fields:
  - "requests[*].response.body.timestamp"
  - "requests[*].response.body.request_id"
  - "requests[*].response.body.user.id"
```

### 3. Test Different Scenarios

```yaml
requests:
  - method: GET
    path: /api/users  # Happy path
  - method: GET
    path: /api/users/99999  # 404 error
  - method: POST
    path: /api/users
    body: {}  # Validation error
```

### 4. Add More Examples

Check the `examples/` directory for:
- [Express API](../examples/01-express-api)
- [Next.js API Routes](../examples/02-nextjs-api-routes)
- [CLI Tool](../examples/03-cli-tool)
- [Multi-Service Setup](../examples/04-docker-compose-multi)

## Common Issues

### "Docker not found"

Make sure Docker is installed and running:

```bash
docker --version
docker-compose --version
```

### "Health check timeout"

Your service might be taking longer to start. Increase the timeout:

```yaml
wait_for:
  timeout_seconds: 60
```

Or check if your health endpoint is actually working:

```bash
docker-compose up
curl http://localhost:3000/health
```

### "Base branch results not found"

This happens on the first run. Backline needs to deploy the base branch first. Just wait for the full run to complete - subsequent PRs will be faster.

### "Diff shows everything as changed"

You probably forgot to ignore timestamp fields:

```yaml
ignore_fields:
  - "requests[*].response.body.timestamp"
  - "requests[*].response.body.created_at"
```

Any field that changes on every request should be ignored.

## Getting Help

- **Documentation:** See [config-reference.md](./config-reference.md) for all options
- **Examples:** Browse `examples/` directory for working setups
- **Issues:** Report bugs at https://github.com/backlinedev/backline/issues
- **Discussions:** Ask questions in GitHub Discussions

## What's Next?

Now that Backline is running:

1. **Catch regressions early** - Every PR now shows runtime behavior changes
2. **Upgrade dependencies with confidence** - See exactly what changes
3. **Review faster** - Automated behavior validation reduces review burden
4. **Ship with confidence** - Know what your code actually does, not just what changed

Happy testing!
