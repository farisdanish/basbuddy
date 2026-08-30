/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_BRAND_NAME?: string;
  readonly VITE_APP_BRAND_TAGLINE?: string;
  readonly VITE_APP_BRAND_DESCRIPTION?: string;
  readonly VITE_APP_REGION_NAME?: string;
  readonly VITE_APP_REPO_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __leafletMap?: import('leaflet').Map;
}
