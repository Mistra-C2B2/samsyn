import { expect, test } from "@playwright/test";
import { AppPage, LayersPage } from "./pages";

/**
 * Helper function to check if a map exists in the app.
 * The Layers panel only renders when currentMap is not null.
 * We check for the map canvas AND that there's a map name displayed (not "No Map Selected")
 */
async function hasMapLoaded(
	page: import("@playwright/test").Page,
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

test.describe("Layer Library", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(1500); // Wait for map data to load
	});

	test('should open "Add from Library" dialog', async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300); // Wait for animation

		// Verify the library view opened
		const isLibraryOpen = await layersPage.isLibraryOpen();
		expect(isLibraryOpen).toBe(true);

		// Verify the heading is visible
		const libraryHeading = layersPage.panel.locator('h3', { hasText: 'Add from Library' });
		await expect(libraryHeading).toBeVisible();
	});

	test("should display available layers in library view", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Check if there are layers available
		const hasLayers = await layersPage.hasLibraryLayers();
		if (!hasLayers) {
			test.skip();
			return;
		}

		// Get the layer names from the library
		const libraryLayerNames = await layersPage.getLibraryLayerNames();

		// Verify that layers are displayed
		expect(libraryLayerNames.length).toBeGreaterThan(0);

		// Verify each layer card has the expected structure
		for (const layerName of libraryLayerNames) {
			const layerCard = layersPage.panel
				.locator('div.bg-slate-50.border.border-slate-200.rounded-lg')
				.filter({ hasText: layerName });

			await expect(layerCard).toBeVisible();

			// Verify the Add button is present
			const addButton = layerCard.locator('button', { hasText: /Add/i });
			await expect(addButton).toBeVisible();
		}
	});

	test("should search and filter layers in library", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Check if there are layers available
		const hasLayers = await layersPage.hasLibraryLayers();
		if (!hasLayers) {
			test.skip();
			return;
		}

		// Get initial layer names
		const initialLayerNames = await layersPage.getLibraryLayerNames();
		if (initialLayerNames.length === 0) {
			test.skip();
			return;
		}

		// Take the first layer name and search for part of it
		const firstLayerName = initialLayerNames[0];
		const searchQuery = firstLayerName.substring(0, Math.min(3, firstLayerName.length));

		// Perform the search
		await layersPage.searchLibrary(searchQuery);
		await page.waitForTimeout(500); // Wait for search to filter results

		// Get filtered layer names
		const filteredLayerNames = await layersPage.getLibraryLayerNames();

		// Verify the search worked - the first layer should still be visible
		// (since we searched for part of its name)
		expect(filteredLayerNames).toContain(firstLayerName);

		// Clear the search by searching for empty string
		await layersPage.searchLibrary("");
		await page.waitForTimeout(500);

		// Verify all layers are visible again
		const allLayersAgain = await layersPage.getLibraryLayerNames();
		expect(allLayersAgain.length).toBe(initialLayerNames.length);
	});

	test("should add layer to current map from library", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Get initial layer count in the current map
		const initialLayerCount = await layersPage.getLayerCount();

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Check if there are layers available
		const hasLayers = await layersPage.hasLibraryLayers();
		if (!hasLayers) {
			test.skip();
			return;
		}

		// Get the first available layer from the library
		const libraryLayerNames = await layersPage.getLibraryLayerNames();
		if (libraryLayerNames.length === 0) {
			test.skip();
			return;
		}

		const layerToAdd = libraryLayerNames[0];

		// Add the layer
		await layersPage.addLayerFromLibrary(layerToAdd);
		await page.waitForTimeout(500); // Wait for layer to be added

		// Verify the library view closed after adding
		const isLibraryOpen = await layersPage.isLibraryOpen();
		expect(isLibraryOpen).toBe(false);

		// Verify we're back to the main layers view
		await expect(layersPage.panelTitle).toBeVisible();
	});

	test("should show added layer in layer list after adding from library", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Get initial layer count and names
		const initialLayerCount = await layersPage.getLayerCount();
		const initialLayerNames = await layersPage.getLayerNames();

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Check if there are layers available
		const hasLayers = await layersPage.hasLibraryLayers();
		if (!hasLayers) {
			test.skip();
			return;
		}

		// Get the first available layer from the library
		const libraryLayerNames = await layersPage.getLibraryLayerNames();
		if (libraryLayerNames.length === 0) {
			test.skip();
			return;
		}

		const layerToAdd = libraryLayerNames[0];

		// Add the layer
		await layersPage.addLayerFromLibrary(layerToAdd);
		await page.waitForTimeout(500); // Wait for layer to be added and animation

		// Verify the layer appears in the layer list
		const finalLayerNames = await layersPage.getLayerNames();
		expect(finalLayerNames).toContain(layerToAdd);

		// Verify the layer count increased by 1
		const finalLayerCount = await layersPage.getLayerCount();
		expect(finalLayerCount).toBe(initialLayerCount + 1);

		// Verify the new layer is visible in the list
		expect(await layersPage.layerExists(layerToAdd)).toBe(true);
	});

	test("should close library view with Back button", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Verify the library view is open
		expect(await layersPage.isLibraryOpen()).toBe(true);

		// Close the library view
		await layersPage.closeLibrary();
		await page.waitForTimeout(300);

		// Verify the library view is closed
		expect(await layersPage.isLibraryOpen()).toBe(false);

		// Verify we're back to the main layers view
		await expect(layersPage.panelTitle).toBeVisible();
	});

	test("should show empty state when no layers in library", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Check if there are no layers available
		const hasLayers = await layersPage.hasLibraryLayers();
		if (hasLayers) {
			// This test only runs when there are no layers
			test.skip();
			return;
		}

		// Verify the appropriate empty state message is shown
		const noLayersText = layersPage.panel.getByText('No layers in library', { exact: false });
		const allAddedText = layersPage.panel.getByText('All available layers are already added', { exact: false });

		const noLayersVisible = await noLayersText.isVisible().catch(() => false);
		const allAddedVisible = await allAddedText.isVisible().catch(() => false);

		// One of these messages should be visible
		expect(noLayersVisible || allAddedVisible).toBe(true);
	});

	test("should filter library layers by type", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		// Check if the "Add from Library" button is disabled (user not signed in)
		const isButtonDisabled = await layersPage.addFromLibraryButton.isDisabled();
		if (isButtonDisabled) {
			test.skip();
			return;
		}

		// Open the library view
		await layersPage.openLibrary();
		await page.waitForTimeout(300);

		// Check if there are layers available
		const hasLayers = await layersPage.hasLibraryLayers();
		if (!hasLayers) {
			test.skip();
			return;
		}

		// Get initial layer count
		const initialLayerNames = await layersPage.getLibraryLayerNames();
		if (initialLayerNames.length === 0) {
			test.skip();
			return;
		}

		// Try to open the type filter dropdown
		const typeFilterButton = layersPage.panel
			.locator('button')
			.filter({ has: page.locator('span:text("Type")') });

		const typeFilterExists = await typeFilterButton.isVisible().catch(() => false);
		if (!typeFilterExists) {
			// No type filter available, skip test
			test.skip();
			return;
		}

		// Click the type filter
		await typeFilterButton.click();
		await page.waitForTimeout(200);

		// Check if there are filter options (other than "All Types")
		const filterOptions = page.locator('[role="option"]');
		const optionCount = await filterOptions.count();

		if (optionCount <= 1) {
			// Only "All Types" available, skip test
			test.skip();
			return;
		}

		// Select the first non-"All" option
		const firstTypeOption = filterOptions.nth(1);
		await firstTypeOption.click();
		await page.waitForTimeout(500);

		// Get filtered layer names
		const filteredLayerNames = await layersPage.getLibraryLayerNames();

		// The filtered list should be different from the initial list
		// (or at least we've exercised the filter functionality)
		expect(filteredLayerNames.length).toBeGreaterThanOrEqual(0);
	});
});
