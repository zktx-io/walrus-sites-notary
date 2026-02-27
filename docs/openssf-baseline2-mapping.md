# OpenSSF Baseline 2 Mapping

This document maps Baseline 2 controls (as shown in the OpenSSF form) to repository evidence.

## Baseline Version Reference

- Control baseline reference: OSPS Security Baseline `v2026.02.19`
- Last mapping review date: `2026-02-27`

## Control Mapping

| Control ID | Current Status | Evidence |
| --- | --- | --- |
| `OSPS-AC-04.01` | Met | Workflow-level least-privilege defaults in `.github/workflows/build-test.yml` and `.github/workflows/deploy.yml` |
| `OSPS-BR-02.01` | Met | Versioned release process in `docs/release-process.md`; tag/version validation in `.github/workflows/deploy.yml` |
| `OSPS-BR-04.01` | Met | Required release notes + security info in `.github/workflows/deploy.yml`; `CHANGELOG.md` |
| `OSPS-BR-05.01` | Met | Standard dependency tooling (`npm ci`, lockfile) in workflows and `docs/dependencies.md` |
| `OSPS-BR-06.01` | Met | Provenance-enabled signed release workflow via `zktx-io/walrus-sites-provenance` + policy in `docs/release-process.md` |
| `OSPS-DO-06.01` | Met | Dependency selection/obtainment/tracking documented in `docs/dependencies.md` |
| `OSPS-GV-01.01` | Met | Sensitive-access member list in `docs/governance.md` |
| `OSPS-GV-01.02` | Met | Role/responsibility definitions in `docs/governance.md` |
| `OSPS-GV-03.02` | Met | Contributor requirements in `CONTRIBUTING.md` |
| `OSPS-LE-01.01` | Met | DCO requirement in `CONTRIBUTING.md` + CI enforcement in `.github/workflows/dco.yml` |
| `OSPS-QA-03.01` | Met* | Required checks policy in `docs/branch-protection.md`; CI checks in workflows |
| `OSPS-QA-06.01` | Met* | Automated test suite in CI (`npm run test:ci`) in `.github/workflows/build-test.yml` |
| `OSPS-SA-01.01` | Met | Actions/actors design documentation in `docs/design.md` |
| `OSPS-SA-02.01` | Met | External interface documentation in `docs/interfaces.md` |
| `OSPS-SA-03.01` | Met | Security assessment in `docs/security-assessment.md` |
| `OSPS-VM-01.01` | Met | CVD policy and response timelines in `.github/SECURITY.md` |
| `OSPS-VM-03.01` | Met | Private reporting channel and security contact in `.github/SECURITY.md` |
| `OSPS-VM-04.01` | Met | Public vulnerability disclosure locations and records in `docs/vulnerabilities.md` |

## Manual Verification Required In GitHub Settings

Controls marked with `Met*` depend on repository settings outside version-controlled files.

Validate in GitHub:

1. `Settings -> Branches` (or rulesets) requires status checks for `main`.
2. Required checks include `CI / build-test` and `DCO Check / dco-check`.
3. Direct pushes to `main` are restricted except intentional bypass by maintainers.
