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

## Current limitations

This is an early, actively developed project. The following are known gaps, not hidden ones:

- Base-branch results are cached by commit SHA; a pull request left open while the base branch continues to move will not automatically refresh its comparison.
- The diff engine performs exact-value comparison. Outputs with expected floating-point or non-deterministic variance require configuring `ignore_fields` explicitly; a tolerance-based comparison is planned but not yet implemented.
- The default adapter deploys via Docker Compose on the runner itself. There is no built-in mechanism yet for exposing a deployed instance as a browsable link; this is planned as a near-term addition.
- CLI probes are primarily tested against Linux CI runners (the environment GitHub Actions provides). `cross-spawn` is used internally for command resolution, which handles Windows path and shell differences, but Windows usage of the local CLI (`backline test --local`) has not been extensively verified.

## License

MIT. See [LICENSE](LICENSE).
