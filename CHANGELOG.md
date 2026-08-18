# Changelog

All notable changes to Backline will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - TBD

### Added

**Phase 0:**
- GitHub Marketplace branding (icon and color)
- Complete npm package metadata (keywords, repository, engines)
- `.npmignore` for clean npm distributions
- Four production-ready examples (Express, Next.js, CLI, multi-service)
- Comprehensive documentation (quick-start, config reference, FAQ)
- Enhanced README with comparisons, FAQ, and troubleshooting

**Phase 1:**
- `backline init` command - Auto-detects framework and generates configuration
- `backline validate` command - Validates configuration without running
- `backline generate` command - Generates probes from OpenAPI specification
- OpenAPI/Swagger integration - Auto-generate API probes from spec files
- GraphQL probe type - Test GraphQL APIs with query support
- Database probe type - Direct SQL query testing (PostgreSQL, MySQL, SQLite)
- Enhanced visual diff rendering - Syntax highlighting, collapsible sections, side-by-side comparison
- Framework detection - Automatic detection of Next.js, Express, FastAPI, Rails, CLI tools
- Interactive setup prompts - Guided configuration with sensible defaults

### Changed
- Enhanced package.json with full metadata for npm publication
- Improved action.yml description for better discoverability
- Upgraded PR comment rendering with better visual hierarchy
- Expanded probe registry to support GraphQL and Database types

## [0.1.0] - 2024-08-17

### Added
- Initial release
- Core orchestrator for running behavioral diffs
- API probe type for testing HTTP endpoints
- CLI probe type for testing command-line tools
- Docker Compose adapter for local deployments
- Webhook adapter for custom deploy pipelines
- JSON diff engine with configurable ignore fields
- Secret scrubbing in outputs
- PR comment rendering with diff results
- File-based caching for base branch results
- GitHub Actions integration
- Local CLI for testing without CI (`backline test`)

### Features
- Isolated git worktree deployments for true side-by-side comparison
- Zero infrastructure - everything runs in CI
- Pluggable architecture for adapters and probes
- Full TypeScript strict mode with Zod runtime validation
- Security-first design with credential handling

[Unreleased]: https://github.com/backlinedev/backline/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/backlinedev/backline/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/backlinedev/backline/releases/tag/v0.1.0
