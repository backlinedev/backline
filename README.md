# Backline

**Runtime behavior previews for pull requests.**

[![CI](https://img.shields.io/github/actions/workflow/status/backlinedev/backline/backline.yml?branch=main&label=CI)](https://github.com/backlinedev/backline/actions)
[![License](https://img.shields.io/github/license/backlinedev/backline)](LICENSE)
[![npm](https://img.shields.io/npm/v/backline)](https://www.npmjs.com/package/backline)
[![Node](https://img.shields.io/badge/node-%3E%3D20-informational)](package.json)

Backline deploys a pull request's branch and its base branch, runs the same checks against both, and reports what the code actually does differently at runtime — not what changed in the diff, but what changed in behavior. It works for APIs and command-line tools, requires no database, no hosted service, and no account of any kind. Everything runs inside your own CI job.

## Why Backline

GitHub already shows you what changed in the source. It cannot show you what that change actually does once it runs. Backline exists specifically for the gap between the two:

- **Runtime, not source.** A dependency bump, a config change, or a "no-op" refactor can silently alter behavior without a single meaningful line in a diff. Backline catches exactly this class of change, because it never reads your source — it calls the running code and compares what comes back.
- **APIs and CLIs, natively.** Two first-class probe types: fire a set of HTTP requests at a deployed instance, or run a built binary with a set of arguments. Both diff their output against the same code running on the base branch.
- **Zero infrastructure.** No managed database, no hosted control plane, no vendor account. State that needs to persist between runs is a single cached JSON file. Credentials are never touched, stored, or logged by Backline — they pass through from your own CI secrets or a local env file, exactly as they would for any other step in your pipeline.
- **Pluggable by design.** The deploy mechanism, the probe types, and the diff strategy are each isolated behind a small interface. The default deploy adapter is Docker Compose; anything that already deploys your PRs can be wired in behind the same interface without touching the rest of the system.
- **A real comparison, not two copies of the same thing.** Head and base are checked out into isolated git worktrees and run as fully independent, simultaneous deployments — not the same build probed twice.

## How it works

1. A pull request opens, or a new commit is pushed.
2. Backline reads `.backline.yml` from the pull request's branch.
3. It deploys the PR branch and the base branch as two independent, isolated environments.
4. It runs every configured probe against both, waiting for each to report healthy before probing.
5. Responses are diffed field by field. Fields expected to vary between runs — timestamps, request identifiers — are excluded explicitly in configuration, never guessed at automatically.
6. Results are scrubbed for anything resembling a leaked credential, then posted as a comment on the pull request.
7. Both environments are torn down when the run completes, or when the pull request closes.

## Configuration

```yaml
version: 1

target:
  base_url: "http://localhost:4000"
  wait_for:
    path: /health
    timeout_seconds: 60
  adapter: compose

probes:
  - type: api
    name: search endpoint
    requests:
      - method: POST
        path: /search
        body:
          query: "example"
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"

  - type: cli
    name: version check
    binary: ./dist/cli
    commands:
      - args: ["--version"]
    diff:
      against: base_branch
```

The full schema, including cross-repository dependencies and lifecycle controls, is documented in `.backline.yml.example`.

## Usage

As a GitHub Action:

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

From the command line, without CI:

```bash
npm install -g backline
backline test --config .backline.yml --head-ref HEAD --base-ref main
```

## Installation

```bash
npm install
npm run typecheck
npm test
npm run build
```

## Architecture

| Directory | Responsibility |
|---|---|
| `src/config` | Schema, loading, and semantic validation for `.backline.yml` |
| `src/diff` | Structural comparison between two probe results |
| `src/probes` | API and CLI probe implementations and the type registry |
| `src/adapters` | Deploy adapters — Docker Compose by default, a generic webhook adapter for existing pipelines |
| `src/cache` | File-backed storage for base-branch results between runs |
| `src/render` | Secret redaction and comment formatting |
| `src/github` | The single Octokit client every other file goes through |
| `src/orchestrator.ts` | The run lifecycle, wiring every component above together |

A full architectural writeup, including the interface contracts each component satisfies, is in `backline-architecture.md`.

## Comparison to Alternatives

| Feature | Backline | Preview.dev | Chromatic | PullPreview |
|---------|----------|-------------|-----------|-------------|
| **Tests APIs** | Yes | Yes | No | No |
| **Tests CLIs** | Yes | No | No | No |
| **Tests UI** | No | No | Yes | Yes |
| **Zero infrastructure** | Yes | No | No | No |
| **Requires account** | No | Yes | Yes | Yes |
| **Self-hosted** | Yes | No | No | Yes |
| **Framework-agnostic** | Yes | Yes | No (React only) | Yes |
| **Compares runtime behavior** | Yes | Yes | Yes (visual) | No (deploy only) |
| **Open source** | Yes | No | No | No |

**When to use Backline:**
- You have APIs or CLI tools (not browser UIs)
- You want zero vendor lock-in
- You need to test in your own CI
- You want to catch dependency upgrade regressions

**When not to use Backline:**
- You need visual regression testing for UIs → use Chromatic or Percy
- You just need preview URLs (not behavior diffs) → use PullPreview or Vercel
- You test browser interactions → use Playwright or Cypress

## FAQ

### How is this different from integration tests?

Integration tests check if your code works. Backline checks if it works **differently** than before.

**Example:**
```javascript
// Your test
expect(response.status).toBe(200); // Passes

// But the response changed from this on main:
{ users: [...], total: 10 }

// To this on your PR:
{ users: [...], count: 10 }  // Field renamed!

// Your test still passes, but Backline catches this breaking change.
```

### Does Backline replace my tests?

No. Backline complements your tests:
- **Unit/integration tests** → Verify correctness
- **Backline** → Verify behavior hasn't unexpectedly changed

Use both for comprehensive coverage.

### How fast is it?

**First run:** 2-5 minutes (builds and deploys both branches)  
**Subsequent runs:** 1-3 minutes (base branch cached)

Backline caches base-branch results by commit SHA, so only the PR branch needs full deployment on subsequent runs.

### What about secrets?

Backline never stores secrets. Secrets pass through from CI exactly as they would for any other step:

```yaml
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

Results are scrubbed for leaked credentials before posting.

### Can I use this with monorepos?

Yes! Place `.backline.yml` in each package directory, or use a single config that tests multiple services.

### Does this work with databases?

Yes. Your `docker-compose.yml` can include a database service. Backline tests against the full stack.

### What if my API requires authentication?

Pass auth tokens in request headers:

```yaml
requests:
  - method: GET
    path: /api/profile
    headers:
      Authorization: "Bearer ${{ secrets.TEST_TOKEN }}"
```

### Can I test staging/production instead of local deploys?

Yes, with the webhook adapter:

```yaml
target:
  adapter: webhook
```

Point it at your existing deploy pipeline.

### How do I ignore fields that always change?

Use `ignore_fields` with JSON path syntax:

```yaml
diff:
  ignore_fields:
    - "requests[*].response.body.timestamp"
    - "requests[*].response.body.request_id"
```

See [docs/config-reference.md](docs/config-reference.md) for full syntax.

## Troubleshooting

### "Docker not found"

**Cause:** Docker is not installed or not running.

**Fix:**
```bash
# Install Docker
# https://docs.docker.com/get-docker/

# Start Docker
docker --version  # Should print version
```

### "Health check timeout"

**Cause:** Your service is taking longer than `timeout_seconds` to become healthy, or the health endpoint is broken.

**Fix:**
1. Test health endpoint manually:
   ```bash
   docker-compose up
   curl http://localhost:3000/health
   ```

2. Increase timeout in `.backline.yml`:
   ```yaml
   wait_for:
     timeout_seconds: 60
   ```

3. Check Docker logs:
   ```bash
   docker-compose logs
   ```

### "Binary not found" (CLI probes)

**Cause:** The CLI binary doesn't exist at the specified path.

**Fix:**
1. Make sure you build before testing:
   ```yaml
   # In GitHub Actions
   - run: npm run build
   - uses: backlinedev/backline@v1
   ```

2. Verify the path is correct:
   ```yaml
   binary: ./dist/cli.js  # Relative to container working directory
   ```

3. Make it executable:
   ```bash
   chmod +x dist/cli.js
   ```

### "Diff shows everything as changed"

**Cause:** You forgot to ignore timestamp or ID fields that change on every run.

**Fix:**
```yaml
ignore_fields:
  - "requests[*].response.body.timestamp"
  - "requests[*].response.body.created_at"
  - "requests[*].response.body.id"
```

### "Base branch results not found"

**Cause:** First run on this base branch commit. Backline needs to build and cache the base branch results.

**Fix:** This is normal. Wait for the run to complete. Subsequent PRs will be faster.

### "Port already in use"

**Cause:** Another process is using the port.

**Fix:**
1. Find and kill the process:
   ```bash
   lsof -ti:3000 | xargs kill
   ```

2. Or change the port in `docker-compose.yml`:
   ```yaml
   ports:
     - "3001:3000"
   ```

   And update `.backline.yml`:
   ```yaml
   base_url: "http://localhost:3001"
   ```

### "Permission denied" (GitHub Actions)

**Cause:** Missing write permission for PR comments.

**Fix:**
```yaml
permissions:
  contents: read
  pull-requests: write  # Required for posting comments
```

### "Fetch depth 0 required"

**Cause:** Backline needs full git history to access both branches.

**Fix:**
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0  # Required
```

### Need more help?

- **Documentation:** [docs/config-reference.md](docs/config-reference.md)
- **Examples:** Browse the `examples/` directory
- **Issues:** Report bugs at https://github.com/backlinedev/backline/issues

## Current Limitations

This is an early, actively developed project. The following are known gaps, not hidden ones:

- Base-branch results are cached by commit SHA; a pull request left open while the base branch continues to move will not automatically refresh its comparison.
- The diff engine performs exact-value comparison. Outputs with expected floating-point or non-deterministic variance require configuring `ignore_fields` explicitly; a tolerance-based comparison is planned but not yet implemented.
- The default adapter deploys via Docker Compose on the runner itself. There is no built-in mechanism yet for exposing a deployed instance as a browsable link; this is planned as a near-term addition.
- CLI probes are primarily tested against Linux CI runners (the environment GitHub Actions provides). `cross-spawn` is used internally for command resolution, which handles Windows path and shell differences, but Windows usage of the local CLI (`backline test --local`) has not been extensively verified.

## License

MIT. See [LICENSE](LICENSE).
