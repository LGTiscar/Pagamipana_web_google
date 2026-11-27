/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_ENABLE_APPLE_LOGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Id del build, inyectado por vite.config.ts (ver services/appUpdate.ts).
declare const __APP_BUILD__: string;
