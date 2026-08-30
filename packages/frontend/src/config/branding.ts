export interface BrandConfig {
  brandName: string;
  brandTagline: string;
  brandDescription: string;
  regionName: string;
  repoUrl: string;
  version: string;
  supportEmail: string;
}

export const BRAND_CONFIG: BrandConfig = {
  brandName: import.meta.env.VITE_APP_BRAND_NAME || 'BasBuddy',
  brandTagline: import.meta.env.VITE_APP_BRAND_TAGLINE || 'Live Malaysia Transit',
  brandDescription:
    import.meta.env.VITE_APP_BRAND_DESCRIPTION ||
    'Live transit tracker for buses and rail across Malaysia. Real-time arrival estimates and live vehicle maps.',
  regionName: import.meta.env.VITE_APP_REGION_NAME || 'Klang Valley',
  repoUrl: import.meta.env.VITE_APP_REPO_URL || 'https://github.com/farisdanish/basbuddy',
  version: 'v1.0',
  supportEmail: 'farisdanish.antoni@gmail.com',
};
