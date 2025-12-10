/**
 * Authentication setup for Playwright tests with Clerk
 *
 * This file provides utilities for testing authenticated flows.
 *
 * Prerequisites:
 * 1. Set environment variables:
 *    - CLERK_PUBLISHABLE_KEY (your Clerk publishable key)
 *    - CLERK_SECRET_KEY (your Clerk secret key)
 *    - TEST_USER_EMAIL (email of test user)
 *    - TEST_USER_PASSWORD (password of test user)
 *
 * 2. Create a test user in Clerk Dashboard with username/password auth
 *
 * 3. Enable username/password authentication in Clerk Dashboard
 */

import { clerk } from "@clerk/testing/playwright";
import { test as base, expect } from "@playwright/test";

/**
 * Extended test fixture with Clerk authentication helpers
 */
export const test = base.extend<{
	clerkAuth: typeof clerk;
}>({
	clerkAuth: async ({ page }, use) => {
		// Make clerk helpers available in tests
		await use(clerk);
	},
});

/**
 * Helper to check if Clerk is configured for testing
 */
export function isClerkConfigured(): boolean {
	return !!(
		process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY
	);
}

/**
 * Helper to check if test user credentials are available
 */
export function hasTestUserCredentials(): boolean {
	return !!(process.env.TEST_USER_EMAIL && process.env.TEST_USER_PASSWORD);
}

/**
 * Sign in with test user
 * Uses Clerk's testing helpers to authenticate without UI interaction
 */
export async function signInTestUser(page: import("@playwright/test").Page) {
	if (!hasTestUserCredentials()) {
		throw new Error(
			"Test user credentials not configured. Set TEST_USER_EMAIL and TEST_USER_PASSWORD env vars."
		);
	}

	// Navigate to app first (required before clerk.signIn)
	await page.goto("/");

	// Sign in using Clerk's testing helper
	await clerk.signIn({
		page,
		signInParams: {
			strategy: "password",
			identifier: process.env.TEST_USER_EMAIL!,
			password: process.env.TEST_USER_PASSWORD!,
		},
	});
}

/**
 * Sign out current user
 */
export async function signOutUser(page: import("@playwright/test").Page) {
	await clerk.signOut({ page });
}

export { expect };
