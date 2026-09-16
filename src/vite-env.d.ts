/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly NIRAMAYA_API_URL?: string
  readonly MY_VITE_API_URL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
