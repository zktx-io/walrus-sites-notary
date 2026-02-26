# 🕵️‍♀️ Notary for Walrus Sites

> **Verify your Walrus Sites with cryptographic provenance**

[**notary.wal.app**](https://notary.wal.app) is a verification frontend for [Walrus Sites](https://docs.wal.app/walrus-sites/intro.html).  
It reads the on-chain site object and checks whether it includes a valid `.intoto.jsonl` provenance file for all deployed resources.

![notary](https://docs.zktx.io/images/walrus-notary.png)

---

## ✅ What It Does

- 🧾 Parses `.well-known/walrus-sites.intoto.jsonl`
- 🔍 Checks each resource’s hash against the on-chain blob
- 🔗 Displays GitHub repo, workflow, and commit metadata
- 🛡 Confirms the signature came from a trusted builder

> If no provenance file is found, the site is marked **unverified**, but all resource hashes are still shown.

---

## 🔐 GitSigner Support

This project also powers [`notary.wal.app/sign`](https://notary.wal.app/sign),  
a secure UI for signing GitHub deployment requests using:

- 🔐 Ephemeral Sui keypair (burned after signing)
- 🔑 PIN-encrypted payload exchange
- 📡 On-chain signaling via devnet transactions

Used in combination with `GIT_SIGNER_PIN` in  
[`walrus-sites-provenance`](https://github.com/zktx-io/walrus-sites-provenance),  
this enables **private-keyless** CI signing in GitHub Actions.

---

## 🧪 Example Verification Flow

1. Deploy your site with provenance using [SLSA GitHub Generator](https://github.com/slsa-framework/slsa-github-generator)
2. Generate `.intoto.jsonl` and place it under `.well-known/`
3. Visit: `https://notary.wal.app/?q=your-site`
4. View a full verification report for your deployment

---

## 🔗 Related

- [Walrus Docs](https://docs.wal.app)
- [walrus-sites-provenance](https://github.com/zktx-io/walrus-sites-provenance)
- [SLSA.dev](https://slsa.dev)
- [Sigstore](https://www.sigstore.dev)

---

## Contributing

Contributions are welcome via pull requests.
Please ensure CI passes before submitting changes.