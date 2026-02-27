# Branch Protection Policy

Primary branch: `main`

## Required Checks

The following checks must pass before merge:

- `CI / build-test`
- `DCO Check / dco-check`
- `Dependency Review / dependency-review`
- `SAST / semgrep`

## Merge Policy

- Direct pushes to `main` are disabled for normal development.
- Changes must be merged through pull requests.
- Maintainers may bypass in emergency scenarios only, and must document reason in the merge context or immediate follow-up release notes.

## Review Policy

- At least one maintainer review is required for pull requests to `main`.
- When available, the reviewer should not be the author of the change.
