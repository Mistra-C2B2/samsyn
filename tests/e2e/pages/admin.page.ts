import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the Admin Panel.
 * Provides methods to interact with the layer library management.
 */
export class AdminPage {
	readonly page: Page;

	// Panel elements
	readonly panel: Locator;
	readonly panelTitle: Locator;
	readonly addLayerButton: Locator;
	readonly backButton: Locator;

	// Form elements
	readonly layerSourceSelect: Locator;
	readonly wmsUrlInput: Locator;
	readonly wmsDiscoverButton: Locator;
	readonly wmsLayerSelect: Locator;
	readonly wmsLayerNameInput: Locator;
	readonly layerNameInput: Locator;
	readonly descriptionInput: Locator;
	readonly submitButton: Locator;

	// Error/status elements
	readonly wmsError: Locator;
	readonly loadingSpinner: Locator;

	constructor(page: Page) {
		this.page = page;

		// Panel
		this.panel = page.locator(
			"div.absolute.left-0.top-0.bottom-0.w-96.bg-white"
		);
		this.panelTitle = page.locator("h2:has-text('Admin Panel')");
		this.addLayerButton = page.getByRole("button", {
			name: /Add Layer to Library/i,
		});
		this.backButton = page.getByRole("button", { name: /Back to Library/i });

		// Form
		this.layerSourceSelect = page.locator("#layerSource");
		this.wmsUrlInput = page.locator("#wmsUrl");
		this.wmsDiscoverButton = page.locator(
			'button:has(svg.lucide-search), button:has(svg.lucide-loader-2)'
		);
		this.wmsLayerSelect = page.locator(
			'[data-slot="select-trigger"]:near(label:has-text("Available Layers"))'
		);
		this.wmsLayerNameInput = page.locator("#wmsLayerName");
		this.layerNameInput = page.locator("#name");
		this.descriptionInput = page.locator("#description");
		this.submitButton = page.getByRole("button", { name: /Add to Library/i });

		// Status
		this.wmsError = page.locator(".text-red-600.bg-red-50");
		this.loadingSpinner = page.locator("svg.animate-spin");
	}

	async waitForPanel(timeout = 10000) {
		await expect(this.panelTitle).toBeVisible({ timeout });
	}

	async clickAddLayer() {
		await this.addLayerButton.click();
	}

	async selectLayerSource(source: "wms" | "geotiff" | "vector") {
		await this.layerSourceSelect.click();
		const optionText =
			source === "wms"
				? "WMS (Web Map Service)"
				: source === "geotiff"
					? "GeoTIFF / COG"
					: "Vector (GeoJSON)";
		await this.page.locator(`[role="option"]:has-text("${optionText}")`).click();
	}

	async enterWmsUrl(url: string) {
		await this.wmsUrlInput.fill(url);
	}

	async clickDiscoverLayers() {
		// Find the search button next to the URL input
		const searchButton = this.page.locator('button:has(svg.lucide-search)');
		await searchButton.click();
	}

	async waitForDiscoveryComplete(timeout = 15000) {
		// Wait for loading spinner to disappear
		await expect(this.loadingSpinner).not.toBeVisible({ timeout });
	}

	async selectWmsLayerFromDropdown(layerName: string) {
		// Click the Available Layers dropdown
		const dropdown = this.page.locator(
			'button[role="combobox"]:near(label:has-text("Available Layers"))'
		);
		await dropdown.click();
		// Select the layer
		await this.page
			.locator(`[role="option"]:has-text("${layerName}")`)
			.click();
	}

	async enterWmsLayerName(layerName: string) {
		await this.wmsLayerNameInput.fill(layerName);
	}

	async enterLayerName(name: string) {
		await this.layerNameInput.fill(name);
	}

	async enterDescription(description: string) {
		await this.descriptionInput.fill(description);
	}

	async submitLayer() {
		await this.submitButton.click();
	}

	async createWmsLayerManual(
		wmsUrl: string,
		wmsLayerName: string,
		displayName: string
	) {
		await this.clickAddLayer();
		await this.selectLayerSource("wms");
		await this.enterWmsUrl(wmsUrl);
		await this.enterWmsLayerName(wmsLayerName);
		await this.enterLayerName(displayName);
		await this.submitLayer();
	}

	async hasWmsError(): Promise<boolean> {
		return this.wmsError.isVisible();
	}

	async getWmsErrorText(): Promise<string> {
		return (await this.wmsError.textContent()) || "";
	}

	async getDiscoveredLayerCount(): Promise<number> {
		const label = this.page.locator(
			'label:has-text("Available Layers")'
		);
		const text = await label.textContent();
		const match = text?.match(/\((\d+)\)/);
		return match ? parseInt(match[1], 10) : 0;
	}

	async isLayerInLibrary(layerName: string): Promise<boolean> {
		const layerCard = this.page.locator(
			`.bg-slate-50.border.rounded-lg:has-text("${layerName}")`
		);
		return layerCard.isVisible();
	}
}
