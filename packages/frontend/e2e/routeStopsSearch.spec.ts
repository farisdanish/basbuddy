import { test, expect } from '@playwright/test';

const mockRouteDetails = {
  routeId: '750',
  routeShortName: '750',
  routeLongName: 'Hab Pasar Seni ~ UiTM Puncak Alam',
  routeColor: '1F7A6C',
  directions: [
    {
      directionId: 0,
      tripHeadsign: 'UiTM Puncak Alam',
      stops: [
        { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696, stopSequence: 1 },
        { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, stopSequence: 2 },
        { stopId: 'SA001', stopName: 'Seksyen 2 Shah Alam', lat: 3.072, lon: 101.518, stopSequence: 3 },
      ],
      shapes: [[3.143, 101.696], [3.118, 101.677]],
    },
  ],
  shapes: [[3.143, 101.696], [3.118, 101.677]],
  stops: [
    { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696, stopSequence: 1 },
    { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, stopSequence: 2 },
    { stopId: 'SA001', stopName: 'Seksyen 2 Shah Alam', lat: 3.072, lon: 101.518, stopSequence: 3 },
  ],
  vehicles: [],
  timetable: {
    firstBusTime: '06:00:00',
    lastBusTime: '23:30:00',
    totalTripsToday: 1,
    nextDepartures: [],
    allDepartures: [],
  },
};

const mockStopArrivals = {
  stopId: 'KL1092',
  stopName: 'Mid Valley North Court',
  generatedAt: new Date().toISOString(),
  arrivals: [],
};

test.describe('Station Selection Searchable List View for Route (PR 3 - Task #8)', () => {
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

    await page.route('/api/routes', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          routes: [
            { routeId: '750', routeShortName: '750', routeLongName: 'Hab Pasar Seni ~ UiTM Puncak Alam', routeColor: '1F7A6C' },
          ],
        }),
      });
    });

    await page.route(/\/api\/routes\/750/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRouteDetails),
      });
    });

    await page.route(/\/api\/stops\/KL1092\/etas/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStopArrivals),
      });
    });

    await page.route(/\/api\/stops\/KL1092\/timetable/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stopId: 'KL1092', stopName: 'Mid Valley North Court', departures: [] }),
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

  test('filters route stops sequence in real-time by keyword and stop ID', async ({ page }) => {
    await page.goto('/');

    // Search and select route 750
    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await routeItem.click();

    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    await expect(sidebar).toBeVisible();

    // Verify initial stops count (3)
    await expect(sidebar.getByRole('button', { name: /Hab Pasar Seni/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Mid Valley North Court/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Seksyen 2 Shah Alam/i })).toBeVisible();

    // Type query in stop filter input
    const stopFilterInput = sidebar.getByPlaceholder('Filter stops along route...');
    await expect(stopFilterInput).toBeVisible();
    await stopFilterInput.fill('mid valley');

    // Verify filtered results
    await expect(sidebar.getByText('1 of 3')).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Mid Valley North Court/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Hab Pasar Seni/i })).not.toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Seksyen 2 Shah Alam/i })).not.toBeVisible();

    // Filter by stop ID
    await stopFilterInput.fill('SA001');
    await expect(sidebar.getByRole('button', { name: /Seksyen 2 Shah Alam/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Mid Valley North Court/i })).not.toBeVisible();

    // Clear filter via 'X' button
    const clearFilterBtn = sidebar.getByRole('button', { name: 'Clear stop filter' });
    await clearFilterBtn.click();
    await expect(sidebar.getByRole('button', { name: /Hab Pasar Seni/i })).toBeVisible();
    await expect(sidebar.getByRole('button', { name: /Mid Valley North Court/i })).toBeVisible();
  });

  test('displays friendly empty state on non-matching query and clears search', async ({ page }) => {
    await page.goto('/');

    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await routeItem.click();

    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    const stopFilterInput = sidebar.getByPlaceholder('Filter stops along route...');
    await stopFilterInput.fill('NonExistentStopXYZ');

    // Empty state should be visible
    await expect(sidebar.getByText(/No stops found matching/i)).toBeVisible();
    const clearBtn = sidebar.getByRole('button', { name: 'Clear search' });
    await expect(clearBtn).toBeVisible();

    // Clicking clear search resets list
    await clearBtn.click();
    await expect(sidebar.getByRole('button', { name: /Hab Pasar Seni/i })).toBeVisible();
  });

  test('clicking filtered stop opens StopSheet drawer', async ({ page }) => {
    await page.goto('/');

    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await routeItem.click();

    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    const stopFilterInput = sidebar.getByPlaceholder('Filter stops along route...');
    await stopFilterInput.fill('Mid Valley');

    const midValleyBtn = sidebar.getByRole('button', { name: /Mid Valley North Court/i });
    await midValleyBtn.click();

    // Verify StopSheet opened for Mid Valley
    const stopHeading = page.getByRole('heading', { name: 'Mid Valley North Court' });
    await expect(stopHeading).toBeVisible({ timeout: 5000 });
  });
});
