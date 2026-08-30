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
        { stopId: 'KL1092', stopName: 'Mid Valley', lat: 3.118, lon: 101.677, stopSequence: 2 },
      ],
      shapes: [[3.143, 101.696], [3.118, 101.677]],
    },
  ],
  shapes: [[3.143, 101.696], [3.118, 101.677]],
  stops: [
    { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696, stopSequence: 1 },
    { stopId: 'KL1092', stopName: 'Mid Valley', lat: 3.118, lon: 101.677, stopSequence: 2 },
  ],
  vehicles: [],
  timetable: {
    firstBusTime: '06:00:00',
    lastBusTime: '23:30:00',
    totalTripsToday: 2,
    nextDepartures: [
      { tripId: 'trip_1', departureTime: '07:00:00', tripHeadsign: 'UiTM Puncak Alam', directionId: 0 },
    ],
    allDepartures: [
      { tripId: 'trip_1', departureTime: '07:00:00', tripHeadsign: 'UiTM Puncak Alam', directionId: 0 },
      { tripId: 'trip_2', departureTime: '08:00:00', tripHeadsign: 'UiTM Puncak Alam', directionId: 0 },
    ],
  },
};

test.describe('Desktop Multi-Pane Layout & Breakpoint Hierarchy (PR 2 - Task #7)', () => {
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

    await page.route(/\/api\/favorites/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ favorites: [] }),
      });
    });
  });

  test('docks RouteTrackerSheet and RouteTimetableModal side-by-side on widescreen desktop (>=1280px)', async ({ page }) => {
    // Set 1440px widescreen viewport
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    // Search and select route 750
    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await expect(routeItem).toBeVisible();
    await routeItem.click();

    // Verify RouteTrackerSheet sidebar rendered
    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    await expect(sidebar).toBeVisible();

    // Open timetable companion pane
    const timetableTrigger = sidebar.getByRole('button', { name: /View timetable and schedule|Timetable/i });
    await expect(timetableTrigger).toBeVisible();
    await timetableTrigger.click();

    // Verify timetable modal is visible
    const timetableDialog = page.locator('[data-testid="route-timetable-modal"]');
    await expect(timetableDialog).toBeVisible();

    // Verify both sidebar and timetable companion are visible simultaneously
    await expect(sidebar).toBeVisible();
    await expect(timetableDialog).toBeVisible();

    // Verify keyboard Esc dismisses companion pane first without closing sidebar
    await page.keyboard.press('Escape');
    await expect(timetableDialog).not.toBeVisible();
    await expect(sidebar).toBeVisible();

    // Verify close button dismisses sidebar
    const closeBtn = page.getByRole('button', { name: 'Close route inspector' });
    await closeBtn.click();
    await expect(sidebar).not.toBeVisible();
  });

  test('falls back to centered modal overlay on tablet / narrow desktop (<1280px)', async ({ page }) => {
    // Set 1024px tablet viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/');

    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await expect(routeItem).toBeVisible();
    await routeItem.click();

    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    await expect(sidebar).toBeVisible();

    const timetableTrigger = sidebar.getByRole('button', { name: /View timetable and schedule|Timetable/i });
    await expect(timetableTrigger).toBeVisible();
    await timetableTrigger.click();

    const timetableDialog = page.locator('[data-testid="route-timetable-modal"]');
    await expect(timetableDialog).toBeVisible();

    // In centered modal mode, outer container has fixed inset-0 z-50 with backdrop blur
    await expect(timetableDialog).toHaveClass(/fixed inset-0 z-50/);

    // Pressing Esc dismisses the modal
    await page.keyboard.press('Escape');
    await expect(timetableDialog).not.toBeVisible();
    await expect(sidebar).toBeVisible();
  });
});
