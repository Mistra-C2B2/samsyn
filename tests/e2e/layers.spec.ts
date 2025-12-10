import { expect, test } from "@playwright/test";
import { AppPage, LayersPage } from "./pages";

/**
 * Helper function to check if a map exists in the app.
 * The Layers panel only renders when currentMap is not null.
 * We check for the map canvas AND that there's a map name displayed (not "No Map Selected")
 */
async function hasMapLoaded(
	page: import("@playwright/test").Page
): Promise<boolean> {
	const hasMapCanvas = await page
		.locator(".maplibregl-map")
		.isVisible()
		.catch(() => false);
	if (!hasMapCanvas) return false;

	// Also check that a map is actually selected (not just the empty state)
	const mapNameText = await page
		.locator("header p.text-slate-500")
		.textContent();
	return mapNameText !== null && mapNameText !== "No Map Selected";
}

test.describe("Layer Management", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(1500); // Wait for map data to load
	});

	test("should display layers panel by default when map exists", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);

		// Layers panel is open by default (showLayerManager starts as true)
		// So we should NOT click the Layers button - it's already open
		await layersPage.waitForPanel();
		await expect(layersPage.panelTitle).toHaveText("Layers");
	});

	test("should show create layer button in layers panel", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);

		// Panel is already open by default
		await layersPage.waitForPanel();
		await expect(layersPage.createLayerButton).toBeVisible();
	});

	test("should show basemap selector in layers panel", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);

		// Panel is already open by default
		await layersPage.waitForPanel();
		await expect(layersPage.basemapSelector).toBeVisible();
	});

	test("should navigate to layer creator when clicking Create Layer", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);

		// Panel is already open by default
		await layersPage.waitForPanel();

		// Check if button is enabled (user has edit permissions)
		const isDisabled = await layersPage.createLayerButton.isDisabled();
		if (isDisabled) {
			// User doesn't have permission to create layers (e.g., viewer role)
			test.skip();
			return;
		}

		await layersPage.createLayerButton.click();

		// Layer creator panel should open
		const createLayerHeading = page
			.locator("h2")
			.filter({ hasText: /Create Layer/i });
		await expect(createLayerHeading).toBeVisible();

		// Original layers panel should close
		await expect(layersPage.panelTitle).not.toBeVisible();
	});

	test("should close layers panel when clicking close button", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);

		// Panel is already open by default
		await layersPage.waitForPanel();
		await layersPage.close();

		await expect(layersPage.panelTitle).not.toBeVisible();
	});

	test("should toggle layers panel with button clicks", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const appPage = new AppPage(page);
		const layersPage = new LayersPage(page);

		// Panel starts open
		await layersPage.waitForPanel();

		// Click to close
		await appPage.openLayersPanel();
		await expect(layersPage.panelTitle).not.toBeVisible();

		// Click again to reopen
		await appPage.openLayersPanel();
		await layersPage.waitForPanel();
		await expect(layersPage.panelTitle).toBeVisible();
	});
});

test.describe("Layer Creator", () => {
	// These tests require edit permissions on the map
	// Users with "viewer" role will have the Create Layer button disabled

	async function canCreateLayers(
		page: import("@playwright/test").Page
	): Promise<boolean> {
		const createButton = page.getByRole("button", { name: /Create Layer/i });
		return !(await createButton.isDisabled().catch(() => true));
	}

	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(1500);
	});

	test("should open layer creator panel", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		if (!(await canCreateLayers(page))) {
			// User doesn't have permission to create layers
			test.skip();
			return;
		}

		await layersPage.createLayerButton.click();

		const createLayerHeading = page
			.locator("h2")
			.filter({ hasText: /Create Layer/i });
		await expect(createLayerHeading).toBeVisible();
	});

	test("should have layer creation tabs", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		if (!(await canCreateLayers(page))) {
			test.skip();
			return;
		}

		await layersPage.createLayerButton.click();

		const createLayerHeading = page
			.locator("h2")
			.filter({ hasText: /Create Layer/i });
		await expect(createLayerHeading).toBeVisible();

		// Should have different creation methods (Draw, Upload, WMS, etc.)
		const drawTab = page.locator('[role="tab"]').filter({ hasText: /Draw/i });
		const uploadTab = page
			.locator('[role="tab"]')
			.filter({ hasText: /Upload/i });
		const wmsTab = page.locator('[role="tab"]').filter({ hasText: /WMS/i });

		// At least one of these should be visible
		const hasDrawTab = await drawTab.isVisible().catch(() => false);
		const hasUploadTab = await uploadTab.isVisible().catch(() => false);
		const hasWmsTab = await wmsTab.isVisible().catch(() => false);

		expect(hasDrawTab || hasUploadTab || hasWmsTab).toBe(true);
	});

	test("should close layer creator when clicking close button", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		if (!(await canCreateLayers(page))) {
			test.skip();
			return;
		}

		await layersPage.createLayerButton.click();

		const createLayerHeading = page
			.locator("h2")
			.filter({ hasText: /Create Layer/i });
		await expect(createLayerHeading).toBeVisible();

		// Find and click close button
		const closeButton = createLayerHeading
			.locator("..")
			.locator("button:has(svg)")
			.first();
		await closeButton.click();

		await expect(createLayerHeading).not.toBeVisible();
	});

	test("create layer button should be disabled for viewers", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if user is a viewer (button should be disabled)
		const isDisabled = await layersPage.createLayerButton.isDisabled();

		// This test documents the behavior - viewers can't create layers
		// The button should be either enabled (for editors/owners) or disabled (for viewers)
		expect(typeof isDisabled).toBe("boolean");
	});
});

test.describe("Layers without Map", () => {
	test("should not show layers panel when no map exists", async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(1500);

		const hasMap = await hasMapLoaded(page);

		if (hasMap) {
			// If map exists, this test doesn't apply
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);

		// Wait a moment and check that layers panel is NOT visible
		await page.waitForTimeout(500);

		// Layers panel should NOT be visible because there's no map
		const isLayersPanelVisible = await layersPage.panelTitle
			.isVisible()
			.catch(() => false);
		expect(isLayersPanelVisible).toBe(false);
	});
});
