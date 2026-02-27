# Dependency Management

This document describes how the project selects, obtains, and tracks dependencies.

## Selection Rules

- Prefer mature, actively maintained open source packages.
- Prefer packages with clear licensing compatible with `MIT`.
- Prefer packages with a stable release history and security response process.
- Avoid adding dependencies when equivalent functionality already exists in the codebase.

## How Dependencies Are Obtained

- Runtime and development dependencies are declared in `package.json`.
- Exact dependency tree state is tracked in `package-lock.json`.
- CI and release pipelines install using `npm ci` to enforce lockfile reproducibility.

## How Dependencies Are Tracked

- Dependabot is enabled at `.github/dependabot.yml` for:
  - npm dependencies
  - GitHub Actions dependencies
- Pull requests from dependency update bots are reviewed by maintainers and must pass CI.
- Security advisories are monitored through GitHub Dependabot alerts.

## Update and Verification Process

1. Review release notes/changelogs of updated packages.
2. Run `npm run lint`, `npm run test:ci`, and `npm run build`.
3. Validate no regression in provenance verification logic.
4. Merge dependency updates through pull requests only.

## Release Expectations

For official releases, dependency state is tied to:

- A unique version/tag
- A committed lockfile
- Release notes documenting functional and security-impacting changes
