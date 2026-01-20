import { expect, test } from "@playwright/test";

test.describe("Admin Panel GeoJSON Preview", () => {
	test("should update preview in real-time when changing color and line width", async ({
		page,
	}) => {
		await page.goto("http://localhost:3001");

		// Wait for map to load
		await page.waitForSelector(".maplibregl-canvas", { timeout: 10000 });

		// Open admin panel
		await page.click('button:has-text("Admin")');
		await page.waitForSelector('text="Admin Panel"', { timeout: 5000 });
		console.log("✓ Admin panel opened");

		// Take screenshot for debugging
		await page.screenshot({ path: "/tmp/before-layers-click.png" });

		// The Layers tab should be next to "WMS Servers" - find buttons that contain exactly "Layers"
		// Use a more specific selector - find the tabs div and click Layers
		const adminPanel = page.locator('text="Admin Panel"').locator("..");
		const layersTabButton = adminPanel.locator(
			'button:has-text("Layers"):not(:has-text("Browse Layers"))',
		);
		await layersTabButton.click({ timeout: 10000 });
		await page.waitForTimeout(1000);
		console.log("✓ Clicked Layers tab");

		// Take screenshot after clicking
		await page.screenshot({ path: "/tmp/after-layers-click.png" });

		// GeoJSON button should now be visible
		await page.waitForSelector('button:has-text("GeoJSON")', {
			timeout: 5000,
		});
		console.log("✓ GeoJSON button visible");

		// Click the GeoJSON button
		const geojsonButtons = await page.locator('button:has-text("GeoJSON")').all();
		console.log(`Found ${geojsonButtons.length} GeoJSON buttons`);
		// Click the first one (should be in the admin panel)
		await geojsonButtons[0].click();
		await page.waitForTimeout(500);
		console.log("✓ Clicked GeoJSON button");

		// Paste GeoJSON
		const testGeoJSON = {
			type: "FeatureCollection",
			features: [
				{
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [10.0, 50.0],
					},
					properties: {
						name: "Test Point 1",
						color: "#ff0000",
					},
				},
				{
					type: "Feature",
					geometry: {
						type: "Point",
						coordinates: [11.0, 51.0],
					},
					properties: {
						name: "Test Point 2",
						fill: "#0000ff",
					},
				},
			],
		};

		// Find the textarea and paste
		const textarea = page.locator("textarea").first();
		await textarea.fill(JSON.stringify(testGeoJSON, null, 2));

		// Wait for validation
		await page.waitForSelector('text="Valid GeoJSON"', { timeout: 3000 });
		console.log("✓ GeoJSON validated");

		// Click Preview on Map
		await page.click('button:has-text("Preview on Map")');
		await page.waitForTimeout(500);

		// Check that preview layer was added to the map
		const mapCanvas = page.locator(".maplibregl-canvas");
		await expect(mapCanvas).toBeVisible();
		console.log("✓ Preview clicked");

		// Get initial color value
		const colorInput = page.locator('input[type="color"]');
		const initialColor = await colorInput.inputValue();
		console.log(`Initial color: ${initialColor}`);

		// Check if there are map layers with __preview__ id
		const hasPreviewLayer = await page.evaluate(() => {
			const mapElement = document.querySelector(".maplibregl-map") as any;
			if (!mapElement) return false;
			const map = mapElement._map;
			if (!map) return false;

			const layers = map.getStyle()?.layers || [];
			const previewLayers = layers.filter((l: any) =>
				l.id.includes("__preview__"),
			);
			console.log("Preview layers found:", previewLayers.length);
			return previewLayers.length > 0;
		});

		console.log(`Has preview layers: ${hasPreviewLayer}`);
		expect(hasPreviewLayer).toBe(true);

		// Change the color to green
		await colorInput.fill("#00ff00");
		await page.waitForTimeout(300);

		const newColor = await colorInput.inputValue();
		console.log(`New color: ${newColor}`);
		expect(newColor).toBe("#00ff00");

		// Check if the map layer color was updated
		const layerColorUpdated = await page.evaluate(() => {
			const mapElement = document.querySelector(".maplibregl-map") as any;
			if (!mapElement) return false;
			const map = mapElement._map;
			if (!map) return false;

			// Check the fill layer
			const fillLayer = map.getLayer("__preview__-fill");
			if (!fillLayer) return false;

			const paintProps = map.getPaintProperty("__preview__-fill", "fill-color");
			console.log("Fill color paint property:", paintProps);
			return paintProps === "#00ff00";
		});

		console.log(`Layer color updated: ${layerColorUpdated}`);
		expect(layerColorUpdated).toBe(true);

		// Change line width
		const lineWidthSlider = page.locator('input[type="range"]').first();
		await lineWidthSlider.fill("5");
		await page.waitForTimeout(300);

		// Check if line width was updated
		const lineWidthUpdated = await page.evaluate(() => {
			const mapElement = document.querySelector(".maplibregl-map") as any;
			if (!mapElement) return false;
			const map = mapElement._map;
			if (!map) return false;

			const lineLayer = map.getLayer("__preview__-line");
			if (!lineLayer) return false;

			const lineWidth = map.getPaintProperty("__preview__-line", "line-width");
			console.log("Line width paint property:", lineWidth);
			return lineWidth === 5;
		});

		console.log(`Line width updated: ${lineWidthUpdated}`);
		expect(lineWidthUpdated).toBe(true);

		console.log("✓ All tests passed!");
	});
});
