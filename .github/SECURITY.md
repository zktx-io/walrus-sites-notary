# Security Policy

## Private Vulnerability Reporting

Report vulnerabilities privately using GitHub's private reporting flow:

- https://github.com/zktx-io/walrus-sites-notary/security/advisories/new

Do not file public issues for undisclosed vulnerabilities.

Security contacts:

- `@daoauth` (repository maintainer)

Include the following in your report:

- Affected component and version/tag
- Reproduction steps or proof of concept
- Impact and exploitability
- Suggested mitigation (if known)

## Coordinated Vulnerability Disclosure (CVD) Timeline

For valid reports, this project targets:

- Acknowledgement within 3 business days
- Initial triage within 7 calendar days
- Regular status updates at least every 14 calendar days until resolution
- Public disclosure after a fix is available or after coordinated timeline agreement with the reporter

## Scope

This policy applies to:

- The `walrus-sites-notary` repository
- Production deployment at `https://notary.wal.app`
- Build provenance and signing pipeline integrations used for releases

## Supported Versions

- Latest release: fully supported
- Older releases: best effort only, unless explicitly stated in release notes
- End-of-support expectations are documented in [`docs/support-policy.md`](../docs/support-policy.md)

## Public Disclosure

Confirmed vulnerabilities are publicly disclosed via:

- GitHub Security Advisories for this repository
- Security entries in release notes/CHANGELOG

Published advisory records are tracked in [`docs/vulnerabilities.md`](../docs/vulnerabilities.md).
