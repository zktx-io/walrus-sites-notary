declare class URL {
  constructor(input: string | URL, base?: string | URL)
  readonly pathname: string
  readonly href: string
}

interface ImportMeta {
  readonly url: string
}

declare module 'node:fs/promises' {
  export function readFile(path: string | URL): Promise<Uint8Array>
}

declare module 'node:path' {
  export function extname(path: string): string
  export function resolve(...paths: string[]): string
}

declare module 'node:url' {
  export function fileURLToPath(url: string | URL): string
}
