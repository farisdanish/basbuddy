import { test, expect } from '@playwright/test';

test.describe('Frontend Shell (M5)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API requests in preview mode to test shell in isolation
    await page.route('/api/favorites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ favorites: [] }),
      });
    });
  });

  test('renders map container, root layout, and zero console errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(err.message);
    });

    await page.goto('/');

    // Check title
    await expect(page).toHaveTitle(/BasBuddy/);

    // Verify root element and leaflet map container rendered
    const root = page.locator('#root');
    await expect(root).toBeVisible();

    const leafletContainer = page.locator('.leaflet-container');
    await expect(leafletContainer).toBeVisible();

    // Verify attribution footer
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('data.gov.my');
    await expect(footer).toContainText('CC BY 4.0');
    await expect(footer).toContainText('Unofficial');

    // Assert no unhandled console errors
    expect(consoleErrors).toEqual([]);
  });

  test('applies design tokens, Tailwind layout utilities, and time-of-day gradient class', async ({ page }) => {
    await page.goto('/');

    const mainContainer = page.locator('#root > div');
    await expect(mainContainer).toBeVisible();

    const classAttr = (await mainContainer.getAttribute('class')) ?? '';

    // Should include a time gradient class (e.g. gradient-dawn, gradient-golden, gradient-night, etc.)
    expect(classAttr).toMatch(/gradient-(dawn|morning|midday|golden|dusk|night)/);

    // Should include Tailwind layout utilities
    expect(classAttr).toContain('relative');
    expect(classAttr).toContain('h-full');
    expect(classAttr).toContain('w-full');
  });

  test('renders favorites tray when favorite stops are present', async ({ page }) => {
    await page.route('/api/favorites', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          favorites: [
            {
              id: 1,
              stopId: 'KL1081',
              routeId: '750',
              label: 'Pasar Seni Hub',
              createdAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    await page.goto('/');

    const favButton = page.locator('#favorite-1');
    await expect(favButton).toBeVisible();
    await expect(favButton).toContainText('Pasar Seni Hub');
    await expect(favButton).toContainText('Route 750');
  });

  test('serves valid PWA manifest and static icon assets', async ({ request }) => {
    // Check manifest.webmanifest
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe('BasBuddy');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThanOrEqual(2);

    // Check favicon and icons
    const faviconRes = await request.get('/favicon.ico');
    expect(faviconRes.status()).toBe(200);

    const appleIconRes = await request.get('/apple-touch-icon.png');
    expect(appleIconRes.status()).toBe(200);

    const icon192Res = await request.get('/icons/icon-192.png');
    expect(icon192Res.status()).toBe(200);

    const icon512Res = await request.get('/icons/icon-512.png');
    expect(icon512Res.status()).toBe(200);
  });
});
