# Secrets and Credentials Policy

This document defines how the project stores, accesses, and rotates secrets and credentials.

## Approved Storage

- Production and release secrets must be stored only in GitHub Actions encrypted secrets or environment-scoped secrets.
- Secrets must not be stored in source files, committed history, issues, pull requests, or chat transcripts.
- Local development secrets must be kept outside the repository tree.

## Approved Access

- Access is limited to maintainers with a documented operational need.
- Sensitive access changes must follow [`docs/access-review-policy.md`](./access-review-policy.md).
- Secrets must be scoped to the minimum repository, environment, and permission set required for the task.

## Current Sensitive Credentials

- `GIT_SIGNER_PIN`
- `ED25519_PRIVATE_KEY`

These credentials are used only for the release and provenance workflow.

## Rotation and Revocation

- Secrets must be rotated immediately on suspected exposure, maintainer offboarding, or changes in trusted infrastructure.
- Release and deployment secrets must be reviewed at least every 180 days.
- Secret values must be revoked and replaced when access requirements change.

## Handling Requirements

- Never print secrets to CI logs.
- Never pass secrets to untrusted pull request contexts.
- Prefer short-lived credentials and OIDC-based identity where supported.

## Incident Response

When a secret exposure is suspected:

1. Revoke the exposed value.
2. Rotate the credential.
3. Audit recent workflow runs and releases.
4. Document the incident and any remediation in release notes or a security advisory, as appropriate.
