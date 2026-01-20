import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the Layer Manager panel.
 * Provides methods to interact with layers - visibility, opacity, reordering.
 */
export class LayersPage {
	readonly page: Page;

	// Panel container
	readonly panel: Locator;
	readonly panelTitle: Locator;
	readonly closeButton: Locator;

	// Layer list
	readonly layerList: Locator;
	readonly layerItems: Locator;

	// Actions
	readonly createLayerButton: Locator;
	readonly addFromLibraryButton: Locator;

	// Basemap selector
	readonly basemapSelector: Locator;

	constructor(page: Page) {
		this.page = page;

		// The LayerManager panel - the side panel container
		// Using more specific class combination from the component
		this.panel = page.locator(
			"div.absolute.right-0.top-0.bottom-0.w-80.bg-white"
		);

		// Look for "Layers" text within h2 element inside the panel
		this.panelTitle = this.panel.locator("h2", { hasText: "Layers" });
		this.closeButton = this.panel
			.locator('div.flex.items-center.justify-between')
			.first()
			.locator("button");

		// Layer items - each layer is in a draggable container
		this.layerList = this.panel.locator('[class*="space-y"]');
		this.layerItems = this.panel.locator('[data-layer-id], [draggable="true"]');

		// Buttons
		this.createLayerButton = page.getByRole("button", {
			name: /Create Layer/i,
		});
		this.addFromLibraryButton = page.getByRole("button", {
			name: /Add from Library/i,
		});

		// Basemap
		this.basemapSelector = page.locator("text=Basemap");
	}

	async isVisible(): Promise<boolean> {
		return this.panelTitle.isVisible();
	}

	async waitForPanel(timeout = 10000) {
		await expect(this.panelTitle).toBeVisible({ timeout });
	}

	async close() {
		await this.closeButton.click();
	}

	async getLayerCount(): Promise<number> {
		// Count only draggable layer items (current map layers, not library layers)
		const items = this.panel.locator('[draggable="true"]');
		return items.count();
	}

	async getLayerNames(): Promise<string[]> {
		const names: string[] = [];
		// Select h3 elements within draggable layer containers
		const layerHeadings = this.panel.locator(
			'[draggable="true"] h3.text-slate-900'
		);
		const count = await layerHeadings.count();
		for (let i = 0; i < count; i++) {
			const text = await layerHeadings.nth(i).textContent();
			if (text) names.push(text.trim());
		}
		return names;
	}

	async toggleLayerVisibility(layerName: string) {
		// Find the layer container by its h3 heading
		const layerContainer = this.panel
			.locator(`[draggable="true"]:has(h3.text-slate-900:text-is("${layerName}"))`);
		const eyeButton = layerContainer.locator('button:has(svg[class*="eye"])');
		await eyeButton.click();
	}

	async setLayerOpacity(layerName: string, opacity: number) {
		// Find the layer container by its h3 heading
		const layerContainer = this.panel
			.locator(`[draggable="true"]:has(h3.text-slate-900:text-is("${layerName}"))`);

		// Find the slider track element specifically
		const sliderTrack = layerContainer.locator('[data-slot="slider-track"]');

		// Get the bounding box of the slider track
		const boundingBox = await sliderTrack.boundingBox();
		if (!boundingBox) {
			throw new Error(`Could not find slider track for layer: ${layerName}`);
		}

		// Calculate the position to click based on the desired opacity percentage
		// The slider goes from 0 to 100, so we need to click at the appropriate position
		const targetValue = Math.round(opacity * 100);

		// Clamp the click position to stay within the slider bounds
		// Add small padding (2px) to avoid edge issues
		const padding = 2;
		const usableWidth = boundingBox.width - (padding * 2);
		const clickX = boundingBox.x + padding + (usableWidth * targetValue) / 100;
		const clickY = boundingBox.y + boundingBox.height / 2;

		// Click at the calculated position to set the slider value
		await this.page.mouse.click(clickX, clickY);

		// Wait a moment for the slider to update
		await this.page.waitForTimeout(100);
	}

	async getLayerOpacity(layerName: string): Promise<number> {
		// Find the layer container by its h3 heading
		const layerContainer = this.panel
			.locator(`[draggable="true"]:has(h3.text-slate-900:text-is("${layerName}"))`);
		const opacityText = await layerContainer
			.locator('.text-slate-500:has-text("%")')
			.textContent();
		return Number.parseInt(opacityText?.replace("%", "") || "100", 10);
	}

	async openLayerMenu(layerName: string) {
		// Find the layer container by its h3 heading
		const layerContainer = this.panel
			.locator(`[draggable="true"]:has(h3.text-slate-900:text-is("${layerName}"))`);
		const menuButton = layerContainer.locator('button:has(svg[class*="more"])');
		await menuButton.click();
	}

	async removeLayer(layerName: string) {
		await this.openLayerMenu(layerName);
		await this.page.getByRole("menuitem", { name: /Remove/i }).click();
	}

	async clickCreateLayer() {
		await this.createLayerButton.click();
	}

	async isLayerVisible(layerName: string): Promise<boolean> {
		// Find the layer container by its h3 heading
		const layerContainer = this.panel
			.locator(`[draggable="true"]:has(h3.text-slate-900:text-is("${layerName}"))`);
		const eyeIcon = layerContainer.locator('svg[class*="eye"]');
		const className = await eyeIcon.getAttribute("class");
		return !className?.includes("eye-off");
	}

	async dragLayerToPosition(layerName: string, targetLayerName: string) {
		// Find source and target by looking for draggable divs that contain the layer name as h3 text
		const sourceLayer = this.panel
			.locator('[role="application"][draggable="true"]')
			.filter({ has: this.page.locator(`h3:text-is("${layerName}")`) });
		const targetLayer = this.panel
			.locator('[role="application"][draggable="true"]')
			.filter({ has: this.page.locator(`h3:text-is("${targetLayerName}")`) });

		// Use Playwright's dragTo method which properly handles HTML5 drag and drop
		await sourceLayer.dragTo(targetLayer);
	}

	async getLayerAtPosition(index: number): Promise<string | null> {
		const layers = await this.getLayerNames();
		return layers[index] || null;
	}

	async removeLayerByTrashButton(layerName: string) {
		// Find the draggable layer card containing the layer name
		const layerCard = this.panel
			.locator('[role="application"][draggable="true"]')
			.filter({ hasText: layerName });

		// Find the trash button (has Trash2 icon)
		const trashButton = layerCard.locator("button:has(svg.lucide-trash-2)");

		// Ensure the button exists
		if ((await trashButton.count()) === 0) {
			throw new Error(`Could not find trash button for layer: ${layerName}`);
		}

		// Click the button - this will trigger the onRemoveLayer handler
		await trashButton.click();
	}

	async layerExists(layerName: string): Promise<boolean> {
		const names = await this.getLayerNames();
		return names.includes(layerName);
	}

	async openLayerInfo(layerName: string) {
		const layerCard = this.panel.locator('[draggable="true"]').filter({ hasText: layerName });
		const infoButton = layerCard.locator('button').filter({ has: this.page.locator('svg[class*="lucide-info"]') });
		await infoButton.click();
	}

	async editLayer(layerName: string) {
		const layerCard = this.panel.locator('[draggable="true"]').filter({ hasText: layerName });
		const editButton = layerCard.locator('button').filter({ has: this.page.locator('svg[class*="lucide-pencil"]') });
		await editButton.click();
	}

	async isLayerEditable(layerName: string): Promise<boolean> {
		const layerCard = this.panel.locator('[draggable="true"]').filter({ hasText: layerName });
		const editButton = layerCard.locator('button').filter({ has: this.page.locator('svg[class*="lucide-pencil"]') });
		return editButton.isVisible();
	}

	/**
	 * Opens the "Add from Library" view
	 */
	async openLibrary() {
		await this.addFromLibraryButton.click();
	}

	/**
	 * Checks if the library view is currently open
	 */
	async isLibraryOpen(): Promise<boolean> {
		const libraryHeading = this.panel.locator('h3', { hasText: 'Add from Library' });
		return libraryHeading.isVisible();
	}

	/**
	 * Closes the library view by clicking the Back button
	 */
	async closeLibrary() {
		const backButton = this.panel.getByRole('button', { name: /Back/i });
		await backButton.click();
	}

	/**
	 * Enters a search query in the library search box
	 */
	async searchLibrary(query: string) {
		const searchInput = this.panel.locator('input[placeholder="Search layers..."]');
		await searchInput.clear();
		await searchInput.fill(query);
	}

	/**
	 * Gets the names of all layers displayed in the library view
	 */
	async getLibraryLayerNames(): Promise<string[]> {
		const names: string[] = [];
		// Library layers are in cards with h3 elements, not draggable
		const layerHeadings = this.panel.locator(
			'div.bg-slate-50.border.border-slate-200.rounded-lg h3.text-slate-900'
		);
		const count = await layerHeadings.count();
		for (let i = 0; i < count; i++) {
			const text = await layerHeadings.nth(i).textContent();
			if (text) names.push(text.trim());
		}
		return names;
	}

	/**
	 * Adds a layer from the library by clicking its Add button
	 */
	async addLayerFromLibrary(layerName: string) {
		// Find the library layer card containing the layer name
		const layerCard = this.panel
			.locator('div.bg-slate-50.border.border-slate-200.rounded-lg')
			.filter({ hasText: layerName });

		// Find the Add button within that card
		const addButton = layerCard.locator('button', { hasText: /Add/i });
		await addButton.click();
	}

	/**
	 * Checks if the library has any layers available
	 */
	async hasLibraryLayers(): Promise<boolean> {
		const noLayersText = this.panel.getByText('No layers in library', { exact: false });
		const allAddedText = this.panel.getByText('All available layers are already added', { exact: false });

		const hasNoLayers = await noLayersText.isVisible().catch(() => false);
		const hasAllAdded = await allAddedText.isVisible().catch(() => false);

		return !hasNoLayers && !hasAllAdded;
	}
}
