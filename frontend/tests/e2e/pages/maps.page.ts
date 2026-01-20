import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the Map Selector panel.
 * Provides methods to interact with maps - create, select, edit, delete.
 */
export class MapsPage {
	readonly page: Page;

	// Panel container
	readonly panel: Locator;
	readonly panelTitle: Locator;
	readonly closeButton: Locator;

	// Map list
	readonly mapList: Locator;
	readonly mapItems: Locator;

	// Actions
	readonly createMapButton: Locator;

	constructor(page: Page) {
		this.page = page;

		// The MapSelector panel - look for h2 with "Maps" text
		this.panelTitle = page.locator("h2").filter({ hasText: /^Maps$/ });
		this.panel = page.locator(".absolute.right-0").filter({
			has: this.panelTitle,
		});
		this.closeButton = this.panel.locator("button:has(svg)").first();

		// Map items
		this.mapList = this.panel.locator('[class*="space-y"]');
		this.mapItems = this.panel.locator(
			'[class*="rounded-lg"][class*="cursor-pointer"]'
		);

		// Create button
		this.createMapButton = page.getByRole("button", { name: /Create/i });
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

	async getMapCount(): Promise<number> {
		return this.mapItems.count();
	}

	async getMapNames(): Promise<string[]> {
		const names: string[] = [];
		const count = await this.mapItems.count();
		for (let i = 0; i < count; i++) {
			const text = await this.mapItems.nth(i).locator("p, h3, span").first().textContent();
			if (text) names.push(text.trim());
		}
		return names;
	}

	async selectMap(mapName: string) {
		await this.panel.locator(`text=${mapName}`).click();
	}

	async clickCreateMap() {
		await this.createMapButton.click();
	}

	async isMapSelected(mapName: string): Promise<boolean> {
		const mapItem = this.panel.locator(`text=${mapName}`).locator("..");
		const className = await mapItem.getAttribute("class");
		// Selected maps typically have a different background or border
		return className?.includes("bg-teal") || className?.includes("border-teal") || false;
	}

	async openMapMenu(mapName: string) {
		const mapItem = this.panel.locator(`text=${mapName}`).locator("..");
		const menuButton = mapItem.locator('button:has(svg[class*="more"])');
		await menuButton.click();
	}

	async editMap(mapName: string) {
		await this.openMapMenu(mapName);
		await this.page.getByRole("menuitem", { name: /Edit/i }).click();
	}

	async deleteMap(mapName: string) {
		await this.openMapMenu(mapName);
		await this.page.getByRole("menuitem", { name: /Delete/i }).click();
	}
}
