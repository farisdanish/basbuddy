import { test, expect } from '@playwright/test';

const mockFavorites = [
  {
    id: 101,
    routeId: '750',
    stopId: null,
    label: 'Route 750 (Pasar Seni ➔ UiTM Shah Alam)',
    createdAt: '2026-08-30T00:00:00.000Z',
  },
  {
    id: 102,
    routeId: 'T719',
    stopId: null,
    label: 'Route T719 (MRT Feeder)',
    createdAt: '2026-08-30T01:00:00.000Z',
  },
  {
    id: 103,
    routeId: null,
    stopId: 'KL1081',
    label: 'KL Sentral Monorail',
    createdAt: '2026-08-30T02:00:00.000Z',
  },
];

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
      ],
      shapes: [[3.143, 101.696], [3.145, 101.698]],
    },
  ],
  shapes: [[3.143, 101.696], [3.145, 101.698]],
  stops: [
    { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696, stopSequence: 1 },
  ],
  vehicles: [],
  timetable: {
    firstBusTime: '06:00:00',
    lastBusTime: '23:30:00',
    totalTripsToday: 1,
    nextDepartures: [],
    allDepartures: [{ tripId: 'trip_1', departureTime: '06:00:00', tripHeadsign: 'UiTM', directionId: 0 }],
  },
};

const mockStopArrivals = {
  stopId: 'KL1081',
  stopName: 'KL Sentral Monorail',
  generatedAt: new Date().toISOString(),
  arrivals: [],
};

test.describe('Favorites Modal (PR 1 - Task #6)', () => {
  test.beforeEach(async ({ page }) => {
    // Seed initial favorites in localStorage for instantaneous rendering
    await page.addInitScript((favs) => {
      window.localStorage.setItem('basbuddy_favorites_cache', JSON.stringify(favs));
    }, mockFavorites);

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

    await page.route(/\/api\/routes\/750/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockRouteDetails),
      });
    });

    await page.route(/\/api\/stops\/KL1081\/etas/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockStopArrivals),
      });
    });

    await page.route(/\/api\/stops\/KL1081\/timetable/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ stopId: 'KL1081', stopName: 'KL Sentral Monorail', departures: [] }),
      });
    });

    await page.route(/\/api\/favorites(\/.*)?$/, async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fulfill({ status: 204 });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ favorites: mockFavorites }),
        });
      }
    });
  });

  test('opens favorites modal from bottom tray and displays categorized tabs and counts', async ({ page }) => {
    await page.goto('/');

    // Locate the saved manage button in bottom tray
    const savedButton = page.locator('#favorites-manage-button');
    await expect(savedButton).toBeVisible();
    await savedButton.click();

    // Verify modal dialog opened
    const modalDialog = page.getByRole('dialog', { name: /Saved Favorites/i });
    await expect(modalDialog).toBeVisible();

    // Verify category tabs with counts
    const allTab = modalDialog.getByRole('button', { name: /^All/i });
    const routesTab = modalDialog.getByRole('button', { name: /^Routes/i });
    const stopsTab = modalDialog.getByRole('button', { name: /^Stops/i });

    await expect(allTab).toBeVisible();
    await expect(routesTab).toBeVisible();
    await expect(stopsTab).toBeVisible();

    // In 'All' view, verify all 3 items appear
    await expect(modalDialog.getByTestId('favorite-modal-item-101')).toBeVisible();
    await expect(modalDialog.getByTestId('favorite-modal-item-102')).toBeVisible();
    await expect(modalDialog.getByTestId('favorite-modal-item-103')).toBeVisible();

    // Filter to 'Routes'
    await routesTab.click();
    await expect(modalDialog.getByTestId('favorite-modal-item-101')).toBeVisible();
    await expect(modalDialog.getByTestId('favorite-modal-item-102')).toBeVisible();
    await expect(modalDialog.getByTestId('favorite-modal-item-103')).not.toBeVisible();

    // Filter to 'Stops'
    await stopsTab.click();
    await expect(modalDialog.getByTestId('favorite-modal-item-103')).toBeVisible();
    await expect(modalDialog.getByTestId('favorite-modal-item-101')).not.toBeVisible();
  });

  test('searches saved favorites by query keyword', async ({ page }) => {
    await page.goto('/');

    const savedButton = page.locator('#favorites-manage-button');
    await expect(savedButton).toBeVisible();
    await savedButton.click();

    const searchInput = page.getByPlaceholder('Search saved routes or stops...');
    await searchInput.fill('feeder');

    // Should only show T719 MRT Feeder
    await expect(page.getByTestId('favorite-modal-item-102')).toBeVisible();
    await expect(page.getByTestId('favorite-modal-item-101')).not.toBeVisible();
    await expect(page.getByTestId('favorite-modal-item-103')).not.toBeVisible();

    // Clear search
    const clearButton = page.getByLabel('Clear search query');
    await clearButton.click();
    await expect(page.getByTestId('favorite-modal-item-101')).toBeVisible();
    await expect(page.getByTestId('favorite-modal-item-103')).toBeVisible();
  });

  test('clicking a favorite route navigates to route tracker', async ({ page }) => {
    await page.goto('/');

    const savedButton = page.locator('#favorites-manage-button');
    await expect(savedButton).toBeVisible();
    await savedButton.click();

    const routeItem = page.getByTestId('favorite-modal-item-101');
    await routeItem.click();

    // Modal should close and RouteTrackerSheet should appear
    const modalDialog = page.getByRole('dialog', { name: /Saved Favorites/i });
    await expect(modalDialog).not.toBeVisible();

    const routeInspector = page.getByRole('complementary', { name: 'Route inspector' });
    await expect(routeInspector).toBeVisible();
    await expect(routeInspector.getByText('Hab Pasar Seni ~ UiTM Puncak Alam')).toBeVisible();
  });

  test('removes a favorite directly inside the modal', async ({ page }) => {
    await page.goto('/');

    const savedButton = page.locator('#favorites-manage-button');
    await expect(savedButton).toBeVisible();
    await savedButton.click();

    const item102 = page.getByTestId('favorite-modal-item-102');
    await expect(item102).toBeVisible();

    // Click trash button on item 102
    const deleteButton = item102.getByRole('button', { name: 'Remove favorite' });
    await deleteButton.click();

    // Item 102 should be removed from view
    await expect(page.getByTestId('favorite-modal-item-102')).not.toBeVisible();
    await expect(page.getByTestId('favorite-modal-item-101')).toBeVisible();
  });
});
