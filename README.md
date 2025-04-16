# walrus-sites-notary

**Verify your Walrus Site with SLSA Provenance**

## ✨ Overview

**`walrus-sites-notary`** is a frontend tool for verifying Walrus Site deployments using [SLSA provenance](https://slsa.dev/).  
It ensures that your static site was deployed through a trusted GitHub Actions workflow and that each resource matches its on-chain hash.

> 🔍 Try it live: [https://notary.wal.app](https://notary.wal.app)

## 🧪 How It Works

![notary](https://docs.zktx.io/images/walrus-notary.png)

Just enter a `.wal.app` site address and click **Verify**.  
Notary will check the site’s on-chain data and its attached SLSA provenance.
