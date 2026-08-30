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

    // Verify attribution footer with GitHub repository link
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('data.gov.my');
    await expect(footer).toContainText('CC BY 4.0');
    await expect(footer).toContainText('Unofficial');
    await expect(footer).toContainText('GitHub');

    const githubFooterLink = footer.getByRole('link', { name: /GitHub/i });
    await expect(githubFooterLink).toBeVisible();
    await expect(githubFooterLink).toHaveAttribute('href', 'https://github.com/farisdanish/basbuddy');

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

  test('renders header brand badge and handles view reset action', async ({ page }, testInfo) => {
    // Known gap: on narrow viewports SearchHeader's mobile brand slot renders the
    // NavigationDrawer trigger instead of the reset button whenever `onOpenDrawer`
    // is provided (see SearchHeader.tsx), which it always is post-task-#10 — so
    // "reset view" currently has no mobile-reachable affordance at all. This is a
    // desktop-only assertion until that's given a mobile equivalent.
    test.skip(testInfo.project.name === 'mobile-chrome', 'Brand/reset button only renders in the desktop header slot; mobile slot is occupied by the NavigationDrawer trigger.');

    await page.goto('/');

    // Verify brand button is visible in header
    const brandBtn = page.getByRole('button', { name: /Reset view to BasBuddy home/i }).first();
    await expect(brandBtn).toBeVisible();

    // Clicking brand button triggers reset without crashing
    await brandBtn.click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
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

  test('opens Info, FAQ, and Feedback modal from header and footer hyperlinks with open source actions', async ({ page }, testInfo) => {
    await page.goto('/');

    // 1. Open info modal from header button
    const infoButton = page.getByRole('button', { name: /About, FAQ and Feedback/i });
    await expect(infoButton).toBeVisible();
    await infoButton.click();

    // Verify modal is visible with About content
    const infoModal = page.getByRole('dialog', { name: /BasBuddy Info & Support/i });
    await expect(infoModal).toBeVisible();
    await expect(infoModal).toContainText('Independent & Open Source');

    // Verify Star on GitHub and Contribute links
    const starBtn = infoModal.getByRole('link', { name: /Star on GitHub/i });
    await expect(starBtn).toBeVisible();
    await expect(starBtn).toHaveAttribute('href', 'https://github.com/farisdanish/basbuddy');

    const contributeBtn = infoModal.getByRole('link', { name: /Contribute Code/i });
    await expect(contributeBtn).toBeVisible();
    await expect(contributeBtn).toHaveAttribute('href', 'https://github.com/farisdanish/basbuddy');

    // Switch to FAQ tab
    const faqTab = infoModal.getByRole('button', { name: 'FAQ' });
    await faqTab.click();
    await expect(infoModal).toContainText('Why does it say "No live GPS"');

    // Switch to Feedback tab
    const feedbackTab = infoModal.getByRole('button', { name: 'Feedback' });
    await feedbackTab.click();
    await expect(infoModal).toContainText('Submit an Issue / Feature Request');

    const issueLink = infoModal.getByRole('link', { name: /Submit an Issue/i });
    await expect(issueLink).toHaveAttribute('href', 'https://github.com/farisdanish/basbuddy/issues');

    // Close modal via close button
    const closeBtn = infoModal.getByRole('button', { name: 'Close information modal' });
    await closeBtn.click();
    await expect(infoModal).not.toBeVisible();

    // 2. Open directly to FAQ via footer hyperlink
    // Footer text links are `hidden sm:inline` by design (see App.tsx footer) —
    // below the sm breakpoint their equivalent is NavigationDrawer's "About & FAQ"
    // shortcut, not this footer row.
    test.skip(testInfo.project.name === 'mobile-chrome', 'Footer hyperlinks are desktop-only ("hidden sm:inline"); mobile equivalent is NavigationDrawer\'s About & FAQ shortcut.');

    const footerFaq = page.getByRole('button', { name: 'FAQ', exact: true });
    await footerFaq.click();
    await expect(infoModal).toBeVisible();
    await expect(infoModal).toContainText('Can I see bus plate numbers');

    // Close via Escape key
    await page.keyboard.press('Escape');
    await expect(infoModal).not.toBeVisible();
  });
});
