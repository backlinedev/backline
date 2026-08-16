# Backline

Non-UI PR previews: diffs API and CLI behavior between a pull request's branch and its base branch. No cloud, no database, no vendor lock-in — see `backline-dev-plan.md` and `backline-architecture.md` for the full design.

## What's actually here

This is a working scaffold, not just stubs — `src/diff/jsonDiff.ts`, `src/render/prComment.ts`, and `src/render/secretScrub.ts` have been run and verified to produce correct output (see the test file and the verification below). The parts that need real infrastructure to test end-to-end (`ComposeAdapter`, `octokitClient`) are correctly structured against their interfaces but need `docker compose` and a real GitHub token respectively to exercise.

## Setup

```bash
npm install
npm run typecheck   # tsc --noEmit — verifies every file compiles
npm test            # runs the diff engine test suite via vitest
npm run build       # bundles src/index.ts and src/cli.ts into dist/
```

## Try it locally against your own app

1. Copy `.backline.yml.example` to `.backline.yml` and edit the `requests`/`commands` to match your API or CLI.
2. Make sure you have a `docker-compose.yml` in the repo root that stands up your app on port 4000 (or adjust `ComposeAdapter`'s constructor args).
3. Run:
   ```bash
   node dist/cli.js --config .backline.yml --head-ref HEAD --base-ref main
   ```
   This deploys both refs via Docker Compose, runs your configured probes against each, diffs them, and prints the resulting PR-comment-style markdown straight to your terminal — no GitHub involved.

## Using it as a GitHub Action

Once pushed to your own repo (or published), reference it like any other action:

```yaml
- uses: yourname/backline-action@v1
  with:
    config: .backline.yml
    github-token: ${{ secrets.GITHUB_TOKEN }}
```

Remember: `dist/index.js` and `dist/cli.js` must be committed and kept in sync with `src/` — `npm run build` regenerates them, and CI should fail if they drift (`git diff --exit-code dist/` after a build is the standard safeguard).

## File map — what to open first

| If you want to... | Start here |
|---|---|
| Understand the whole control flow | `src/orchestrator.ts` |
| Add a new probe type (e.g. graphql) | `src/probes/ProbeModule.ts`, then `src/probes/registry.ts` |
| Add a new deploy target | `src/adapters/DeployAdapter.ts` |
| Change what counts as a "diff" | `src/diff/jsonDiff.ts` |
| Change the PR comment format | `src/render/prComment.ts` |
| Understand `.backline.yml`'s shape | `src/config/schema.ts` |

## What's intentionally stubbed / simplified for this scaffold

- `ComposeAdapter` doesn't check out `ref` into an isolated worktree — it assumes the calling workflow already checked out the right ref. A real implementation would need `git worktree add` per ref to run base and head simultaneously.
- `PullPreviewAdapter` (mentioned in the architecture doc) isn't implemented yet — `WebhookAdapter` covers the same "bring your own deploy pipeline" need in the meantime.
- The Swagger-UI static console page (`render/consolePage.ts` in the architecture doc) isn't built yet — v1 output is comment-only, matching the MVP scope in the dev plan.
- `CliProbe`'s `normalize` options (`strip_ansi`, `strip_timestamps`) are declared in the schema but not yet applied before diffing — currently only exact-match diffing runs on CLI output.
