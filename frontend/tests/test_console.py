"""
Test that the frontend has no console errors or warnings.

Run with: playwright test tests/test_console.py
Or directly: python tests/test_console.py
"""

from playwright.sync_api import sync_playwright

# Known warnings to ignore (e.g., third-party libraries, development-only messages)
IGNORED_WARNINGS = [
    "Download the React DevTools",
    "StrictMode",
]

IGNORED_ERRORS = []


def should_ignore(message: str, ignore_list: list[str]) -> bool:
    """Check if a message should be ignored based on the ignore list."""
    return any(ignored in message for ignored in ignore_list)


def test_no_console_errors_or_warnings():
    """
    Load the frontend and verify no console errors or warnings are emitted.

    This test helps catch:
    - Runtime JavaScript errors
    - React warnings (missing keys, invalid props, etc.)
    - Deprecation warnings
    - Failed network requests logged to console
    """
    errors = []
    warnings = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()

        def handle_console(msg):
            text = msg.text
            if msg.type == "error" and not should_ignore(text, IGNORED_ERRORS):
                errors.append(text)
            elif msg.type == "warning" and not should_ignore(text, IGNORED_WARNINGS):
                warnings.append(text)

        page.on("console", handle_console)

        # Also catch uncaught exceptions
        page.on("pageerror", lambda err: errors.append(f"Page error: {err}"))

        # Load the app
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")

        # Give React time to finish rendering
        page.wait_for_timeout(1000)

        browser.close()

    # Report results
    if errors:
        print("\nConsole Errors:")
        for error in errors:
            print(f"  - {error}")

    if warnings:
        print("\nConsole Warnings:")
        for warning in warnings:
            print(f"  - {warning}")

    assert not errors, f"Console errors found: {errors}"
    assert not warnings, f"Console warnings found: {warnings}"


if __name__ == "__main__":
    test_no_console_errors_or_warnings()
    print("No console errors or warnings found!")
