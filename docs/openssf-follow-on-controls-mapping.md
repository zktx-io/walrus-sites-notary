# OpenSSF Follow-on Controls Mapping

This document maps the next set of OpenSSF controls reviewed after Baseline 2.

## Control Mapping

| Control ID | Current Status | Evidence |
| --- | --- | --- |
| `OSPS-AC-04.02` | Met | Job-specific minimum permissions in `.github/workflows/build-test.yml` and `.github/workflows/deploy.yml` |
| `OSPS-BR-02.02` | Met | Versioned release assets and manifest generation in `.github/workflows/deploy.yml`; verification docs in `docs/release-verification.md` |
| `OSPS-BR-07.02` | Met | Secret storage, access, and rotation policy in `docs/secrets-policy.md` |
| `OSPS-DO-03.01` | Met | Integrity verification instructions in `docs/release-verification.md` |
| `OSPS-DO-03.02` | Met | Expected release author/process verification in `docs/release-verification.md` |
| `OSPS-DO-04.01` | Met | Support scope and duration in `docs/support-policy.md` |
| `OSPS-DO-05.01` | Met | End-of-security-update policy in `docs/support-policy.md` |
| `OSPS-GV-04.01` | Met | Sensitive access review process in `docs/access-review-policy.md` |
| `OSPS-QA-02.02` | Met | SBOM generation and release upload in `.github/workflows/deploy.yml` |
| `OSPS-QA-04.02` | N/A | Current release process is single-repository; no multi-repository release assembly is documented |
| `OSPS-QA-06.02` | Met | Test timing and execution documented in `README.md` and `.github/workflows/build-test.yml` |
| `OSPS-QA-06.03` | Met | Test update policy for major changes in `CONTRIBUTING.md` |
| `OSPS-QA-07.01` | Unmet | GitHub requires approval, but the project does not yet have a consistently available non-author reviewer |
| `OSPS-SA-03.02` | Met | Threat modeling and attack surface analysis in `docs/threat-model.md` |
| `OSPS-VM-04.02` | Met* | VEX publication policy and storage location in `docs/vex-policy.md` and `docs/vex/README.md` |
| `OSPS-VM-05.01` | Met | SCA remediation threshold policy in `docs/sca-sast-policy.md` |
| `OSPS-VM-05.02` | Met | Release-blocking SCA policy in `docs/sca-sast-policy.md` |
| `OSPS-VM-05.03` | Met* | Dependency review workflow and release audit checks in `.github/workflows/dependency-review.yml` and `.github/workflows/deploy.yml` |
| `OSPS-VM-06.01` | Met | SAST remediation threshold policy in `docs/sca-sast-policy.md` |
| `OSPS-VM-06.02` | Met* | SAST workflow in `.github/workflows/sast.yml`; may also require repository-side required checks |

## Notes

- Controls marked `Met*` depend on the associated workflow being enabled and, where required, configured as a blocking repository check.
- `OSPS-QA-07.01` should remain `Unmet` until a non-author reviewer is operationally available.
