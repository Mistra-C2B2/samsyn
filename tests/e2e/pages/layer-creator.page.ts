import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the Layer Creator panel.
 * Provides methods to interact with layer creation and editing - drawing, GeoJSON import, feature management.
 */
export class LayerCreatorPage {
	readonly page: Page;

	// Panel container
	readonly panel: Locator;
	readonly heading: Locator;
	readonly closeButton: Locator;

	// Layer properties
	readonly layerNameInput: Locator;
	readonly layerDescriptionInput: Locator;
	readonly layerColorInput: Locator;
	readonly layerColorTextInput: Locator;

	// Category selector
	readonly categorySelect: Locator;

	// Tabs
	readonly drawTab: Locator;
	readonly geojsonTab: Locator;

	// Draw Mode buttons - Basic shapes
	readonly addPointButton: Locator;
	readonly addLineButton: Locator;
	readonly addPolygonButton: Locator;
	// Draw Mode buttons - Additional shapes
	readonly rectangleButton: Locator;
	readonly circleButton: Locator;
	readonly freehandButton: Locator;
	// Draw Mode buttons - Interaction modes
	readonly selectModeButton: Locator;
	readonly deleteModeButton: Locator;
	readonly deleteSelectionButton: Locator;

	// Features
	readonly featureCards: Locator;
	readonly clearAllButton: Locator;

	// GeoJSON
	readonly geoJsonTextarea: Locator;
	readonly importGeoJsonButton: Locator;

	// Permissions
	readonly onlyMeButton: Locator;
	readonly everyoneButton: Locator;

	// Footer
	readonly createLayerButton: Locator;

	constructor(page: Page) {
		this.page = page;

		// The LayerCreator panel - using the specific class combination
		this.panel = page.locator(
			"div.absolute.right-0.top-0.bottom-0.w-96.bg-white"
		);

		// Header elements
		this.heading = this.panel.locator("h2");
		this.closeButton = this.panel
			.locator('div.flex.items-center.justify-between')
			.first()
			.locator("button");

		// Layer properties
		this.layerNameInput = this.panel.locator("input#layer-name");
		this.layerDescriptionInput = this.panel.locator("textarea#layer-description");
		this.layerColorInput = this.panel.locator('input#layer-color[type="color"]');
		this.layerColorTextInput = this.panel.locator(
			'input[type="text"][placeholder="#3b82f6"]'
		);

		// Category selector
		this.categorySelect = this.panel.locator('[role="combobox"]');

		// Tabs
		this.drawTab = this.panel.locator('button[role="tab"]', {
			hasText: "Draw on Map",
		});
		this.geojsonTab = this.panel.locator('button[role="tab"]:has(svg.lucide-code)');

		// Draw Mode buttons - Basic shapes (using label text)
		this.addPointButton = this.panel.locator(
			'button:has-text("Add Point")'
		);
		this.addLineButton = this.panel.locator(
			'button:has-text("Add Line")'
		);
		this.addPolygonButton = this.panel.locator(
			'button:has-text("Add Polygon")'
		);
		// Draw Mode buttons - Additional shapes
		this.rectangleButton = this.panel.locator(
			'button:has-text("Rectangle")'
		);
		this.circleButton = this.panel.locator(
			'button:has-text("Circle")'
		);
		this.freehandButton = this.panel.locator(
			'button:has-text("Freehand")'
		);
		// Draw Mode buttons - Interaction modes
		this.selectModeButton = this.panel.locator(
			'button:has-text("Select")'
		).filter({ has: page.locator('svg.lucide-mouse-pointer-2') });
		this.deleteModeButton = this.panel.locator(
			'button:has-text("Delete")'
		).filter({ has: page.locator('svg.lucide-trash-2') });
		this.deleteSelectionButton = this.panel.locator(
			'button:has-text("Delete Selected")'
		);

		// Features
		this.featureCards = this.panel.locator(
			"div.p-3.bg-slate-50.rounded-lg.border.border-slate-200.space-y-2"
		);
		this.clearAllButton = this.panel.locator('button:has-text("Clear All")');

		// GeoJSON
		this.geoJsonTextarea = this.panel.locator(
			'textarea.font-mono.text-xs'
		);
		this.importGeoJsonButton = this.panel.locator(
			'button:has-text("Import GeoJSON")'
		);

		// Permissions - using the text content to identify them
		this.onlyMeButton = this.panel.locator(
			'button:has-text("Only Me")'
		).filter({ has: page.locator('svg.lucide-lock') });
		this.everyoneButton = this.panel.locator(
			'button:has-text("Everyone")'
		).filter({ has: page.locator('svg.lucide-users') });

		// Footer button - matches either "Create Layer" or "Save Changes"
		this.createLayerButton = this.panel
			.locator("div.p-4.border-t.border-slate-200")
			.locator("button")
			.filter({ hasText: /(Create Layer|Save Changes)/ });
	}

	async isVisible(): Promise<boolean> {
		return this.heading.isVisible();
	}

	async waitForPanel(timeout = 10000) {
		await expect(this.heading).toBeVisible({ timeout });
	}

	async close() {
		await this.closeButton.click();
	}

	async setLayerName(name: string) {
		await this.layerNameInput.clear();
		await this.layerNameInput.fill(name);
	}

	async setLayerDescription(description: string) {
		await this.layerDescriptionInput.clear();
		await this.layerDescriptionInput.fill(description);
	}

	async setLayerColor(color: string) {
		// Use the text input for more reliable color setting
		await this.layerColorTextInput.clear();
		await this.layerColorTextInput.fill(color);
	}

	async selectDrawTab() {
		await this.drawTab.click();
	}

	async selectGeoJsonTab() {
		await this.geojsonTab.click();
	}

	async clickAddPoint() {
		await this.addPointButton.click();
	}

	async clickAddLine() {
		await this.addLineButton.click();
	}

	async clickAddPolygon() {
		await this.addPolygonButton.click();
	}

	async clickRectangle() {
		await this.rectangleButton.click();
	}

	async clickCircle() {
		await this.circleButton.click();
	}

	async clickFreehand() {
		await this.freehandButton.click();
	}

	async clickSelectMode() {
		await this.selectModeButton.click();
	}

	async clickDeleteMode() {
		await this.deleteModeButton.click();
	}

	async clickDeleteSelection() {
		await this.deleteSelectionButton.click();
	}

	async getFeatureCount(): Promise<number> {
		return this.featureCards.count();
	}

	async getFeatureNames(): Promise<string[]> {
		const names: string[] = [];
		const count = await this.featureCards.count();

		for (let i = 0; i < count; i++) {
			const card = this.featureCards.nth(i);
			const nameInput = card.locator('input[placeholder="Feature name (required)"]');
			const value = await nameInput.inputValue();
			names.push(value);
		}

		return names;
	}

	async getFeatureDescriptions(): Promise<string[]> {
		const descriptions: string[] = [];
		const count = await this.featureCards.count();

		for (let i = 0; i < count; i++) {
			const card = this.featureCards.nth(i);
			const descInput = card.locator('textarea[placeholder="Description (optional)"]');
			const value = await descInput.inputValue();
			descriptions.push(value);
		}

		return descriptions;
	}

	async setFeatureName(index: number, name: string) {
		const card = this.featureCards.nth(index);
		const nameInput = card.locator('input[placeholder="Feature name (required)"]');
		await nameInput.clear();
		await nameInput.fill(name);
	}

	async setFeatureDescription(index: number, description: string) {
		const card = this.featureCards.nth(index);
		const descInput = card.locator('textarea[placeholder="Description (optional)"]');
		await descInput.clear();
		await descInput.fill(description);
	}

	async removeFeature(index: number) {
		const card = this.featureCards.nth(index);
		const removeButton = card.locator("button").filter({
			has: this.page.locator("svg.lucide-trash-2"),
		});
		await removeButton.click();
	}

	/**
	 * Selects an icon for a Point feature
	 * @param index - The index of the feature card
	 * @param iconType - The icon type: "default", "anchor", "ship", "warning", or "circle"
	 */
	async selectFeatureIcon(index: number, iconType: string) {
		const card = this.featureCards.nth(index);

		// Find the icon style section
		const iconSection = card.locator("text=Icon Style").locator("..");

		// Map icon types to their lucide class names
		const iconClassMap: Record<string, string> = {
			default: "lucide-map-pin",
			anchor: "lucide-anchor",
			ship: "lucide-ship",
			warning: "lucide-alert-triangle",
			circle: "lucide-circle",
		};

		const iconClass = iconClassMap[iconType];
		if (!iconClass) {
			throw new Error(`Unknown icon type: ${iconType}`);
		}

		// Find and click the button containing the icon
		const iconButton = iconSection.locator(
			`button:has(svg.${iconClass})`
		);
		await iconButton.click();
	}

	/**
	 * Selects a line style for a LineString feature
	 * @param index - The index of the feature card
	 * @param style - The line style: "solid", "dashed", or "dotted"
	 */
	async selectLineStyle(index: number, style: string) {
		const card = this.featureCards.nth(index);

		// Find the line style section
		const lineStyleSection = card.locator("text=Line Style").locator("..");

		// Find and click the button with the matching text
		const styleButton = lineStyleSection.locator(
			`button:has-text("${style}")`
		);
		await styleButton.click();
	}

	async clearAllFeatures() {
		await this.clearAllButton.click();
	}

	async importGeoJson(geoJson: string) {
		// Switch to GeoJSON tab if not already there
		await this.selectGeoJsonTab();

		// Fill the textarea
		await this.geoJsonTextarea.clear();
		await this.geoJsonTextarea.fill(geoJson);

		// Click import
		await this.importGeoJsonButton.click();
	}

	/**
	 * Sets the permission for who can edit the layer
	 * @param permission - "creator-only" for Only Me, "everyone" for Everyone
	 */
	async setPermission(permission: "creator-only" | "everyone") {
		if (permission === "creator-only") {
			await this.onlyMeButton.click();
		} else {
			await this.everyoneButton.click();
		}
	}

	async isCreateButtonEnabled(): Promise<boolean> {
		return this.createLayerButton.isEnabled();
	}

	async clickCreate() {
		await this.createLayerButton.click();
	}

	/**
	 * Checks if a specific draw mode is active
	 * @param mode - The mode to check: "Point", "LineString", "Polygon", "Rectangle", "Circle", "Freehand", "select", "delete", or "delete-selection"
	 */
	async isDrawModeActive(
		mode: "Point" | "LineString" | "Polygon" | "Rectangle" | "Circle" | "Freehand" | "select" | "delete" | "delete-selection"
	): Promise<boolean> {
		let button: Locator;

		switch (mode) {
			case "Point":
				button = this.addPointButton;
				break;
			case "LineString":
				button = this.addLineButton;
				break;
			case "Polygon":
				button = this.addPolygonButton;
				break;
			case "Rectangle":
				button = this.rectangleButton;
				break;
			case "Circle":
				button = this.circleButton;
				break;
			case "Freehand":
				button = this.freehandButton;
				break;
			case "select":
				button = this.selectModeButton;
				break;
			case "delete":
				button = this.deleteModeButton;
				break;
			case "delete-selection":
				button = this.deleteSelectionButton;
				break;
		}

		// Check if the button has the active classes
		const className = await button.getAttribute("class");
		if (!className) return false;

		// Active buttons have "border-teal-600" or "border-red-600" (for delete)
		return (
			className.includes("border-teal-600") ||
			className.includes("border-red-600")
		);
	}

	/**
	 * Gets the heading text ("Create Layer" or "Edit Layer")
	 */
	async getHeadingText(): Promise<string> {
		return (await this.heading.textContent()) || "";
	}

	/**
	 * Checks if the panel is in edit mode
	 */
	async isEditMode(): Promise<boolean> {
		const text = await this.getHeadingText();
		return text.includes("Edit Layer");
	}

	/**
	 * Gets the current layer name
	 */
	async getLayerName(): Promise<string> {
		return this.layerNameInput.inputValue();
	}

	/**
	 * Gets the current layer description
	 */
	async getLayerDescription(): Promise<string> {
		return this.layerDescriptionInput.inputValue();
	}

	/**
	 * Gets the current layer color
	 */
	async getLayerColor(): Promise<string> {
		return this.layerColorTextInput.inputValue();
	}

	/**
	 * Checks if there's an error message displayed
	 */
	async hasError(): Promise<boolean> {
		const errorDiv = this.panel.locator(
			"div.p-3.bg-red-50.border.border-red-200.rounded-lg"
		);
		return errorDiv.isVisible();
	}

	/**
	 * Gets the error message text
	 */
	async getErrorMessage(): Promise<string> {
		const errorDiv = this.panel.locator(
			"div.p-3.bg-red-50.border.border-red-200.rounded-lg"
		);
		return (await errorDiv.textContent()) || "";
	}

	/**
	 * Checks if the empty state message is visible
	 */
	async isEmptyStateVisible(): Promise<boolean> {
		const emptyState = this.panel.locator(
			'text="Click a button above to start drawing features on the map"'
		);
		return emptyState.isVisible();
	}

	/**
	 * Gets the selected permission type
	 */
	async getSelectedPermission(): Promise<"creator-only" | "everyone"> {
		const onlyMeClass = await this.onlyMeButton.getAttribute("class");
		if (onlyMeClass?.includes("border-teal-600")) {
			return "creator-only";
		}
		return "everyone";
	}

	/**
	 * Waits for the panel to close
	 */
	async waitForClose(timeout = 5000) {
		await expect(this.panel).not.toBeVisible({ timeout });
	}
}
