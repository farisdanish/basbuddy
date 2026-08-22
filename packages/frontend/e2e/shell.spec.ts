import { test, expect } from '@playwright/test';

test.describe('Frontend Shell (M5)', () => {
  test.beforeEach(async ({ page }) => {
    // Intercept backend API requests in preview mode to test shell in isolation
    await page.route(/\/api\/health|\/health/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          pollerLastSuccess: new Date().toISOString(),
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.route(/\/api\/stops(\?.*)?/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stops: [] }),
      });
    });

    await page.route('/api/routes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ routes: [] }),
      });
    });

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
              label: 'Pasar Seni (Platform B)',
              createdAt: '2026-08-22T00:00:00Z',
            },
            {
              id: 2,
              stopId: 'KL1082',
              routeId: null,
              label: 'KL Sentral Monorail',
              createdAt: '2026-08-22T00:00:00Z',
            },
          ],
        }),
      });
    });

    await page.goto('/');

    // Wait for favorites list to render
    const fav1 = page.locator('#favorite-1');
    const fav2 = page.locator('#favorite-2');

    await expect(fav1).toBeVisible();
    await expect(fav1).toContainText('Pasar Seni (Platform B)');
    await expect(fav1).toContainText('Route 750');

    await expect(fav2).toBeVisible();
    await expect(fav2).toContainText('KL Sentral Monorail');
    await expect(fav2).toContainText('ID: KL1082');
  });

  test('serves valid PWA manifest and static icon assets', async ({ request }) => {
    // 1. Manifest
    const manifestRes = await request.get('/manifest.webmanifest');
    expect(manifestRes.status()).toBe(200);
    const manifest = await manifestRes.json();
    expect(manifest.name).toBe('BasBuddy');
    expect(manifest.short_name).toBe('BasBuddy');
    expect(manifest.theme_color).toBe('#F4A100');
    expect(manifest.background_color).toBe('#101B2D');

    // 2. Icon 512
    const icon512Res = await request.get('/icons/icon-512.png');
    expect(icon512Res.status()).toBe(200);
    expect(icon512Res.headers()['content-type']).toContain('image/png');

    // 3. Icon 192
    const icon192Res = await request.get('/icons/icon-192.png');
    expect(icon192Res.status()).toBe(200);
    expect(icon192Res.headers()['content-type']).toContain('image/png');

    // 4. Favicon
    const faviconRes = await request.get('/favicon.ico');
    expect(faviconRes.status()).toBe(200);
  });
});
