import { clerkSetup } from "@clerk/testing/playwright";
import { config } from "dotenv";

// Load environment variables from .env.test
config({ path: ".env.test" });

/**
 * Global setup for Playwright tests
 * Runs once before all tests
 */
async function globalSetup() {
	console.log("Global setup starting...");
	console.log(
		`CLERK_PUBLISHABLE_KEY: ${process.env.CLERK_PUBLISHABLE_KEY ? "set" : "not set"}`
	);
	console.log(
		`CLERK_SECRET_KEY: ${process.env.CLERK_SECRET_KEY ? "set" : "not set"}`
	);

	// Only run Clerk setup if keys are configured
	if (process.env.CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
		console.log("Setting up Clerk testing token...");
		try {
			await clerkSetup();
			console.log("Clerk testing token configured successfully");
		} catch (error) {
			console.error("Failed to setup Clerk testing:", error);
		}
	} else {
		console.log(
			"Clerk not configured - skipping Clerk setup (set CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY in .env.test)"
		);
	}
}

export default globalSetup;
