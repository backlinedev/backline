# Contributing to Backline

Thank you for considering a contribution. This document covers what you need to get a change from idea to merged pull request.

## Getting started

```bash
git clone https://github.com/backlinedev/backline.git
cd backline
npm install
npm run typecheck
npm test
```

All three should complete without errors before you start making changes.

## Project structure

Before touching code, it is worth reading `backline-architecture.md`, which explains the boundaries between components and why they are drawn where they are. In short:

- `src/config` owns the shape and validation of `.backline.yml`.
- `src/probes` owns how a check is actually run, one implementation per probe type.
- `src/adapters` owns how something gets deployed, one implementation per deploy target.
- `src/diff` owns comparison logic and has no dependency on anything else in the project.
- `src/orchestrator.ts` is the only file that wires the above together; it should stay free of implementation detail.

If a change adds a genuinely new capability, it almost always belongs in exactly one of these directories, as a new file implementing an existing interface, rather than as new logic inside `orchestrator.ts`.

## Making a change

1. Open an issue first for anything larger than a small fix, so the approach can be discussed before time is spent on an implementation.
2. Create a branch from `main`.
3. Write the change, plus a test for it. `src/diff` in particular should be exhaustively testable without any external dependency — new diff behavior should ship with test cases covering it.
4. Run the full check before opening a pull request:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
5. If your change affects `dist/`, rebuild it and include the rebuilt output in your commit. A pull request that changes `src/` without a matching `dist/` rebuild will not behave as described once merged, since GitHub Actions runs the compiled output directly.

## Code style

- TypeScript strict mode is enabled project-wide; do not disable it locally to work around a type error.
- Public functions and exported types should carry a TSDoc comment describing what they do and, where it is not obvious, why they exist.
- Prefer depending on an interface (`DeployAdapter`, `ProbeModule`, `CacheStore`) over a concrete implementation, even inside a single function, if there is any reasonable chance the concrete implementation will need to vary later.

## Reporting bugs

Open an issue with:

- The version of Backline in use.
- The relevant section of `.backline.yml`, with any secrets removed.
- What you expected to happen, and what happened instead.
- If possible, the relevant portion of the Actions run log.

## Reporting security issues

Do not open a public issue for a security vulnerability. See `SECURITY.md` for how to report one privately.

## License

By contributing, you agree that your contributions will be licensed under the project's MIT license.
