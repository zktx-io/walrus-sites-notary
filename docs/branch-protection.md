# Branch Protection Policy

Primary branch: `main`

## Required Checks

The following checks must pass before merge:

- `CI / build-test`
- `DCO Check / dco-check`

## Merge Policy

- Direct pushes to `main` are disabled for normal development.
- Changes must be merged through pull requests.
- Maintainers may bypass in emergency scenarios only, and must document reason in the merge context or immediate follow-up release notes.

## Review Policy

- At least one maintainer review is required for pull requests to `main`.
