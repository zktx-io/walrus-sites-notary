# Release Process

This process is used for official releases.

## Release Requirements

1. Update `package.json` version using semantic versioning.
2. Update `CHANGELOG.md` with:
   - Functional changes
   - Security changes (or explicit `none`)
3. Create a Git tag matching package version (`vX.Y.Z`).
4. Publish a GitHub Release with non-empty release notes that include security information.
5. Ensure the release contains versioned assets, checksums, and an SBOM.

## Automated Controls

- `.github/workflows/deploy.yml` validates:
  - Semver-compatible tag format
  - Tag/version match with `package.json`
  - Presence of release notes
  - Presence of security information in release notes
  - Release asset generation, checksums, and SBOM upload
  - Deployment uses provenance-enabled reusable workflow integration.

## Signing And Provenance

- Official releases use the provenance-capable deployment workflow:
  - `zktx-io/walrus-sites-provenance/.github/workflows/deploy_with_slsa3.yml`
- Release integrity evidence is tracked in provenance metadata and release records.

## Release Assets

Official releases should include:

- `walrus-sites-notary-v<version>-dist.tar.gz`
- `walrus-sites-notary-v<version>-sbom.spdx.json`
- `walrus-sites-notary-v<version>-manifest.json`
- `walrus-sites-notary-v<version>-checksums.txt`

Verification instructions are documented in [`docs/release-verification.md`](./release-verification.md).

## Rollback

If a release validation or deployment issue is found after publication:

1. Mark the release as superseded or affected in release notes.
2. Revoke or rotate any compromised secrets.
3. Publish a corrective release with updated notes and assets.
4. Document any security implications in `CHANGELOG.md` or a security advisory.
