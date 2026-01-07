import { expect, test } from "@playwright/test";
import { AppPage, LayersPage } from "./pages";

/**
 * Test suite for verifying layers persist when basemap is changed.
 * This addresses the bug where layers would disappear after changing basemaps.
 */
test.describe("Basemap Change - Layer Persistence", () => {
	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(2000); // Wait for map and layers to load
	});

	test("layers should persist after changing basemap", async ({ page }) => {
		const appPage = new AppPage(page);
		const layersPage = new LayersPage(page);

		// Capture console logs
		const consoleLogs: string[] = [];
		page.on('console', msg => {
			if (msg.text().includes('[LayerEffect]') || msg.text().includes('[BasemapEffect]')) {
				consoleLogs.push(msg.text());
			}
		});

		// Check if map is loaded
		const hasMap = await appPage.mapContainer.isVisible().catch(() => false);
		if (!hasMap) {
			test.skip();
			return;
		}

		// Wait for map to be fully loaded
		await appPage.waitForMapLoad();
		await layersPage.waitForPanel();

		// Get layer sources BEFORE basemap change
		const stateBeforeChange = await page.evaluate(() => {
			const map = (window as unknown as { map?: {
				getStyle: () => { sources: Record<string, unknown>; layers: Array<{ id: string; source?: string }> };
				isStyleLoaded: () => boolean;
			} }).map;
			if (!map) return null;
			const style = map.getStyle();
			return {
				isStyleLoaded: map.isStyleLoaded(),
				sources: Object.keys(style.sources || {}),
				layers: (style.layers || []).map(l => l.id)
			};
		});

		console.log("=== BEFORE BASEMAP CHANGE ===");
		console.log("Sources:", stateBeforeChange?.sources);
		console.log("Layers:", stateBeforeChange?.layers);

		// Get layer sources (excluding basemap and TerraDraw sources)
		const nonBasemapSourcesBefore = (stateBeforeChange?.sources || []).filter(
			s => !["osm", "carto"].includes(s) && !s.startsWith("td-")
		);
		console.log("Non-basemap sources:", nonBasemapSourcesBefore);

		if (nonBasemapSourcesBefore.length === 0) {
			console.log("No non-basemap layers to test");
			test.skip();
			return;
		}

		// Find the basemap Select dropdown and change it
		const basemapTrigger = page.locator('#basemap, [id="basemap"]');
		await expect(basemapTrigger).toBeVisible();

		// Click to open the dropdown
		await basemapTrigger.click();
		await page.waitForTimeout(300);

		// Select a different option (Carto Dark or any other)
		const darkOption = page.locator('[role="option"]').filter({ hasText: /dark/i });
		const voyagerOption = page.locator('[role="option"]').filter({ hasText: /voyager/i });
		const lightOption = page.locator('[role="option"]').filter({ hasText: /light/i });

		let optionClicked = false;
		for (const option of [darkOption, voyagerOption, lightOption]) {
			if (await option.isVisible().catch(() => false)) {
				console.log("Clicking basemap option...");
				await option.click();
				optionClicked = true;
				break;
			}
		}

		if (!optionClicked) {
			// Just click the first non-selected option
			const options = page.locator('[role="option"]');
			const count = await options.count();
			console.log("Found", count, "options");
			if (count > 1) {
				await options.nth(1).click();
				optionClicked = true;
			}
		}

		if (!optionClicked) {
			console.log("Could not find basemap option to click");
			await page.screenshot({ path: 'test-results/basemap-debug.png', fullPage: true });
			test.fail();
			return;
		}

		// Wait for basemap to change and style to load
		await page.waitForTimeout(3000);

		// Get layer sources AFTER basemap change
		const stateAfterChange = await page.evaluate(() => {
			const map = (window as unknown as { map?: {
				getStyle: () => { sources: Record<string, unknown>; layers: Array<{ id: string; source?: string }> };
				isStyleLoaded: () => boolean;
			} }).map;
			if (!map) return null;
			const style = map.getStyle();
			return {
				isStyleLoaded: map.isStyleLoaded(),
				sources: Object.keys(style.sources || {}),
				layers: (style.layers || []).map(l => l.id)
			};
		});

		console.log("=== AFTER BASEMAP CHANGE ===");
		console.log("isStyleLoaded:", stateAfterChange?.isStyleLoaded);
		console.log("Sources:", stateAfterChange?.sources);
		console.log("Layers:", stateAfterChange?.layers);

		const nonBasemapSourcesAfter = (stateAfterChange?.sources || []).filter(
			s => !["osm", "carto"].includes(s) && !s.startsWith("td-")
		);
		console.log("Non-basemap sources after:", nonBasemapSourcesAfter);

		// Log console messages
		console.log("=== CONSOLE LOGS ===");
		consoleLogs.forEach(log => console.log(log));

		// ASSERTION: Non-basemap sources should still exist
		expect(nonBasemapSourcesAfter.length, "Layer sources should persist after basemap change").toBe(nonBasemapSourcesBefore.length);

		for (const sourceId of nonBasemapSourcesBefore) {
			expect(nonBasemapSourcesAfter, `Source ${sourceId} should still exist`).toContain(sourceId);
		}
	});

	test("debug - log initial map state", async ({ page }) => {
		const appPage = new AppPage(page);

		const hasMap = await appPage.mapContainer.isVisible().catch(() => false);
		if (!hasMap) {
			test.skip();
			return;
		}

		await appPage.waitForMapLoad();

		const mapState = await page.evaluate(() => {
			const map = (window as unknown as { map?: {
				getStyle: () => { sources: Record<string, unknown>; layers: Array<{ id: string; source?: string }> };
				isStyleLoaded: () => boolean;
			} }).map;

			if (!map) return { error: "No map found" };

			const style = map.getStyle();
			return {
				isStyleLoaded: map.isStyleLoaded(),
				sourceCount: Object.keys(style.sources || {}).length,
				sources: Object.keys(style.sources || {}),
				layerCount: (style.layers || []).length,
				layers: (style.layers || []).map(l => ({
					id: l.id,
					source: l.source
				}))
			};
		});

		console.log("=== MAP STATE DEBUG ===");
		console.log(JSON.stringify(mapState, null, 2));
	});
});
