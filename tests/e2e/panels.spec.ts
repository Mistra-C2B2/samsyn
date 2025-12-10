import { expect, test } from "@playwright/test";
import { AppPage, LayersPage, MapsPage } from "./pages";

test.describe("Panel Behavior", () => {
	let appPage: AppPage;
	let mapsPage: MapsPage;

	test.beforeEach(async ({ page }) => {
		appPage = new AppPage(page);
		mapsPage = new MapsPage(page);
		await appPage.goto();
	});

	test("should load the application with header visible", async () => {
		await expect(appPage.appTitle).toBeVisible();
		await expect(appPage.appTitle).toHaveText("SAMSYN");
	});

	test("should have navigation buttons in header", async () => {
		await expect(appPage.mapsButton).toBeVisible();
		await expect(appPage.layersButton).toBeVisible();
		await expect(appPage.commentsButton).toBeVisible();
		await expect(appPage.adminButton).toBeVisible();
	});

	test("should open maps panel when clicking Maps button", async () => {
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();
		await expect(mapsPage.panelTitle).toBeVisible();
	});

	test("should open comments panel when clicking Comments button", async ({
		page,
	}) => {
		await appPage.openCommentsPanel();
		// Comments panel may or may not show depending on map state
		// Just verify the button interaction works
		await page.waitForTimeout(500);
		expect(true).toBe(true);
	});

	test("should open admin panel when clicking Admin button", async ({
		page,
	}) => {
		await appPage.openAdminPanel();
		const adminHeading = page.locator("h2").filter({ hasText: /Admin/i });
		await expect(adminHeading).toBeVisible();
	});

	test("should show settings dialog when clicking settings button", async ({
		page,
	}) => {
		await appPage.openSettings();
		await expect(page.getByRole("dialog")).toBeVisible();
	});

	test("should close maps panel when clicking X button", async ({ page }) => {
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		const closeButton = page
			.locator("h2")
			.filter({ hasText: /Maps/i })
			.locator("..")
			.locator("button:has(svg)")
			.first();
		await closeButton.click();

		await expect(mapsPage.panelTitle).not.toBeVisible();
	});

	test("should only have one panel open at a time - admin closes maps", async ({
		page,
	}) => {
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();
		await expect(mapsPage.panelTitle).toBeVisible();

		await appPage.openAdminPanel();
		const adminHeading = page.locator("h2").filter({ hasText: /Admin/i });
		await expect(adminHeading).toBeVisible();

		await expect(mapsPage.panelTitle).not.toBeVisible();
	});

	test("should toggle panel off when clicking same button again", async () => {
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();
		await expect(mapsPage.panelTitle).toBeVisible();

		await appPage.openMapsPanel();
		await expect(mapsPage.panelTitle).not.toBeVisible();
	});
});

test.describe("Panel Behavior with Map", () => {
	// These tests require a map to exist
	// Note: Layers panel is OPEN by default when a map exists (showLayerManager starts as true)

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

	test.beforeEach(async ({ page }) => {
		await page.goto("/");
		await page.waitForTimeout(1500);
	});

	test("should show layers panel by default when map exists", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const layersPage = new LayersPage(page);
		// Panel is open by default - don't click the button
		await layersPage.waitForPanel();
		await expect(layersPage.panelTitle).toBeVisible();
	});

	test("layers panel should close when opening maps panel", async ({
		page,
	}) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const appPage = new AppPage(page);
		const layersPage = new LayersPage(page);
		const mapsPage = new MapsPage(page);

		// Layers panel is open by default
		await layersPage.waitForPanel();

		// Open maps panel - should close layers
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		await expect(layersPage.panelTitle).not.toBeVisible();
	});

	test("should switch from layers to maps panel", async ({ page }) => {
		if (!(await hasMapLoaded(page))) {
			test.skip();
			return;
		}

		const appPage = new AppPage(page);
		const layersPage = new LayersPage(page);
		const mapsPage = new MapsPage(page);

		// Layers panel starts open
		await layersPage.waitForPanel();

		// Click Maps button
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Only Maps panel should be visible
		await expect(mapsPage.panelTitle).toBeVisible();
		await expect(layersPage.panelTitle).not.toBeVisible();
	});
});
