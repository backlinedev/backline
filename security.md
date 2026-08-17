# Security Policy

## Reporting a vulnerability

If you believe you have found a security vulnerability in Backline, please do not open a public issue.

Instead, report it privately through GitHub's private vulnerability reporting feature: open the repository's Security tab and select "Report a vulnerability." This creates a private advisory visible only to maintainers until a fix is ready.

Please include:

- A description of the vulnerability and its potential impact.
- Steps to reproduce it, including a minimal `.backline.yml` if the issue is configuration-dependent.
- The version of Backline affected.

You should expect an initial response within a few days. If the issue is confirmed, a fix will be prepared and a coordinated disclosure timeline agreed with you before any public advisory is published.

## Scope and design notes relevant to security

A few things are worth understanding about how Backline handles sensitive data, since they affect what is and is not a reportable vulnerability here:

- Backline never stores, transmits, or logs credentials of any kind. Environment variables and secrets are passed through from the calling CI job or a local env file directly to whatever it deploys; Backline's own code never reads their values.
- Captured probe output is scanned for common secret patterns (API keys, bearer tokens, JWTs) and redacted before being rendered into a pull request comment. This is a best-effort safety net, not a guarantee — it is not a substitute for keeping real secrets out of preview environments in the first place.
- The default deploy adapter runs `docker compose` directly on whatever machine executes the workflow. Anyone who can open a pull request against a repository using Backline can therefore cause arbitrary code from that pull request to be built and run in that environment. Repository owners should apply the same scrutiny to this as they would to any other CI step that builds and runs PR code, including from forks.

## Supported versions

As the project has not yet reached a 1.0 release, security fixes are made against the latest version on `main` rather than against multiple maintained release branches.
