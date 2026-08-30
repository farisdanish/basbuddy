import { test, expect } from '@playwright/test';

test.describe('Navigation Drawer, Agency Filters & Municipal Hub Discovery (PR 5 - Task #10)', () => {
  test.beforeEach(async ({ page }) => {
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

    await page.route(/\/api\/favorites/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ favorites: [] }),
      });
    });
  });

  test('opens navigation drawer from header menu button and filters agencies', async ({ page }) => {
    await page.goto('/');

    // Click navigation menu button
    const menuBtn = page.getByRole('button', { name: 'Open navigation drawer' });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();

    // Verify drawer is open
    const drawer = page.locator('[data-testid="navigation-drawer"]');
    await expect(drawer).toBeVisible();
    await expect(drawer).toContainText(/BasBuddy Transit/i);

    // Verify agency filter options
    const mrtFeederBtn = drawer.getByRole('button', { name: /MRT Feeder/i });
    await expect(mrtFeederBtn).toBeVisible();
    await mrtFeederBtn.click();

    // Verify agency selection reflects
    await expect(mrtFeederBtn).toHaveClass(/bg-\[#1F7A6C\]/);

    // Close drawer via Escape key
    await page.keyboard.press('Escape');
    await expect(drawer).not.toBeVisible();
  });

  test('searches municipal hubs and clicking a hub closes drawer', async ({ page }) => {
    await page.goto('/');

    const menuBtn = page.getByRole('button', { name: 'Open navigation drawer' });
    await menuBtn.click();

    const drawer = page.locator('[data-testid="navigation-drawer"]');
    await expect(drawer).toBeVisible();

    // Search for a specific hub
    const hubSearchInput = drawer.getByPlaceholder('Search municipal hubs...');
    await hubSearchInput.fill('Bandar Utama');

    // Hub card should be visible
    const buHubBtn = drawer.getByRole('button', { name: /1 Utama \/ Bandar Utama/i });
    await expect(buHubBtn).toBeVisible();
    await expect(buHubBtn).toContainText('Petaling Jaya');

    // Clicking hub pans map and closes drawer
    await buHubBtn.click();
    await expect(drawer).not.toBeVisible();
  });

  test('opens Saved Favorites modal from navigation drawer shortcut', async ({ page }) => {
    await page.goto('/');

    const menuBtn = page.getByRole('button', { name: 'Open navigation drawer' });
    await menuBtn.click();

    const drawer = page.locator('[data-testid="navigation-drawer"]');
    const favsShortcut = drawer.getByRole('button', { name: /Saved Favorites/i });
    await expect(favsShortcut).toBeVisible();
    await favsShortcut.click();

    // Verify drawer closed and Favorites modal opened
    await expect(drawer).not.toBeVisible();
    const favsModal = page.locator('[data-testid="favorites-modal"]');
    await expect(favsModal).toBeVisible();
  });
});
