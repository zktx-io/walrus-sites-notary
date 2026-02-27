# Contributing

Thank you for considering a contribution to `walrus-sites-notary`.

## How To Contribute

1. Fork this repository.
2. Create a topic branch from `main`.
3. Make your change with tests.
4. Open a pull request to `main`.

## Acceptable Contributions

Contributions are accepted when they:

- Are relevant to this project's scope (Walrus Sites and MVR verification).
- Follow existing code style and architecture patterns.
- Include tests for behavior changes, where applicable.
- Avoid introducing secrets, private keys, or sensitive operational data.
- Pass all required GitHub checks.

Contributions may be rejected when they:

- Introduce insecure defaults.
- Remove provenance or verification safeguards.
- Add undeclared dependencies without justification.

## Developer Certificate of Origin (DCO)

All commits must include a `Signed-off-by` trailer to assert legal authority to submit the contribution.

Use:

```bash
git commit -s -m "your message"
```

For existing commits:

```bash
git rebase --signoff origin/main
```

The CI workflow `DCO Check` enforces this requirement for every pull request commit.

## Testing Requirements

- Run `npm run test:ci` and `npm run build` before opening a PR.
- New logic should include tests that cover both expected and failure paths.
- CI must pass before merge.

## Pull Request Review

- All changes to `main` must come through pull requests.
- At least one maintainer review is required.
- Maintainers may manually bypass checks only for emergency fixes and must document the reason in the merge or follow-up release notes.
