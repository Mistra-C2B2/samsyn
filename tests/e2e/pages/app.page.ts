import { type Locator, type Page, expect } from "@playwright/test";

/**
 * Page object for the main SamSyn application.
 * Provides methods to interact with the app header and navigate between panels.
 */
export class AppPage {
	readonly page: Page;

	// Header elements
	readonly header: Locator;
	readonly appTitle: Locator;
	readonly currentMapName: Locator;

	// Navigation buttons
	readonly mapsButton: Locator;
	readonly layersButton: Locator;
	readonly commentsButton: Locator;
	readonly adminButton: Locator;
	readonly shareButton: Locator;
	readonly settingsButton: Locator;
	readonly signInButton: Locator;

	// Map container
	readonly mapContainer: Locator;
	readonly mapCanvas: Locator;

	constructor(page: Page) {
		this.page = page;

		// Header
		this.header = page.locator("header");
		this.appTitle = page.locator("h1:has-text('SAMSYN')");
		this.currentMapName = page.locator("header p.text-slate-500");

		// Navigation buttons - using text content for reliable selection
		this.mapsButton = page.getByRole("button", { name: /Maps/i });
		this.layersButton = page.getByRole("button", { name: /Layers/i });
		this.commentsButton = page.getByRole("button", { name: /Comments/i });
		this.adminButton = page.getByRole("button", { name: /Admin/i });
		this.shareButton = page.locator('button:has(svg[class*="lucide-share"])');
		this.settingsButton = page.locator(
			'button:has(svg[class*="lucide-settings"])'
		);
		this.signInButton = page.getByRole("button", { name: /Sign In/i });

		// Map
		this.mapContainer = page.locator(".maplibregl-map");
		this.mapCanvas = page.locator(".maplibregl-canvas");
	}

	async goto() {
		await this.page.goto("/");
		await this.waitForAppLoad();
	}

	async waitForAppLoad() {
		// Wait for header to be visible
		await expect(this.appTitle).toBeVisible();
		// Wait for map to initialize (or empty state)
		await this.page.waitForTimeout(1000);
	}

	async waitForMapLoad() {
		// Wait for MapLibre to fully load
		await expect(this.mapContainer).toBeVisible();
		// Additional wait for tiles to load
		await this.page.waitForFunction(
			() => {
				const map = (window as unknown as { map?: { loaded: () => boolean } })
					.map;
				return map?.loaded?.() ?? false;
			},
			{ timeout: 30000 }
		);
	}

	async openMapsPanel() {
		await this.mapsButton.click();
	}

	async openLayersPanel() {
		await this.layersButton.click();
	}

	async openCommentsPanel() {
		await this.commentsButton.click();
	}

	async openAdminPanel() {
		await this.adminButton.click();
	}

	async openSettings() {
		await this.settingsButton.click();
	}

	async shareMap() {
		await this.shareButton.click();
	}

	async getCurrentMapName(): Promise<string> {
		return (await this.currentMapName.textContent()) || "";
	}

	async isPanelOpen(
		panelName: "maps" | "layers" | "comments" | "admin"
	): Promise<boolean> {
		const button = {
			maps: this.mapsButton,
			layers: this.layersButton,
			comments: this.commentsButton,
			admin: this.adminButton,
		}[panelName];

		const variant = await button.getAttribute("data-variant");
		// Default variant indicates active state in shadcn
		return variant === "default" || (await button.getAttribute("class"))?.includes("bg-primary") || false;
	}
}
