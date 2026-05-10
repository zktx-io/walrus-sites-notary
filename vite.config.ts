import { readFile } from 'node:fs/promises'
import { extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react-swc'
import { defineConfig, type Plugin } from 'vite'

const rootDir = fileURLToPath(new URL('.', import.meta.url))
const siteConfigPath = resolve(rootDir, 'site.config.json')
const verificationAssetSourceDir = resolve(
  rootDir,
  'node_modules/@zktx.io/sui-move-builder/dist/verification/v6',
)

const verificationWasmAssets = [
  {
    source: 'classic/sui_move_wasm.js',
    fileName: 'assets/v6/classic/sui_move_wasm.js',
  },
  {
    source: 'classic/sui_move_wasm_bg.wasm',
    fileName: 'assets/v6/classic/sui_move_wasm_bg.wasm',
  },
  {
    source: 'v7source-2024/sui_move_wasm.js',
    fileName: 'assets/v6/v7source-2024/sui_move_wasm.js',
  },
  {
    source: 'v7source-2024/sui_move_wasm_bg.wasm',
    fileName: 'assets/v6/v7source-2024/sui_move_wasm_bg.wasm',
  },
]

const contentTypeFor = (fileName: string): string =>
  extname(fileName) === '.wasm' ? 'application/wasm' : 'application/javascript'

const readSiteObjectId = async (): Promise<string | undefined> => {
  try {
    const siteConfig = JSON.parse(
      await readFile(siteConfigPath, 'utf8'),
    ) as { site_obj_id?: unknown }
    return typeof siteConfig.site_obj_id === 'string' &&
      siteConfig.site_obj_id.length > 0
      ? siteConfig.site_obj_id
      : undefined
  } catch {
    return undefined
  }
}

const createWalrusSiteResources = (
  wasmFileNames: Iterable<string>,
  objectId?: string,
): string => {
  const headers = Object.fromEntries(
    [...wasmFileNames].sort().map((fileName) => [
      `/${fileName}`,
      {
        'content-type': 'application/wasm',
      },
    ]),
  )

  return `${JSON.stringify(
    {
      ...(objectId ? { object_id: objectId } : {}),
      headers,
    },
    null,
    2,
  )}\n`
}

const verificationWasmAssetsPlugin = (): Plugin => {
  const assetsByRequestPath = new Map(
    verificationWasmAssets.map((asset) => [asset.fileName, asset]),
  )

  return {
    name: 'verification-wasm-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const requestUrl = (req as { url?: string }).url ?? '/'
        const pathname = new URL(requestUrl, 'http://localhost').pathname

        const requestPath = pathname.replace(/^\/+/, '')
        const asset = assetsByRequestPath.get(requestPath)

        if (!asset) {
          next()
          return
        }

        void readFile(resolve(verificationAssetSourceDir, asset.source))
          .then((source) => {
            res.statusCode = 200
            res.setHeader('Content-Type', contentTypeFor(asset.fileName))
            res.end(source)
          })
          .catch(next)
      })
    },
    async generateBundle(_options, bundle) {
      for (const asset of verificationWasmAssets) {
        this.emitFile({
          type: 'asset',
          fileName: asset.fileName,
          source: await readFile(
            resolve(verificationAssetSourceDir, asset.source),
          ),
        })
      }

      const wasmFileNames = new Set<string>()
      for (const asset of Object.values(bundle)) {
        if (asset.type === 'asset' && asset.fileName.endsWith('.wasm')) {
          wasmFileNames.add(asset.fileName)
        }
      }

      for (const asset of verificationWasmAssets) {
        if (asset.fileName.endsWith('.wasm')) {
          wasmFileNames.add(asset.fileName)
        }
      }

      this.emitFile({
        type: 'asset',
        fileName: 'ws-resources.json',
        source: createWalrusSiteResources(
          wasmFileNames,
          await readSiteObjectId(),
        ),
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), verificationWasmAssetsPlugin()],
  optimizeDeps: {
    exclude: ['@zktx.io/sui-move-builder'],
  },
})
