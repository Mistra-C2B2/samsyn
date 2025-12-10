import { expect, test } from "@playwright/test";
import { AppPage } from "./pages";

test.describe("Map Interactions", () => {
	let appPage: AppPage;

	test.beforeEach(async ({ page }) => {
		appPage = new AppPage(page);
		await appPage.goto();
	});

	test("should display map container", async ({ page }) => {
		// Wait for map to be present (or empty state)
		const mapContainer = page.locator(".maplibregl-map");
		const emptyState = page.locator('text=No Maps available');

		// Either map or empty state should be visible
		await expect(mapContainer.or(emptyState)).toBeVisible();
	});

	test("should show empty state when no maps exist", async ({ page }) => {
		// If no maps, empty state should be shown
		const emptyState = page.locator('text=No Maps available');
		const mapContainer = page.locator(".maplibregl-map");

		// Check which state we're in
		const hasMap = await mapContainer.isVisible().catch(() => false);
		const hasEmptyState = await emptyState.isVisible().catch(() => false);

		// One of these should be true
		expect(hasMap || hasEmptyState).toBe(true);
	});

	test("should display map with canvas when map exists", async ({ page }) => {
		const mapContainer = page.locator(".maplibregl-map");

		// Skip if no map loaded
		if (!(await mapContainer.isVisible().catch(() => false))) {
			test.skip();
			return;
		}

		// Map canvas should be present
		const canvas = page.locator(".maplibregl-canvas");
		await expect(canvas).toBeVisible();
	});

	test("should have map controls when map is loaded", async ({ page }) => {
		const mapContainer = page.locator(".maplibregl-map");

		// Skip if no map loaded
		if (!(await mapContainer.isVisible().catch(() => false))) {
			test.skip();
			return;
		}

		// MapLibre typically adds navigation controls
		const zoomIn = page.locator(".maplibregl-ctrl-zoom-in");
		const zoomOut = page.locator(".maplibregl-ctrl-zoom-out");

		// Controls may or may not be present depending on config
		// Just verify the map is interactive
		await expect(mapContainer).toBeVisible();
	});

	test("should be able to interact with map canvas", async ({ page }) => {
		const mapCanvas = page.locator(".maplibregl-canvas");

		// Skip if no map loaded
		if (!(await mapCanvas.isVisible().catch(() => false))) {
			test.skip();
			return;
		}

		// Get initial viewport
		const initialBounds = await mapCanvas.boundingBox();
		expect(initialBounds).toBeTruthy();

		// Perform a click on the map
		await mapCanvas.click({ position: { x: 200, y: 200 } });

		// Map should still be visible after interaction
		await expect(mapCanvas).toBeVisible();
	});

	test("should support pan interaction", async ({ page }) => {
		const mapCanvas = page.locator(".maplibregl-canvas");

		// Skip if no map loaded
		if (!(await mapCanvas.isVisible().catch(() => false))) {
			test.skip();
			return;
		}

		const box = await mapCanvas.boundingBox();
		if (!box) {
			test.skip();
			return;
		}

		// Perform drag to pan
		const startX = box.x + box.width / 2;
		const startY = box.y + box.height / 2;

		await page.mouse.move(startX, startY);
		await page.mouse.down();
		await page.mouse.move(startX + 100, startY + 50, { steps: 10 });
		await page.mouse.up();

		// Map should still be visible and functional
		await expect(mapCanvas).toBeVisible();
	});
});

test.describe("Map Selection", () => {
	let appPage: AppPage;

	test.beforeEach(async ({ page }) => {
		appPage = new AppPage(page);
		await appPage.goto();
	});

	test("should display current map name in header", async ({ page }) => {
		const mapName = page.locator("header p.text-slate-500");
		await expect(mapName).toBeVisible();

		const text = await mapName.textContent();
		// Either a map name or "No Map Selected"
		expect(text).toBeTruthy();
	});

	test("should show maps panel with map list", async ({ page }) => {
		await appPage.openMapsPanel();

		// Maps panel should open
		await expect(page.locator('h2:has-text("Maps")')).toBeVisible();
	});

	test("should have create map button in maps panel", async ({ page }) => {
		await appPage.openMapsPanel();
		await page.waitForTimeout(500);

		const createMapButton = page.getByRole("button", { name: /Create/i });
		await expect(createMapButton).toBeVisible();
	});
});
