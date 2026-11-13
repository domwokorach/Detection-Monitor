/// <reference types="vite/client" />
interface ImportMetaEnv {
  /** Logo.dev publishable key (pk_...). Public by design; the secret key never exists in the frontend. */
  readonly VITE_LOGO_DEV_PUBLISHABLE_KEY?: string
}
