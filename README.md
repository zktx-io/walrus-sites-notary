# 🕵️‍♀️ Notary for Walrus Sites & MVR Contracts

[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12049/badge)](https://www.bestpractices.dev/projects/12049)

> Verify Walrus Sites deployments and Move smart contracts with cryptographic provenance and on-chain validation.

[notary.wal.app](https://notary.wal.app) is a Web3 verification frontend that validates:

- Walrus Sites deployments
- Move smart contracts deployed via MVR (Move Registry)

It uses SLSA provenance, Sigstore verification, and on-chain data anchoring to provide transparent deployment integrity.

---

## 🎯 Problem It Solves

Decentralized deployments often lack verifiable proof of build origin and artifact integrity.  
Notary provides cryptographic verification of deployed websites and smart contracts by validating provenance files and confirming trusted builders against on-chain state.

---

## ✅ What It Does

For Walrus Sites:
- Parses `.well-known/walrus-sites.intoto.jsonl`
- Validates each resource hash against its on-chain blob
- Verifies Sigstore provenance signatures
- Displays repository, workflow, and commit metadata

For MVR Contracts:
- Fetches registered contract metadata
- Validates deployed bytecode against build provenance
- Verifies Sigstore signatures
- Displays repository, commit, workflow, and registry metadata

Deployments are clearly marked **Verified** or **Unverified**.

---

## 📦 Installation

Clone the repository:

    git clone https://github.com/zktx-io/walrus-sites-notary
    cd walrus-sites-notary

Install dependencies:

    npm install
    # or
    yarn install
    # or
    pnpm install

---

## 🚀 Development

Start development server:

    npm run dev

Build:

    npm run build

Preview production build:

    npm run preview

---

## 🧪 Testing

Run automated tests:

    npm run test

Run tests in CI mode:

    npm run test:ci

Tests are automatically executed for all pull requests via GitHub Actions.

---

# 🧪 Verification Modes

## 1️⃣ Walrus Sites Verification

Route:

    https://notary.wal.app/site/<suins-name>

Example:

    https://notary.wal.app/site/notary

Input:
- Sui Name Service (SuiNS) name resolving to a Walrus Sites deployment

Process:
- Resolves SuiNS name
- Fetches `.well-known/walrus-sites.intoto.jsonl`
- Compares declared resource hashes with on-chain blobs
- Verifies provenance signature

Output:
- Resource-level hash validation
- Provenance verification status
- Builder metadata (repo, commit, workflow)

If provenance is missing:
- Deployment is marked **Unverified**
- Resource hash comparison is still shown

---

## 2️⃣ MVR Smart Contract Verification

Route:

    https://notary.wal.app/mvr/@<suins-name>/<package-name>

Example:

    https://notary.wal.app/mvr/@deeptrade/deeptrade-core

Input:
- `<owner>`: MVR publisher / namespace
- `<package-name>`: Registered Move package name

Process:
- Fetches package metadata from MVR
- Retrieves deployed on-chain bytecode
- Resolves associated SLSA provenance
- Verifies Sigstore signature
- Compares deployed bytecode hash with build artifact

Output:
- Bytecode hash validation result
- Provenance verification status
- Builder metadata (repository, commit, workflow)
- Registry registration details

If no provenance is registered:
- Package is marked **Unverified**
- On-chain bytecode hash is still displayed

---

## 🔐 GitSigner Support

The `/sign` route provides a secure signing interface for GitHub deployment workflows.

Features:
- Ephemeral Sui keypair (destroyed after signing)
- PIN-encrypted payload exchange
- On-chain signaling via devnet transactions

Enables private-keyless CI signing when used with:
- walrus-sites-provenance
- sui-mvr-provenance

---

## 🔗 Related Projects

- Walrus Documentation: https://docs.wal.app
- walrus-sites-provenance: https://github.com/zktx-io/walrus-sites-provenance
- sui-mvr-provenance: https://github.com/zktx-io/sui-mvr-provenance
- SLSA: https://slsa.dev
- Sigstore: https://www.sigstore.dev

---

## 🐛 Reporting Issues

Bug reports and feature requests:

https://github.com/zktx-io/walrus-sites-notary/issues

Security vulnerabilities may be reported privately using GitHub Security Advisories.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Submit a pull request
5. Ensure CI checks pass before merge

All changes to `main` require pull requests and CI approval.

---

## 🛠 Maintenance Status

This project is actively maintained.  
Commit history and issue tracking are publicly available on GitHub.

---

## 📄 License

MIT License  
See the LICENSE file for details.