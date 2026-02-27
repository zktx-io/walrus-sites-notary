# OpenSSF Badge Operations (Baseline 2)

This guide summarizes the workflow from the OpenSSF post published on 2026-02-25:

- https://openssf.org/blog/2026/02/25/getting-an-openssf-baseline-badge-with-the-best-practices-badge-system/
- https://openssf.org/newsletter/2026/02/26/openssf-newsletter-february-2026/

## Project Links

- Project page: `https://www.bestpractices.dev/projects/12049`
- Baseline badge image: `https://www.bestpractices.dev/projects/12049/baseline`
- Project JSON data: `https://www.bestpractices.dev/projects/12049.json`

## Recommended Workflow

1. Open the Baseline section and complete controls.
2. Use `Save and Continue` to rerun automated checks after updates.
3. Keep repository evidence links up to date in:
   - `docs/openssf-baseline2-mapping.md`
   - `docs/openssf-follow-on-controls-mapping.md`
   - `README.md` documentation section
4. Re-check controls marked `?` and convert to `Met` once evidence is visible.

## Baseline Spec Tracking

The February 2026 OpenSSF newsletter announced updates to the OpenSSF Security Baseline controls.

Current working reference for this repository:

- OSPS Security Baseline version `v2026.02.19`
- Mapping document: `docs/openssf-baseline2-mapping.md`

Before each submission/review cycle:

1. Confirm the control set/version shown in the bestpractices.dev questionnaire.
2. If control IDs or wording changed, update mapping evidence links first.
3. Re-run with `Save and Continue` and then finalize statuses.

## Evidence Sources In This Repository

- CI permissions and tests:
  - `.github/workflows/build-test.yml`
  - `.github/workflows/deploy.yml`
  - `.github/workflows/dco.yml`
- Security process:
  - `.github/SECURITY.md`
  - `docs/vulnerabilities.md`
- Governance and architecture:
  - `docs/governance.md`
  - `docs/design.md`
  - `docs/interfaces.md`
  - `docs/security-assessment.md`
  - `docs/threat-model.md`
- Release/dependency policy:
  - `docs/release-process.md`
  - `docs/release-verification.md`
  - `docs/dependencies.md`
  - `docs/secrets-policy.md`
  - `docs/sca-sast-policy.md`
  - `CHANGELOG.md`

## Proposed Value Automation

The badge system supports pre-filling values through URL proposal parameters and `.bestpractices.json`.

- URL proposal pattern:
  - `/projects/<id>/<section>/edit?<field>=<value>`
- Example (from OpenSSF article):
  - `/projects/1/baseline-2/edit?osps_ac_01_01_status=met`

For this repository, use the control list in `docs/openssf-baseline2-mapping.md` as the source of truth before preparing proposal values.
