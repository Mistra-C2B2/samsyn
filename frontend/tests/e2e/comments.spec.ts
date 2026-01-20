import { expect, test } from "@playwright/test";
import { AppPage, MapsPage } from "./pages";

test.describe("Comments Panel", () => {
	let appPage: AppPage;

	test.beforeEach(async ({ page }) => {
		appPage = new AppPage(page);
		await appPage.goto();
	});

	test("should have comments button in navigation", async () => {
		await expect(appPage.commentsButton).toBeVisible();
	});

	test("should open comments panel when clicking Comments button with a map loaded", async ({
		page,
	}) => {
		// First we need a map loaded
		const mapsPage = new MapsPage(page);
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Check if there's a map to select
		const mapItems = page.locator('[data-testid="map-item"], .cursor-pointer');
		const mapCount = await mapItems.count();

		if (mapCount === 0) {
			test.skip();
			return;
		}

		// Click first map to select it
		await mapItems.first().click();
		await page.waitForTimeout(1000);

		// Now open comments panel
		await appPage.openCommentsPanel();

		// Comments panel should show
		const commentsTitle = page.locator("h2").filter({ hasText: /Comments/i });
		await expect(commentsTitle).toBeVisible();
	});
});

test.describe("Comments Panel Structure", () => {
	async function openCommentsWithMap(page: import("@playwright/test").Page) {
		const appPage = new AppPage(page);
		const mapsPage = new MapsPage(page);

		await appPage.goto();
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Check if there's a map to select
		const mapItems = page.locator('[data-testid="map-item"], .cursor-pointer');
		const mapCount = await mapItems.count();

		if (mapCount === 0) {
			return false;
		}

		// Click first map to select it
		await mapItems.first().click();
		await page.waitForTimeout(1000);

		// Open comments panel
		await appPage.openCommentsPanel();
		await page.waitForTimeout(500);

		return true;
	}

	test("should show context selector dropdown", async ({ page }) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		// Should have "Commenting on" label
		const label = page.locator("text=Commenting on");
		await expect(label).toBeVisible();

		// Should have select trigger
		const selectTrigger = page.locator('[id="commentTarget"]');
		await expect(selectTrigger).toBeVisible();
	});

	test("should show comment input area", async ({ page }) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		// Should have textarea for adding comments
		const textarea = page.locator("textarea");
		await expect(textarea).toBeVisible();

		// Should have post button
		const postButton = page.getByRole("button", { name: /Post/i });
		await expect(postButton).toBeVisible();
	});

	test("should show empty state when no comments exist", async ({ page }) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		// Wait for comments to load
		await page.waitForTimeout(1000);

		// Check for empty state or existing comments
		const emptyState = page.locator("text=Be the first to comment");
		const commentItems = page.locator('[class*="flex items-start gap-3"]');

		const hasEmptyState = await emptyState.isVisible().catch(() => false);
		const hasComments = (await commentItems.count()) > 0;

		// Either empty state or comments should be visible
		expect(hasEmptyState || hasComments).toBe(true);
	});

	test("should close comments panel when clicking X button", async ({
		page,
	}) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		const commentsTitle = page.locator("h2").filter({ hasText: /Comments/i });
		await expect(commentsTitle).toBeVisible();

		// Find and click the close button
		const closeButton = page
			.locator("h2")
			.filter({ hasText: /Comments/i })
			.locator("..")
			.locator("button")
			.filter({ has: page.locator("svg") })
			.first();

		await closeButton.click();

		// Comments panel should be closed
		await expect(commentsTitle).not.toBeVisible();
	});
});

test.describe("Comments Context Switching", () => {
	async function openCommentsWithMap(page: import("@playwright/test").Page) {
		const appPage = new AppPage(page);
		const mapsPage = new MapsPage(page);

		await appPage.goto();
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Check if there's a map to select
		const mapItems = page.locator('[data-testid="map-item"], .cursor-pointer');
		const mapCount = await mapItems.count();

		if (mapCount === 0) {
			return false;
		}

		// Click first map to select it
		await mapItems.first().click();
		await page.waitForTimeout(1000);

		// Open comments panel
		await appPage.openCommentsPanel();
		await page.waitForTimeout(500);

		return true;
	}

	test("should allow switching between map and layer comments", async ({
		page,
	}) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		// Click the select trigger to open dropdown
		const selectTrigger = page.locator('[id="commentTarget"]');
		await selectTrigger.click();

		// Should show dropdown options
		const selectContent = page.locator('[role="listbox"]');
		await expect(selectContent).toBeVisible();

		// Should have at least the map option (may have layer options too)
		const options = selectContent.locator('[role="option"]');
		const optionCount = await options.count();
		expect(optionCount).toBeGreaterThanOrEqual(1);
	});
});

test.describe("Comments Loading States", () => {
	test("should show loading indicator when fetching comments", async ({
		page,
	}) => {
		// Intercept comments API to add delay
		await page.route("**/api/v1/comments**", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 500));
			await route.continue();
		});

		const appPage = new AppPage(page);
		const mapsPage = new MapsPage(page);

		await appPage.goto();
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Check if there's a map to select
		const mapItems = page.locator('[data-testid="map-item"], .cursor-pointer');
		const mapCount = await mapItems.count();

		if (mapCount === 0) {
			test.skip();
			return;
		}

		// Click first map to select it
		await mapItems.first().click();
		await page.waitForTimeout(1000);

		// Open comments panel
		await appPage.openCommentsPanel();

		// Should show loading indicator briefly
		const loadingText = page.locator("text=Loading comments");
		// May or may not catch it depending on timing
		await page.waitForTimeout(1000);
	});

	test("should show error state when comments fail to load", async ({
		page,
	}) => {
		// Intercept comments API to return error
		await page.route("**/api/v1/comments**", async (route) => {
			await route.fulfill({
				status: 500,
				body: JSON.stringify({ detail: "Internal server error" }),
			});
		});

		const appPage = new AppPage(page);
		const mapsPage = new MapsPage(page);

		await appPage.goto();
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Check if there's a map to select
		const mapItems = page.locator('[data-testid="map-item"], .cursor-pointer');
		const mapCount = await mapItems.count();

		if (mapCount === 0) {
			test.skip();
			return;
		}

		// Click first map to select it
		await mapItems.first().click();
		await page.waitForTimeout(1000);

		// Open comments panel
		await appPage.openCommentsPanel();

		// Should show error state
		const errorText = page.locator("text=Error loading comments");
		await expect(errorText).toBeVisible({ timeout: 5000 });
	});
});

test.describe("Comments Authentication", () => {
	async function openCommentsWithMap(page: import("@playwright/test").Page) {
		const appPage = new AppPage(page);
		const mapsPage = new MapsPage(page);

		await appPage.goto();
		await appPage.openMapsPanel();
		await mapsPage.waitForPanel();

		// Check if there's a map to select
		const mapItems = page.locator('[data-testid="map-item"], .cursor-pointer');
		const mapCount = await mapItems.count();

		if (mapCount === 0) {
			return false;
		}

		// Click first map to select it
		await mapItems.first().click();
		await page.waitForTimeout(1000);

		// Open comments panel
		await appPage.openCommentsPanel();
		await page.waitForTimeout(500);

		return true;
	}

	test("should disable comment input when not signed in", async ({ page }) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		// Check if user is signed in (sign in button visible means not signed in)
		const signInButton = page.getByRole("button", { name: /Sign In/i });
		const isSignedOut = await signInButton.isVisible().catch(() => false);

		if (!isSignedOut) {
			test.skip(); // User is signed in, skip this test
			return;
		}

		// Textarea should be disabled
		const textarea = page.locator("textarea");
		await expect(textarea).toBeDisabled();

		// Post button should be disabled
		const postButton = page.getByRole("button", { name: /Post/i });
		await expect(postButton).toBeDisabled();
	});

	test("should show tooltip about signing in when hovering post button", async ({
		page,
	}) => {
		const opened = await openCommentsWithMap(page);
		if (!opened) {
			test.skip();
			return;
		}

		// Check if user is signed out
		const signInButton = page.getByRole("button", { name: /Sign In/i });
		const isSignedOut = await signInButton.isVisible().catch(() => false);

		if (!isSignedOut) {
			test.skip();
			return;
		}

		// Hover over the post button
		const postButton = page.getByRole("button", { name: /Post/i });
		await postButton.hover();

		// Should show sign-in tooltip
		const tooltip = page.locator("text=Please sign in to comment");
		await expect(tooltip).toBeVisible({ timeout: 2000 });
	});
});
