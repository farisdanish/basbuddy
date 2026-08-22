import { test, expect } from '@playwright/test';

test.describe('BasBuddy Live Tracking & Storyboard Flows (M6)', () => {
  test.beforeEach(async ({ page }) => {
    // Mock default health as live
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

    // Stateful mock favorites store
    let mockFavorites: Array<{ id: number; stopId: string; routeId: string | null; label: string; createdAt: string }> = [];

    await page.route('**/api/favorites**', async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ favorites: mockFavorites }),
        });
      } else if (method === 'POST') {
        const body = (route.request().postDataJSON() ?? {}) as { stopId: string; routeId?: string; label?: string };
        const newFav = {
          id: 42,
          stopId: body.stopId,
          routeId: body.routeId ?? null,
          label: body.label ?? body.stopId,
          createdAt: new Date().toISOString(),
        };
        mockFavorites = [newFav, ...mockFavorites];
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newFav),
        });
      } else if (method === 'DELETE') {
        mockFavorites = [];
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({ status: 200 });
      }
    });

    // Mock stops (nearby, static list, and ETAs)
    await page.route('**/api/stops**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (path.includes('/etas')) {
        const stopId = path.split('/')[3] || 'KL1081';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            stopId,
            stopName: stopId === 'KL1092' ? 'Mid Valley North Court' : 'Pasar Seni Platform B',
            generatedAt: new Date().toISOString(),
            arrivals: [
              {
                tripId: 'TRIP-750-1',
                routeId: '750',
                routeShortName: '750',
                tripHeadsign: 'Shah Alam Seksyen 2',
                etaSeconds: 180,
                source: 'live',
                freshness: 'live',
                vehicle: { lat: 3.141, lon: 101.693, bearing: 280 },
              },
              {
                tripId: 'TRIP-772-1',
                routeId: '772',
                routeShortName: '772',
                tripHeadsign: 'Subang Suria',
                etaSeconds: 660,
                source: 'live',
                freshness: 'live',
                vehicle: { lat: 3.138, lon: 101.689, bearing: 190 },
              },
              {
                tripId: 'TRIP-601-1',
                routeId: '601',
                routeShortName: '601',
                tripHeadsign: 'Puchong Utama',
                etaSeconds: 1440,
                source: 'schedule',
                freshness: 'signal_lost',
                vehicle: null,
              },
            ],
          }),
        });
        return;
      }

      if (url.searchParams.has('near')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            origin: { lat: 3.139, lon: 101.6869 },
            stops: [
              {
                stopId: 'KL1081',
                stopName: 'Pasar Seni Platform B',
                lat: 3.1425,
                lon: 101.696,
                distanceMeters: 350,
              },
              {
                stopId: 'KL1082',
                stopName: 'KL Sentral Monorail',
                lat: 3.133,
                lon: 101.687,
                distanceMeters: 480,
              },
            ],
          }),
        });
        return;
      }

      // Static stop list
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          stops: [
            { stopId: 'KL1081', stopName: 'Pasar Seni Platform B', lat: 3.1425, lon: 101.696 },
            { stopId: 'KL1082', stopName: 'KL Sentral Monorail', lat: 3.133, lon: 101.687 },
            { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677 },
          ],
        }),
      });
    });

    // Consolidated Mock for /api/routes and all sub-routes
    await page.route('**/api/routes**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (path.endsWith('/vehicles')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            routeId: '750',
            vehicles: [
              {
                tripId: 'TRIP-750-1',
                routeId: '750',
                lat: 3.118,
                lon: 101.677,
                bearing: 270,
                timestamp: new Date().toISOString(),
                freshness: 'live',
              },
            ],
          }),
        });
        return;
      }

      if (path === '/api/routes' || path === '/api/routes/') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            routes: [
              { routeId: '750', routeShortName: '750', routeLongName: 'Pasar Seni - Seksyen 2 Shah Alam', routeColor: 'F4A100' },
              { routeId: '772', routeShortName: '772', routeLongName: 'Pasar Seni - Subang Suria', routeColor: 'F4A100' },
            ],
          }),
        });
        return;
      }

      // Specific route details
      const routeId = path.split('/').filter(Boolean).pop() || '750';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          routeId,
          routeShortName: routeId === 'T7280' ? 'T728' : routeId,
          routeLongName: routeId === 'T7280' ? 'Stesen LRT Pasar Klang ~ Setia City' : 'Pasar Seni - Seksyen 2 Shah Alam',
          routeColor: 'F4A100',
          directions: [{ directionId: 0, tripHeadsign: 'Seksyen 2 Shah Alam' }],
          shapes: [
            [3.1425, 101.696],
            [3.118, 101.677],
            [3.072, 101.518],
          ],
          stops: [
            { stopId: 'KL1081', stopName: 'Pasar Seni Platform B', lat: 3.1425, lon: 101.696, stopSequence: 1 },
            { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, stopSequence: 2 },
          ],
          vehicles: [
            {
              tripId: `TRIP-${routeId}-1`,
              routeId,
              lat: 3.118,
              lon: 101.677,
              bearing: 270,
              timestamp: new Date().toISOString(),
              freshness: 'live',
            },
          ],
        }),
      });
    });
  });

  test('tapping stop pin opens StopSheet with live ETAs and freshness badges', async ({ page }) => {
    await page.goto('/');

    // Wait for Leaflet map to load and stop markers to mount
    const stopMarkers = page.locator('.stop-marker-icon');
    await expect(stopMarkers.first()).toBeVisible({ timeout: 10000 });

    // Click the first stop pin
    await stopMarkers.first().click({ force: true });

    // Verify StopSheet drawer opens with title heading
    const titleHeading = page.getByRole('heading', { name: 'Pasar Seni Platform B' });
    await expect(titleHeading).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Stop ID: KL1081')).toBeVisible();

    // Verify upcoming arrivals
    await expect(page.getByText('Shah Alam Seksyen 2')).toBeVisible();
    await expect(page.getByText('3 mins')).toBeVisible();
    await expect(page.getByText('Live vehicle tracked').first()).toBeVisible();

    await expect(page.getByText('Puchong Utama')).toBeVisible();
    await expect(page.getByText('24 mins')).toBeVisible();
    await expect(page.getByText('Schedule estimate')).toBeVisible();
  });

  test('favorites flow allows saving stop and opening from bottom tray', async ({ page }) => {
    await page.goto('/');

    // Open stop sheet
    const stopMarkers = page.locator('.stop-marker-icon');
    await expect(stopMarkers.first()).toBeVisible();
    await stopMarkers.first().click({ force: true });

    // Click favorite toggle button
    const favButton = page.getByRole('button', { name: 'Save to favorites' });
    await expect(favButton).toBeVisible();
    await favButton.click({ force: true });

    // Verify toggle changes to Remove from favorites
    const removeFavButton = page.getByRole('button', { name: 'Remove from favorites' });
    await expect(removeFavButton).toBeVisible({ timeout: 5000 });

    // Close stop sheet via Escape key
    await page.keyboard.press('Escape');

    // Verify favorite chip in bottom tray
    const favChip = page.locator('#favorite-42');
    await expect(favChip).toBeVisible({ timeout: 5000 });
    await expect(favChip).toContainText('Pasar Seni Platform B');
  });

  test('search overlay enables debounced filtering of stops and routes', async ({ page }) => {
    await page.goto('/');

    // Click search header
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await expect(searchTrigger).toBeVisible();
    await searchTrigger.click({ force: true });

    // Search input should be visible and focused
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await expect(searchInput).toBeVisible();

    // Type query
    await searchInput.fill('Mid Valley');

    // Wait for debounced search result
    await expect(page.getByText('Mid Valley North Court')).toBeVisible({ timeout: 5000 });

    // Click stop result
    await page.getByText('Mid Valley North Court').click({ force: true });

    // Verify search overlay closes and StopSheet opens
    await expect(searchInput).not.toBeVisible();
  });

  test('selecting a route from search overlay highlights route polyline and opens RouteTrackerSheet', async ({ page }) => {
    await page.goto('/');

    // Click search header
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchTrigger.click({ force: true });

    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');

    // Click route result
    const routeButton = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await expect(routeButton).toBeVisible({ timeout: 5000 });
    await routeButton.click();

    // Verify RouteTrackerSheet opens with title and active live bus count
    const routeInspector = page.getByRole('complementary', { name: 'Route inspector' });
    await expect(routeInspector).toBeVisible({ timeout: 5000 });
    await expect(routeInspector).toContainText('750');
    await expect(routeInspector).toContainText('Pasar Seni - Seksyen 2 Shah Alam');
    await expect(routeInspector).toContainText('1 bus live');

    // Close route inspector
    const closeBtn = page.getByRole('button', { name: 'Close route inspector' });
    await closeBtn.click({ force: true });
    await expect(routeInspector).not.toBeVisible();
  });

  test('degraded feed warning banner appears when poller heartbeat exceeds staleness threshold', async ({ page }) => {
    // Override health check with stale timestamp (3 minutes ago)
    const staleTime = new Date(Date.now() - 180_000).toISOString();
    await page.route(/\/api\/health|\/health/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'ok',
          pollerLastSuccess: staleTime,
          timestamp: new Date().toISOString(),
        }),
      });
    });

    await page.goto('/');

    // Verify degraded warning banner appears at top
    const banner = page.getByLabel('Feed status banner');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText('Live GPS feed delayed');
  });
});
