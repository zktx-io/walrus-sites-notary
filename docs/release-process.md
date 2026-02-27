# Release Process

This process is used for official releases.

## Release Requirements

1. Update `package.json` version using semantic versioning.
2. Update `CHANGELOG.md` with:
   - Functional changes
   - Security changes (or explicit `none`)
3. Create a Git tag matching package version (`vX.Y.Z`).
4. Publish a GitHub Release with non-empty release notes that include security information.

## Automated Controls

- `.github/workflows/deploy.yml` validates:
  - Semver-compatible tag format
  - Tag/version match with `package.json`
  - Presence of release notes
  - Presence of security information in release notes
  - Deployment uses provenance-enabled reusable workflow integration.

## Signing And Provenance

- Official releases use the provenance-capable deployment workflow:
  - `zktx-io/walrus-sites-provenance/.github/workflows/deploy_with_slsa3.yml`
- Release integrity evidence is tracked in provenance metadata and release records.
