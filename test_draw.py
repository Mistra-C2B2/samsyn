from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    # Collect console messages
    console_messages = []
    page.on("console", lambda msg: console_messages.append(f"{msg.type}: {msg.text}"))

    page.goto('http://localhost:3000')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(1000)

    # Click on "Create a new map to get started" link
    create_link = page.locator('text=Create a new map')
    if create_link.count() > 0:
        print("Clicking 'Create a new map' link")
        create_link.click()
        page.wait_for_timeout(2000)

    page.screenshot(path='/tmp/map_step1.png', full_page=True)

    # Check if we now have a map loaded
    canvas = page.locator('canvas.maplibregl-canvas')
    print(f"MapLibre canvas found: {canvas.count() > 0}")

    if canvas.count() > 0:
        page.wait_for_timeout(2000)  # Wait for map to fully load
        page.screenshot(path='/tmp/map_loaded.png', full_page=True)

        # Check for terra-draw control
        terradraw_ctrl = page.locator('.maplibregl-ctrl-top-left')
        print(f"Top-left control exists: {terradraw_ctrl.count() > 0}")

        # Get all controls
        all_controls = page.locator('.maplibregl-ctrl').all()
        print(f"Found {len(all_controls)} maplibre controls")

        # Check specifically for terra-draw buttons
        draw_buttons = page.locator('button[title*="draw"], button[title*="Draw"], button[aria-label*="draw"]').all()
        print(f"Found {len(draw_buttons)} draw buttons")

        # Get the HTML of the map container
        map_container = page.locator('.maplibregl-map')
        if map_container.count() > 0:
            html = map_container.inner_html()
            # Look for terradraw related elements
            if 'terradraw' in html.lower():
                print("Found 'terradraw' in map HTML")
            else:
                print("No 'terradraw' found in map HTML")
            # Print first 1000 chars
            print(f"\nMap HTML preview:\n{html[:1500]}")

    # Print console errors
    print("\n--- Console Errors/Warnings ---")
    for msg in console_messages:
        if 'error' in msg.lower() or 'warn' in msg.lower():
            print(msg)

    browser.close()
