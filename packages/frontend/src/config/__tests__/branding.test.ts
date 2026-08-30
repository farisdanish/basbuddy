import { describe, it, expect } from 'vitest';
import { BRAND_CONFIG } from '../branding.ts';

describe('BRAND_CONFIG', () => {
  it('loads branding configuration with valid properties', () => {
    expect(BRAND_CONFIG.brandName).toBeTruthy();
    expect(typeof BRAND_CONFIG.brandName).toBe('string');
    expect(BRAND_CONFIG.brandTagline).toBeTruthy();
    expect(BRAND_CONFIG.brandDescription).toBeTruthy();
    expect(BRAND_CONFIG.regionName).toBeTruthy();
    expect(BRAND_CONFIG.repoUrl).toMatch(/^https?:\/\//);
    expect(BRAND_CONFIG.version).toMatch(/^v\d+\.\d+/);
    expect(BRAND_CONFIG.supportEmail).toContain('@');
  });

  it('defaults to BasBuddy when environment variables are unset or standard', () => {
    expect(BRAND_CONFIG.brandName).toBe('BasBuddy');
    expect(BRAND_CONFIG.regionName).toBe('Klang Valley');
    expect(BRAND_CONFIG.repoUrl).toBe('https://github.com/farisdanish/basbuddy');
  });
});
