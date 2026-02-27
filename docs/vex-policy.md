# VEX Policy

This project uses VEX-style records to document vulnerabilities that are present in software components but not exploitable in the released project context.

## Publication Location

- VEX records must be stored under `docs/vex/`.
- Public vulnerability summaries remain listed in [`docs/vulnerabilities.md`](./vulnerabilities.md).

## When To Publish

Publish a VEX document when:

- A dependency vulnerability is confirmed not to affect the project
- A finding has been triaged as non-exploitable in the current deployment model

## Required Contents

A VEX record must include:

- Vulnerability identifier
- Affected component
- Release or version scope
- Non-exploitability justification
- Review date and reviewer
