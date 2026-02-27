# External Interfaces

This document lists external software interfaces used by released assets.

## User-Facing HTTP Interface

- Base web application: `https://notary.wal.app`
- Verification routes:
  - `/site/<suins-name>`
  - `/mvr/@<namespace>/<package-name>`
- Signing route:
  - `/sign`

## Network/Data Interfaces

- Sui network RPC interface (package metadata and on-chain state lookups).
- Walrus resource access endpoints for site/resource retrieval.
- GitHub-hosted provenance metadata references (repository, workflow, commit context).
- Sigstore verification material used by provenance validation logic.

## Build And Release Interfaces

- GitHub Actions workflows:
  - `.github/workflows/build-test.yml`
  - `.github/workflows/dco.yml`
  - `.github/workflows/deploy.yml`
- npm registry package resolution through `npm ci`.
- Release event interface (`release.published`) used for deployment automation.

## Security And Vulnerability Interfaces

- Private vulnerability reporting:
  - `https://github.com/zktx-io/walrus-sites-notary/security/advisories/new`
- Public vulnerability disclosures:
  - `https://github.com/zktx-io/walrus-sites-notary/security/advisories`
