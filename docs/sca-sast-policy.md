# SCA and SAST Policy

This document defines remediation thresholds and release blocking rules for dependency and static analysis findings.

## Software Composition Analysis (SCA)

### Remediation Threshold

- Newly introduced dependency vulnerabilities with severity `high` or `critical` must be fixed before merge or release.
- Newly introduced dependency license issues outside the approved project policy must be reviewed before merge.

### Release Rule

- A release must not proceed when open dependency findings at or above the release threshold remain unresolved.
- Exceptions must be documented as non-exploitable in a VEX statement or equivalent documented exception record.

### Automated Evaluation

- Pull requests are evaluated by dependency review automation.
- Release builds run `npm audit --omit=dev --audit-level=high`.
- Dependency updates are monitored continuously through Dependabot alerts.

## Static Application Security Testing (SAST)

### Remediation Threshold

- Static analysis findings classified as `error` severity must be fixed before merge or release.
- Lower-severity findings must be triaged and either remediated or tracked.

### Release Rule

- Releases must not proceed with unreviewed blocking SAST findings.
- Any accepted exception must be documented with rationale and review date.

### Automated Evaluation

- Pull requests and `main` branch changes are scanned by SAST automation.
- Blocking findings are expected to fail the SAST workflow or a required repository protection rule.
