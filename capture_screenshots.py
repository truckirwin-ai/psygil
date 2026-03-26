#!/usr/bin/env python3
"""
Capture all 9 demo screenshots from the prototype using Playwright.
Run: pip install playwright && playwright install chromium && python3 capture_screenshots.py
Or if you have the html2canvas downloads in ~/Downloads, just run:
  mv ~/Downloads/shot_0*.jpg ~/Desktop/Foundry\ SMB/Products/Psygil/demo_screenshots/
"""
import subprocess
import sys
import os

SAVE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_screenshots")
URL = "http://localhost:8080/Psygil_UI_Prototype_v4.html"

# Try using Playwright (headless Chrome)
try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print("Playwright not installed. Trying to install...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "playwright", "--break-system-packages"])
    subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
    from playwright.sync_api import sync_playwright

def capture_all():
    os.makedirs(SAVE_DIR, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.goto(URL, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # Close any open modals
        page.evaluate("""() => {
            document.querySelectorAll('.modal-close, .close-btn').forEach(b => b.click());
        }""")
        page.wait_for_timeout(500)

        shots = [
            ("shot_01_dashboard.jpg", "Dashboard", None),
            ("shot_02_interview.jpg", "Session 1", None),
            ("shot_03_report.jpg", "CST Evaluation Report", None),
            ("shot_04_evidence_map.jpg", "Evidence Map", None),
            ("shot_05_clinical_overview.jpg", "Clinical Overview", None),
            ("shot_06_setup.jpg", None, "Setup"),
            ("shot_07_intake.jpg", None, "Intake"),
            ("shot_08_onboarding.jpg", None, "Onboarding"),
            ("shot_09_docs.jpg", None, "Docs"),
        ]

        for filename, tree_label, nav_label in shots:
            # Close any modals first
            page.evaluate("""() => {
                document.querySelectorAll('.modal-close, .close-btn').forEach(b => b.click());
            }""")
            page.wait_for_timeout(300)

            if tree_label:
                # Click tree item
                page.evaluate(f"""() => {{
                    const labels = document.querySelectorAll('span.tree-label');
                    for (const el of labels) {{
                        if (el.textContent.includes('{tree_label}')) {{ el.click(); break; }}
                    }}
                }}""")
            elif nav_label:
                # Click nav link
                page.evaluate(f"""() => {{
                    const all = document.querySelectorAll('*');
                    for (const el of all) {{
                        if (el.textContent.trim() === '{nav_label}' && el.children.length === 0 && el.classList.contains('tb-link')) {{
                            el.click(); break;
                        }}
                    }}
                }}""")

            page.wait_for_timeout(1000)
            path = os.path.join(SAVE_DIR, filename)
            page.screenshot(path=path, full_page=False, type="jpeg", quality=92)
            size = os.path.getsize(path)
            print(f"  ✓ {filename} ({size:,} bytes)")

        browser.close()
    print(f"\nAll 9 screenshots saved to {SAVE_DIR}")

if __name__ == "__main__":
    print("Capturing Psygil demo screenshots...")
    print(f"Prototype URL: {URL}")
    print(f"Save directory: {SAVE_DIR}\n")
    capture_all()
