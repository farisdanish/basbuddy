import { test, expect } from '@playwright/test';

test.describe('Position-Aware Suggested Route Refresh for Map View', () => {
  test.beforeEach(async ({ page }) => {
    // Mock health
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

    // Mock static stops
    await page.route('**/api/stops', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.has('near')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stops: [
              { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696, distanceMeters: 120 },
              { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, distanceMeters: 2400 },
            ],
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stops: [
              { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696 },
              { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677 },
              { stopId: 'PJ501', stopName: 'LRT Kelana Jaya', lat: 3.112, lon: 101.603 },
            ],
          }),
        });
      }
    });

    // Mock routes with proximity filtering
    await page.route('**/api/routes**', async (route) => {
      const url = new URL(route.request().url());
      const near = url.searchParams.get('near');

      if (near && near.startsWith('3.112')) {
        // Panned to Kelana Jaya area
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            routes: [
              {
                routeId: '780',
                routeShortName: '780',
                routeLongName: 'Hab Pasar Seni ~ Kota Damansara',
                routeColor: '1F7A6C',
                liveBusCount: 3,
                distanceMeters: 450,
              },
              {
                routeId: 'T781',
                routeShortName: 'T781',
                routeLongName: 'LRT Kelana Jaya ~ Kelana Centre Point',
                routeColor: '1F7A6C',
                liveBusCount: 1,
                distanceMeters: 120,
              },
            ],
          }),
        });
      } else if (near) {
        // Default GPS / KL area
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            routes: [
              {
                routeId: '750',
                routeShortName: '750',
                routeLongName: 'Hab Pasar Seni ~ UiTM Puncak Alam',
                routeColor: '1F7A6C',
                liveBusCount: 2,
                distanceMeters: 300,
              },
            ],
          }),
        });
      } else {
        // Fallback unscoped routes
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            routes: [
              {
                routeId: '750',
                routeShortName: '750',
                routeLongName: 'Hab Pasar Seni ~ UiTM Puncak Alam',
                routeColor: '1F7A6C',
                liveBusCount: 2,
              },
            ],
          }),
        });
      }
    });
  });

  test('refreshes suggested routes for current map area when map is panned', async ({ page }) => {
    // Set mock geolocation in KL Central
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 3.143, longitude: 101.696 });

    await page.goto('/');

    // Wait for map to initialize
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Pan map to Kelana Jaya (3.112, 101.603) using Leaflet window instance
    await page.evaluate(() => {
      const win = window as unknown as { __leafletMap?: { setView: (coords: [number, number], zoom: number) => void } };
      if (win.__leafletMap) {
        win.__leafletMap.setView([3.112, 101.603], 15);
      }
    });

    // Open Search overlay
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchTrigger.click({ force: true });

    const searchOverlay = page.locator('[data-testid="search-overlay"]');
    await expect(searchOverlay).toBeVisible();

    // Since the map is panned > 1km from GPS, the divergence prompt should appear
    const divergenceBtn = page.locator('[data-testid="search-divergence-prompt-btn"]');
    await expect(divergenceBtn).toBeVisible();

    // Click "Search Map Area"
    await divergenceBtn.click();

    // Header updates to reflect map area
    await expect(page.getByText(/Routes in Map View/i)).toBeVisible();

    // Panned routes (780 and T781) should now appear in the results list
    await expect(page.locator('[data-testid="search-route-780"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-route-T781"]')).toBeVisible();

    // Click "My GPS" to return to original location
    const resetGpsBtn = page.locator('[data-testid="search-reset-gps-btn"]');
    await expect(resetGpsBtn).toBeVisible();
    await resetGpsBtn.click();

    // Header resets back to "Routes Near You"
    await expect(page.getByText(/Routes Near You/i)).toBeVisible();
  });

  test('refresh button in routes header allows manual re-query of current map bounds', async ({ page }) => {
    await page.goto('/');

    // Open search directly
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchTrigger.click({ force: true });

    // Refresh map button is available in the header
    const refreshMapBtn = page.locator('[data-testid="search-refresh-map-btn"]');
    await expect(refreshMapBtn).toBeVisible();

    // Click refresh map button
    await refreshMapBtn.click();

    // Section switches to Map View
    await expect(page.getByText(/Routes in Map View/i)).toBeVisible();
  });
});
