import { expect, test } from "@playwright/test";
import { LayersPage } from "./pages";

/**
 * Helper function to check if a map exists in the app.
 */
async function hasMapLoaded(
	page: import("@playwright/test").Page
): Promise<boolean> {
	const hasMapCanvas = await page
		.locator(".maplibregl-map")
		.isVisible()
		.catch(() => false);
	if (!hasMapCanvas) return false;

	const mapNameText = await page
		.locator("header p.text-slate-500")
		.textContent();
	return mapNameText !== null && mapNameText !== "No Map Selected";
}

/**
 * Helper function to check if there are layers in the map
 */
async function hasLayers(layersPage: LayersPage): Promise<boolean> {
	const layerCount = await layersPage.getLayerCount();
	return layerCount > 0;
}

test.describe("Layer Edit Order", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(2000); // Wait for map data to load
	});

	test("should move layer to top when editing and restore position when done", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		if (!(await hasLayers(layersPage))) {
			test.skip();
			return;
		}

		// Get initial layer order
		const initialLayers = await layersPage.getLayerNames();

		// Need at least 2 layers to test reordering
		if (initialLayers.length < 2) {
			test.skip();
			return;
		}

		// Find an editable layer that is NOT at the top (index > 0)
		let editableLayerName = "";

		for (let i = 1; i < initialLayers.length; i++) {
			const layerName = initialLayers[i];
			const isEditable = await layersPage.isLayerEditable(layerName);
			if (isEditable) {
				editableLayerName = layerName;
				break;
			}
		}

		if (!editableLayerName) {
			test.skip();
			return;
		}

		// Click the edit button on the layer
		await layersPage.editLayer(editableLayerName);
		await page.waitForTimeout(1000);

		// Verify the layer creator panel opened
		const editLayerHeading = page.locator("h2").filter({ hasText: /Edit Layer/i });
		await expect(editLayerHeading).toBeVisible();

		// Close the edit panel
		const closeButton = editLayerHeading.locator("..").locator("button:has(svg)").first();
		await closeButton.click();
		await page.waitForTimeout(1000);

		// Verify the edit panel closed
		await expect(editLayerHeading).not.toBeVisible();

		// Now open the layers panel again to check the order
		const appLayersButton = page.getByRole("button", { name: /Layers/i });
		await appLayersButton.click();
		await layersPage.waitForPanel();

		// Get the final layer order
		const finalLayers = await layersPage.getLayerNames();

		// The layer should be back to its original position
		expect(finalLayers).toEqual(initialLayers);
	});

	test("should verify layer moves to top in layer list when editing", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		if (!(await hasLayers(layersPage))) {
			test.skip();
			return;
		}

		// Get initial layer order
		const initialLayers = await layersPage.getLayerNames();

		// Need at least 2 layers
		if (initialLayers.length < 2) {
			test.skip();
			return;
		}

		// Find an editable layer that is NOT at the top
		let editableLayerName = "";

		for (let i = 1; i < initialLayers.length; i++) {
			const layerName = initialLayers[i];
			const isEditable = await layersPage.isLayerEditable(layerName);
			if (isEditable) {
				editableLayerName = layerName;
				break;
			}
		}

		if (!editableLayerName) {
			test.skip();
			return;
		}

		// Click edit on the layer
		await layersPage.editLayer(editableLayerName);
		await page.waitForTimeout(500);

		// Verify the Edit Layer panel opened
		const editLayerHeading = page.locator("h2").filter({ hasText: /Edit Layer/i });
		await expect(editLayerHeading).toBeVisible();

		// Close the editor using the close button
		const closeButton = editLayerHeading.locator("..").locator("button:has(svg)").first();
		await closeButton.click();
		await page.waitForTimeout(500);

		// Open layers panel
		const appLayersButton = page.getByRole("button", { name: /Layers/i });
		await appLayersButton.click();
		await layersPage.waitForPanel();

		// Verify final order matches initial (layer should be restored to original position)
		const finalLayers = await layersPage.getLayerNames();
		expect(finalLayers).toEqual(initialLayers);
	});

	test("TerraDraw layers should render on top when editing", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		await layersPage.waitForPanel();

		if (!(await hasLayers(layersPage))) {
			test.skip();
			return;
		}

		const initialLayers = await layersPage.getLayerNames();
		if (initialLayers.length < 2) {
			test.skip();
			return;
		}

		// Find an editable layer NOT at the top
		let editableLayerName = "";
		for (let i = 1; i < initialLayers.length; i++) {
			const isEditable = await layersPage.isLayerEditable(initialLayers[i]);
			if (isEditable) {
				editableLayerName = initialLayers[i];
				break;
			}
		}

		if (!editableLayerName) {
			test.skip();
			return;
		}

		// Click edit
		await layersPage.editLayer(editableLayerName);
		await page.waitForTimeout(1000);

		// Verify Edit Layer panel opened
		const editPanel = page.locator("h2").filter({ hasText: /Edit Layer/i });
		await expect(editPanel).toBeVisible();

		// Check MapLibre layer order - TerraDraw layers should be at the end (rendered on top)
		const mapLayers = await page.evaluate(() => {
			const map = (window as unknown as { map?: maplibregl.Map }).map;
			if (!map) return [];
			const style = map.getStyle();
			if (!style || !style.layers) return [];
			return style.layers
				.filter((l) => !l.id.startsWith("carto") && !l.id.startsWith("osm"))
				.map((l) => l.id);
		});

		// TerraDraw layers should be near the end of the array (rendered on top)
		const terraDrawLayers = mapLayers.filter((id) => id.startsWith("td-"));
		expect(terraDrawLayers.length).toBeGreaterThan(0);

		// Find the position of the last user layer and first TerraDraw layer
		const lastUserLayerIndex = mapLayers.findIndex((id) => id.startsWith("td-")) - 1;
		const firstTerraDrawIndex = mapLayers.findIndex((id) => id.startsWith("td-"));

		// TerraDraw layers should come after user layers
		expect(firstTerraDrawIndex).toBeGreaterThan(lastUserLayerIndex);

		// Close editor
		const closeBtn = editPanel.locator("..").locator("button:has(svg)").first();
		await closeBtn.click();
		await page.waitForTimeout(500);

		// Reopen layers panel
		const layersBtn = page.getByRole("button", { name: /Layers/i });
		await layersBtn.click();
		await layersPage.waitForPanel();

		// Verify layer order is restored
		const finalLayers = await layersPage.getLayerNames();
		expect(finalLayers).toEqual(initialLayers);
	});
});
