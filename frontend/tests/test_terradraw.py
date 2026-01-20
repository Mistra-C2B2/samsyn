"""
Test script for TerraDraw functionality in the application.

This script tests:
1. Whether the TerraDraw control is rendered
2. Whether drawing modes can be activated
3. Whether drawing on the canvas works
"""

from playwright.sync_api import sync_playwright
import time
import sys

def test_terradraw():
    """Main test function for TerraDraw"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({'width': 1280, 'height': 800})

        # Collect console messages for debugging
        messages = []
        errors = []
        page.on('console', lambda msg: messages.append(f'{msg.type}: {msg.text}'))
        page.on('pageerror', lambda err: errors.append(str(err)))

        print("Loading application...")
        page.goto('http://localhost:3001')

        # Wait for map to load
        print("Waiting for map to load...")
        time.sleep(8)

        # Take screenshot to see current state
        page.screenshot(path='/tmp/terradraw_test_initial.png')
        print("Initial screenshot saved to /tmp/terradraw_test_initial.png")

        # Check 1: Is the map container present?
        map_container = page.query_selector('.maplibregl-map')
        print(f"\n=== Test Results ===")
        print(f"1. Map container found: {map_container is not None}")

        # Check 2: Is the map canvas rendering?
        canvas = page.query_selector('.maplibregl-canvas')
        print(f"2. Map canvas found: {canvas is not None}")

        # Check 3: Is TerraDraw control rendered?
        terradraw_ctrl = page.query_selector('.maplibregl-ctrl-terradraw')
        print(f"3. TerraDraw control found: {terradraw_ctrl is not None}")

        # Check 4: Check all controls in top-right
        top_right = page.query_selector('.maplibregl-ctrl-top-right')
        if top_right:
            children = top_right.query_selector_all('*')
            print(f"4. Elements in top-right control area: {len(children)}")
            html = top_right.inner_html()
            if html:
                print(f"   Top-right HTML preview: {html[:200]}...")
        else:
            print("4. Top-right control area not found")

        # Check 5: Look for any buttons that might be TerraDraw related
        all_buttons = page.query_selector_all('button')
        print(f"5. Total buttons on page: {len(all_buttons)}")

        # Check for specific TerraDraw elements
        draw_buttons = page.query_selector_all('[class*="draw"], [class*="terra"]')
        print(f"6. Elements with 'draw' or 'terra' in class: {len(draw_buttons)}")

        # Print any errors
        if errors:
            print(f"\n=== Page Errors ===")
            for err in errors:
                print(f"  - {err}")

        # Print relevant console messages
        print(f"\n=== Console Messages (filtered) ===")
        for msg in messages:
            if any(keyword in msg.lower() for keyword in ['terradraw', 'error', 'map', 'draw', 'loaded']):
                print(f"  {msg}")

        # Try to interact with the "Create Layer" button to see if drawing mode activates
        print(f"\n=== Attempting to activate drawing mode ===")
        create_layer_btn = page.query_selector('text=Create Layer')
        if create_layer_btn:
            print("Found 'Create Layer' button, clicking...")
            create_layer_btn.click()
            time.sleep(2)
            page.screenshot(path='/tmp/terradraw_test_create_layer.png')
            print("Screenshot after clicking Create Layer saved")

            # Look for drawing type options
            point_btn = page.query_selector('text=Point')
            polygon_btn = page.query_selector('text=Polygon')
            print(f"  Point option found: {point_btn is not None}")
            print(f"  Polygon option found: {polygon_btn is not None}")
        else:
            print("'Create Layer' button not found")

        browser.close()

        # Return test result
        return terradraw_ctrl is not None


def test_drawing_interaction():
    """Test actual drawing on the map"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_viewport_size({'width': 1280, 'height': 800})

        messages = []
        page.on('console', lambda msg: messages.append(f'{msg.type}: {msg.text}'))

        print("\n=== Testing Drawing Interaction ===")
        page.goto('http://localhost:3001')
        time.sleep(6)

        # Click Create Layer to open the layer creator
        create_layer = page.get_by_text('Create Layer')
        if create_layer:
            create_layer.click()
            time.sleep(1)
            page.screenshot(path='/tmp/terradraw_test_layer_dialog.png')
            print("Layer dialog screenshot saved")

            # Look for geometry type selector
            draw_geometry = page.get_by_text('Draw on map')
            if draw_geometry:
                draw_geometry.click()
                time.sleep(1)
                page.screenshot(path='/tmp/terradraw_test_draw_option.png')
                print("Draw option screenshot saved")

                # Try to find and click polygon option
                polygon_btn = page.query_selector('[data-value="Polygon"]')
                if not polygon_btn:
                    polygon_btn = page.get_by_text('Polygon', exact=True)

                if polygon_btn:
                    polygon_btn.click()
                    time.sleep(1)

                    # Try clicking on the map canvas to draw
                    canvas = page.query_selector('.maplibregl-canvas')
                    if canvas:
                        box = canvas.bounding_box()
                        if box:
                            # Draw a triangle
                            center_x = box['x'] + box['width'] / 2
                            center_y = box['y'] + box['height'] / 2

                            print(f"Canvas bounds: {box}")
                            print("Attempting to draw polygon...")

                            # Click three points to make a triangle
                            page.mouse.click(center_x - 100, center_y - 100)
                            time.sleep(0.3)
                            page.mouse.click(center_x + 100, center_y - 100)
                            time.sleep(0.3)
                            page.mouse.click(center_x, center_y + 100)
                            time.sleep(0.3)
                            # Double-click to finish
                            page.mouse.dblclick(center_x, center_y + 100)
                            time.sleep(1)

                            page.screenshot(path='/tmp/terradraw_test_after_draw.png')
                            print("Post-drawing screenshot saved")

        # Print console messages for debugging
        print("\n=== Console messages during drawing test ===")
        for msg in messages[-20:]:
            print(f"  {msg}")

        browser.close()


if __name__ == '__main__':
    print("=" * 60)
    print("TerraDraw Test Suite")
    print("=" * 60)

    result = test_terradraw()

    if not result:
        print("\n⚠️  TerraDraw control not found - running interaction test anyway...")

    test_drawing_interaction()

    print("\n" + "=" * 60)
    print("Test complete. Check /tmp/terradraw_test_*.png for screenshots.")
    print("=" * 60)
