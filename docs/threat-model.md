# Threat Model

This document summarizes threat modeling and attack surface analysis for critical code paths and release interactions.

## Critical Paths

- User-submitted site or package identifiers
- Retrieval of remote provenance and blockchain metadata
- Signature and hash verification logic
- Release automation and deployment signing workflow

## Threat Table

| Area | Threat | Example Attack | Mitigation | Residual Risk |
| --- | --- | --- | --- | --- |
| Verification input | Spoofing | An attacker provides a misleading package or site identifier | Treat all route and network input as untrusted and verify against on-chain data and provenance | Incorrect operator trust assumptions about upstream services |
| Provenance validation | Tampering | Modified provenance or mismatched resource hashes | Verify signatures and compare declared hashes to fetched content | Dependence on correct external metadata availability |
| Release workflow | Elevation of privilege | Over-privileged workflow token or secret misuse | Use least-privilege permissions, scoped secrets, and release validation gates | Maintainer or runner compromise |
| Dependency supply chain | Malicious dependency introduction | A dependency update introduces vulnerable or malicious code | PR review, Dependabot monitoring, dependency review policy, SBOM generation, release checks | False negatives in dependency intelligence |
| UI output | Information disclosure | Sensitive release or environment values leak into logs or output | No secrets in source, restricted secret handling, release-only secret scope | Human error in future changes |

## Attack Surface

Primary attack surface includes:

- Browser routes and user inputs
- External RPC and metadata endpoints
- GitHub Actions workflow execution
- Release assets distributed through GitHub Releases

## Review Trigger

Update this threat model when:

- Verification logic changes materially
- Release automation changes
- New privileged integrations are added
- A confirmed security incident occurs
