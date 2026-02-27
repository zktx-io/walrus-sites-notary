# Governance

This project is maintained by repository maintainers who are responsible for source quality, release integrity, and security response.

## Members With Sensitive Access

| Member | Role | Sensitive Access |
| --- | --- | --- |
| `@daoauth` | Maintainer | GitHub repository admin, branch protection/rules, Actions secrets, release publication |

## Roles And Responsibilities

### Maintainer

- Review and merge pull requests.
- Maintain branch protection and required status checks.
- Manage release process and release notes.
- Respond to vulnerability reports and coordinate disclosure.
- Rotate/revoke secrets when required.

### Contributor

- Submit changes through pull requests.
- Follow `CONTRIBUTING.md` requirements.
- Include tests and DCO `Signed-off-by` trailers on commits.

## Decision Process

- Day-to-day technical decisions are made in pull requests.
- Security-impacting decisions are prioritized and may be merged via expedited process when risk is high.
- Changes to governance or security policy are documented in `docs/` and release notes.

## Access Continuity

- At least one maintainer must keep documented access to release and security operations.
- Access changes must be reflected in this file promptly.
