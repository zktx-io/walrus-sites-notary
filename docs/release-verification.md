# Release Verification

This document explains how to verify the integrity and expected author identity of official releases.

## Official Release Assets

Official GitHub releases must include versioned assets generated from the tagged source:

- `walrus-sites-notary-v<version>-dist.tar.gz`
- `walrus-sites-notary-v<version>-sbom.spdx.json`
- `walrus-sites-notary-v<version>-manifest.json`
- `walrus-sites-notary-v<version>-checksums.txt`

## Integrity Verification

1. Download the release assets from the GitHub release page.
2. Verify the checksum file against the downloaded assets:

```bash
shasum -a 256 -c walrus-sites-notary-v<version>-checksums.txt
```

3. Confirm the manifest references the same release tag and commit as the GitHub release.

## Expected Release Author Identity

Official releases are expected to be:

- Tagged with `v<semantic-version>`
- Published from the `zktx-io/walrus-sites-notary` repository
- Validated by `.github/workflows/deploy.yml`
- Associated with the commit and workflow metadata recorded in the release manifest

For release assets produced by the automated workflow, verify the recorded workflow path and commit SHA in the manifest before trusting the asset.

## Provenance Verification

For releases that include provenance-attested deployment artifacts, verify the associated provenance using the release workflow records and the deployment tooling referenced in [`docs/release-process.md`](./release-process.md).

## Verification Failure

Do not trust or deploy a release when:

- Checksums do not match
- The release tag does not match `package.json`
- The manifest points to an unexpected repository, workflow, or commit
- Release notes omit required security information
