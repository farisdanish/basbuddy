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
        { stopId: 'KL1082', stopName: 'KL Sentral Monorail', lat: 3.133, lon: 101.687, stopSequence: 2 },
        { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, stopSequence: 3 },
        { stopId: 'SA001', stopName: 'Seksyen 2 Shah Alam', lat: 3.072, lon: 101.518, stopSequence: 4 },
      ],
      shapes: [[3.143, 101.696], [3.118, 101.677]],
    },
  ],
  shapes: [[3.143, 101.696], [3.118, 101.677]],
  stops: [
    { stopId: 'KL1081', stopName: 'Hab Pasar Seni', lat: 3.143, lon: 101.696, stopSequence: 1 },
    { stopId: 'KL1082', stopName: 'KL Sentral Monorail', lat: 3.133, lon: 101.687, stopSequence: 2 },
    { stopId: 'KL1092', stopName: 'Mid Valley North Court', lat: 3.118, lon: 101.677, stopSequence: 3 },
    { stopId: 'SA001', stopName: 'Seksyen 2 Shah Alam', lat: 3.072, lon: 101.518, stopSequence: 4 },
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

test.describe('Modern Accessible Combobox & Searchable Dropdowns (PR 4 - Task #8b)', () => {
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

  test('combobox supports keyboard navigation, filtering, and selection', async ({ page }) => {
    await page.goto('/');

    // Search and select route 750
    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await routeItem.click();

    // Open Timetable companion / modal
    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    const timetableBtn = sidebar.getByRole('button', { name: /View timetable and schedule|Timetable/i });
    await timetableBtn.click();

    // Navigate to Trip Calculator tab
    const calcTab = page.getByRole('button', { name: /Trip Calc/i });
    await calcTab.click();

    // Verify Combobox input is present
    const boardingCombobox = page.getByRole('combobox', { name: 'Boarding Stop' });
    await expect(boardingCombobox).toBeVisible();

    // Focus and type query in combobox
    await boardingCombobox.click();
    await boardingCombobox.fill('sentral');

    // Listbox should be visible with filtered options
    const listbox = page.getByRole('listbox', { name: 'Boarding Stop' });
    await expect(listbox).toBeVisible();
    await expect(listbox.getByRole('option', { name: /KL Sentral Monorail/i })).toBeVisible();
    await expect(listbox.getByRole('option', { name: /Seksyen 2 Shah Alam/i })).not.toBeVisible();

    // Press Enter to select active option
    await boardingCombobox.press('Enter');

    // Listbox closes and input reflects selected station
    await expect(listbox).not.toBeVisible();
    await expect(boardingCombobox).toHaveValue(/KL Sentral Monorail/);
  });

  test('combobox supports ArrowDown keyboard selection without mouse', async ({ page }) => {
    await page.goto('/');

    const searchBtn = page.getByRole('button', { name: 'Search stops, routes, hubs' });
    await searchBtn.click({ force: true });
    const searchInput = page.getByPlaceholder('Search stops, routes...');
    await searchInput.fill('750');
    const routeItem = page.getByRole('button', { name: /750.*Pasar Seni/i });
    await routeItem.click();

    const sidebar = page.locator('aside[data-testid="route-inspector"]');
    const timetableBtn = sidebar.getByRole('button', { name: /View timetable and schedule|Timetable/i });
    await timetableBtn.click();

    const calcTab = page.getByRole('button', { name: /Trip Calc/i });
    await calcTab.click();

    const alightingCombobox = page.getByRole('combobox', { name: 'Alighting Stop' });
    await alightingCombobox.click();

    // Arrow down to navigate options: 1st ArrowDown opens at index 0 (Pasar Seni), 2nd ArrowDown moves to index 1 (KL Sentral)
    await alightingCombobox.press('ArrowDown');
    await alightingCombobox.press('ArrowDown');
    await alightingCombobox.press('Enter');

    // Expect input value updated to KL Sentral
    await expect(alightingCombobox).toHaveValue(/KL Sentral Monorail/);
  });
});
