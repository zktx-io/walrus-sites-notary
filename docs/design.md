# Design Overview

This document describes the system actors, actions, and high-level architecture of the released software.

## Actors

- End user: verifies a Walrus site or MVR package through the web UI.
- GitHub Actions runner: executes CI checks and release/deployment automation.
- Maintainer: reviews code, manages releases, and operates security processes.
- External infrastructure: Sui RPC, Walrus data services, GitHub APIs, and provenance/signature services.

## Core Actions

1. User requests verification for a Walrus site or MVR package.
2. Frontend fetches metadata and provenance references from external services.
3. App validates cryptographic signatures and hash relationships.
4. App renders verification result (`Verified` or `Unverified`) with evidence details.
5. CI validates code quality and tests for pull requests and main-branch pushes.
6. Release workflow validates version/tag + release notes, then executes provenance-enabled deployment.

## Architecture

- Frontend: React + TypeScript single-page application.
- Build toolchain: Vite + TypeScript compiler.
- CI/CD: GitHub Actions workflows under `.github/workflows/`.
- Provenance/deploy integration: reusable workflow from `zktx-io/walrus-sites-provenance`.

## Trust Boundaries

- Browser/UI boundary: untrusted user input and route parameters.
- Network boundary: external API responses are treated as untrusted until validated.
- CI boundary: workflow tokens and secrets are limited to minimum required permissions.
- Release boundary: official release artifacts and metadata are tied to version tags and signed provenance pipeline.
