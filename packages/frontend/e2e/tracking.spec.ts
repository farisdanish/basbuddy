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

    // Stateful mock favorites store per device
    const mockFavoritesByDevice = new Map<string, Array<{ id: number; stopId: string; routeId: string | null; label: string; createdAt: string }>>();

    await page.route('**/api/favorites**', async (route) => {
      const method = route.request().method();
      const deviceId = route.request().headers()['x-device-id'] || 'default-device';
      const currentFavs = mockFavoritesByDevice.get(deviceId) ?? [];

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ favorites: currentFavs }),
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
        const updated = [newFav, ...currentFavs];
        mockFavoritesByDevice.set(deviceId, updated);
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify(newFav),
        });
      } else if (method === 'DELETE') {
        mockFavoritesByDevice.set(deviceId, []);
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
              { routeId: '750', routeShortName: '750', routeLongName: 'Pasar Seni - Seksyen 2 Shah Alam', routeColor: 'F4A100', liveBusCount: 2 },
              { routeId: '772', routeShortName: '772', routeLongName: 'Pasar Seni - Subang Suria', routeColor: 'F4A100', liveBusCount: 0 },
              { routeId: 'SA02', routeShortName: 'SA02', routeLongName: 'Hentian Bandar Seksyen 14 - KTM Batu 3', routeColor: '008716', liveBusCount: 1 },
              { routeId: 'PJ01', routeShortName: 'PJ01', routeLongName: 'Taman Medan - LRT Taman Jaya', routeColor: '008716', liveBusCount: 0 },
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
          timetable: {
            firstBusTime: '06:00:00',
            lastBusTime: '23:30:00',
            nextDepartures: [
              { tripId: `TRIP-${routeId}-1`, departureTime: '07:15:00', tripHeadsign: 'Seksyen 2 Shah Alam', directionId: 0 },
            ],
            allDepartures: [
              { tripId: `TRIP-${routeId}-1`, departureTime: '07:15:00', tripHeadsign: 'Seksyen 2 Shah Alam', directionId: 0 },
              { tripId: `TRIP-${routeId}-2`, departureTime: '08:30:00', tripHeadsign: 'Seksyen 2 Shah Alam', directionId: 0 },
              { tripId: `TRIP-${routeId}-3`, departureTime: '13:00:00', tripHeadsign: 'Seksyen 2 Shah Alam', directionId: 0 },
              { tripId: `TRIP-${routeId}-4`, departureTime: '19:45:00', tripHeadsign: 'Seksyen 2 Shah Alam', directionId: 0 },
            ],
          },
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
    await stopMarkers.first().click();

    // Click favorite toggle button
    const favButton = page.getByRole('button', { name: 'Save to favorites' });
    await expect(favButton).toBeVisible();
    await favButton.click();

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
    await expect(routeButton).toContainText('2 live');
    await routeButton.click();

    // Verify RouteTrackerSheet opens with title and active live bus count
    const routeInspector = page.getByRole('complementary', { name: 'Route inspector' });
    await expect(routeInspector).toBeVisible({ timeout: 5000 });
    await expect(routeInspector).toContainText('750');
    await expect(routeInspector).toContainText('Pasar Seni - Seksyen 2 Shah Alam');
    await expect(routeInspector).toContainText('1 bus live');

    // Verify stops are rendered in the route inspector list
    await expect(routeInspector).toContainText('Pasar Seni Platform B');
    await expect(routeInspector).toContainText('Mid Valley North Court');

    // Clicking a stop in the route list selects it and opens stop sheet
    const midValleyStop = routeInspector.getByRole('button', { name: /Mid Valley North Court/i });
    await midValleyStop.click();
    const stopHeading = page.getByRole('heading', { name: 'Mid Valley North Court' });
    await expect(stopHeading).toBeVisible({ timeout: 5000 });

    // Dismiss stop sheet
    await page.keyboard.press('Escape');

    // Open timetable right pane
    const timetableBtn = routeInspector.getByRole('button', { name: /Timetable/i });
    await timetableBtn.click();
    const timetableDialog = page.getByRole('dialog');
    await expect(timetableDialog).toBeVisible({ timeout: 5000 });
    await expect(timetableDialog).toContainText(/Timetable/i);
    await expect(timetableDialog).toContainText('750');

    // Verify Stop Timeline tab & stops
    await expect(timetableDialog.getByRole('button', { name: /Stop Timeline & ETAs/i })).toBeVisible();
    await expect(timetableDialog).toContainText('Pasar Seni Platform B');

    // Switch to Daily Schedule tab
    const scheduleTabBtn = timetableDialog.getByRole('button', { name: /Daily Schedule/i });
    await scheduleTabBtn.click();
    await expect(timetableDialog).toContainText(/Morning|Afternoon|Evening|First Bus/i);

    // Switch to Trip Calculator tab
    const calcTabBtn = timetableDialog.getByRole('button', { name: /Trip Calc/i });
    await calcTabBtn.click();
    await expect(timetableDialog).toContainText(/Trip & ETA Calculator/i);

    // Close timetable pane
    const closeTimetableBtn = timetableDialog.getByRole('button', { name: 'Close timetable' });
    await closeTimetableBtn.click();
    await expect(timetableDialog).not.toBeVisible();

    // Close route inspector
    const closeBtn = page.getByRole('button', { name: 'Close route inspector' });
    await closeBtn.click({ force: true });
    await expect(routeInspector).not.toBeVisible();
  });

  test('mobile viewport renders RouteTrackerSheet with horizontal stops strip and responsive timetable modal', async ({ page }) => {
    // Set mobile viewport (iPhone 14 / modern smartphone dimensions)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Search and select route 750
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchTrigger.click({ force: true });

    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');

    const routeButton = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await expect(routeButton).toBeVisible({ timeout: 5000 });
    await routeButton.click();

    // Verify RouteTrackerSheet renders on mobile
    const routeInspector = page.getByRole('complementary', { name: 'Route inspector' });
    await expect(routeInspector).toBeVisible({ timeout: 5000 });
    await expect(routeInspector).toContainText('750');
    await expect(routeInspector).toContainText('Pasar Seni - Seksyen 2 Shah Alam');

    // Verify stop items render
    const stopPill = routeInspector.getByRole('button', { name: /Pasar Seni Platform B/i });
    await expect(stopPill).toBeVisible();

    // Open timetable on mobile
    const timetableBtn = routeInspector.getByRole('button', { name: /Timetable/i });
    await timetableBtn.click();

    // Verify timetable modal is visible with scheduled departures
    const timetableDialog = page.getByRole('dialog');
    await expect(timetableDialog).toBeVisible({ timeout: 5000 });
    await expect(timetableDialog).toContainText(/Timetable/i);

    // Close timetable via close button
    const closeTimetableBtn = timetableDialog.getByRole('button', { name: 'Close timetable' });
    await closeTimetableBtn.click();
    await expect(timetableDialog).not.toBeVisible();

    // Minimize route inspector on mobile
    const minimizeBtn = page.getByRole('button', { name: 'Minimize route inspector' });
    await expect(minimizeBtn).toBeVisible();
    await minimizeBtn.click();

    // Verify compact floating chip is visible
    const expandBtn = page.getByRole('button', { name: 'Expand route details' });
    await expect(expandBtn).toBeVisible();
    await expect(expandBtn).toContainText('750');
    await expect(expandBtn).toContainText('1 live');

    // Tap expand button to restore full route card
    await expandBtn.click();
    await expect(page.getByRole('heading', { name: 'Pasar Seni - Seksyen 2 Shah Alam' })).toBeVisible();

    // Tap stop pill to open StopSheet drawer
    await stopPill.click();
    const stopHeading = page.getByRole('heading', { name: 'Pasar Seni Platform B' });
    await expect(stopHeading).toBeVisible({ timeout: 5000 });

    // Dismiss StopSheet
    await page.keyboard.press('Escape');

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

  test('displays distinct service badges for Smart Selangor, PJ City, and RapidKL routes in search and route sheets', async ({ page }) => {
    await page.goto('/');

    // Open search overlay
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchTrigger.click({ force: true });

    // Filter to routes
    const routesFilter = page.getByRole('button', { name: '🚌 Routes' });
    await routesFilter.click();

    // Verify service badges in search results list
    const sa02Route = page.getByTestId('search-route-SA02');
    await expect(sa02Route).toBeVisible();
    await expect(sa02Route).toContainText('Smart Selangor');

    const pj01Route = page.getByTestId('search-route-PJ01');
    await expect(pj01Route).toBeVisible();
    await expect(pj01Route).toContainText('PJ City Bus');

    const rapidRoute = page.getByTestId('search-route-750');
    await expect(rapidRoute).toBeVisible();
    await expect(rapidRoute).toContainText('RapidKL');

    // Click Smart Selangor SA02 route to open RouteTrackerSheet
    await sa02Route.click();

    // Verify service badge in RouteTrackerSheet header
    const routeInspector = page.getByRole('complementary', { name: 'Route inspector' });
    await expect(routeInspector).toBeVisible();
    await expect(routeInspector).toContainText('SA02');
    await expect(routeInspector).toContainText('Smart Selangor');

    // Close route inspector
    const closeBtn = page.getByRole('button', { name: 'Close route inspector' });
    await closeBtn.click({ force: true });
    await expect(routeInspector).not.toBeVisible();
  });

  test('generates persistent device ID and attaches x-device-id header on requests', async ({ page }) => {
    let capturedDeviceIdHeader: string | null = null;
    await page.route('**/api/favorites**', async (route) => {
      capturedDeviceIdHeader = route.request().headers()['x-device-id'] ?? null;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ favorites: [] }),
      });
    });

    await page.goto('/');

    // Check localStorage has device ID generated
    const storedDeviceId = await page.evaluate(() => localStorage.getItem('basbuddy_device_id'));
    expect(storedDeviceId).toBeTruthy();
    expect(storedDeviceId!.length).toBeGreaterThanOrEqual(16);

    // Verify header was passed
    expect(capturedDeviceIdHeader).toBe(storedDeviceId);
  });

  test('startup GPS auto-centers map when geolocation permission is granted', async ({ page }) => {
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 3.1425, longitude: 101.696 });

    await page.goto('/');

    // Wait for map to mount and auto-fly to GPS position
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const map = (window as unknown as { __leafletMap?: { getCenter: () => { lat: number; lng: number } } }).__leafletMap;
        if (!map) return null;
        const c = map.getCenter();
        return { lat: Number(c.lat.toFixed(3)), lng: Number(c.lng.toFixed(3)) };
      });
    }, { timeout: 10000 }).toEqual({ lat: 3.143, lng: 101.696 });
  });

  test('preserves map viewport center and zoom across 30s background polling refreshes without resetting', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');

    // Open search and select route 750
    const searchTrigger = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchTrigger.click({ force: true });

    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');

    const routeButton = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await expect(routeButton).toBeVisible();
    await routeButton.click();

    // Verify route inspector opened
    const routeInspector = page.getByRole('complementary', { name: 'Route inspector' });
    await expect(routeInspector).toBeVisible();

    // Fast forward 2s to allow initial route fitBounds animation to settle
    await page.clock.fastForward(2000);

    // Manually move map to custom inspection position
    await page.evaluate(() => {
      const map = (window as unknown as { __leafletMap?: { setView: (coords: [number, number], zoom: number) => void } }).__leafletMap;
      if (map) {
        map.setView([3.120, 101.680], 16);
      }
    });

    // Fast forward 30 seconds to trigger periodic background poller refetch
    await page.clock.fastForward(30_000);

    // Verify map viewport remained at custom position instead of resetting to route fitBounds
    const currentCenter = await page.evaluate(() => {
      const map = (window as unknown as { __leafletMap?: { getCenter: () => { lat: number; lng: number } } }).__leafletMap;
      if (!map) return null;
      const c = map.getCenter();
      return { lat: Number(c.lat.toFixed(3)), lng: Number(c.lng.toFixed(3)) };
    });

    const currentZoom = await page.evaluate(() => {
      const map = (window as unknown as { __leafletMap?: { getZoom: () => number } }).__leafletMap;
      return map ? map.getZoom() : null;
    });

    expect(currentCenter).toEqual({ lat: 3.120, lng: 101.680 });
    expect(currentZoom).toBe(16);
  });
});

