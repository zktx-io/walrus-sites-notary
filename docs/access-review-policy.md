# Sensitive Access Review Policy

This document defines how code collaborators are reviewed before receiving elevated access to sensitive resources.

## Sensitive Resources

Sensitive resources include:

- Repository admin permissions
- Branch protection and ruleset management
- GitHub Actions secrets and environments
- Release publication rights

## Review Requirements

- Elevated access must not be granted without a documented review.
- The review must confirm the collaborator's operational need, identity, and familiarity with project security expectations.
- Access must be limited to the minimum role required.

## Approval Process

- If multiple maintainers exist, at least one existing maintainer who is not the access requester must approve the change.
- While the project has a single maintainer, any change to sensitive access must be documented in repository governance records and reviewed at the next access review.

## Ongoing Review

- Sensitive access must be reviewed at least every 90 days.
- Access must be removed promptly when no longer required.
- Offboarding or role changes require immediate reassessment of all sensitive permissions.
