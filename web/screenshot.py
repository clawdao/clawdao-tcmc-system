import sys
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:5173"
OUT = "/tmp/tcm-shots"
PAGES = [
    ("/", "dashboard"),
    ("/cases", "cases"),
    ("/upload", "upload"),
    ("/stats", "stats"),
    ("/dicts", "dicts"),
    ("/system", "system"),
]

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto(f"{BASE}/login")
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/00-login.png")
    page.fill('input[placeholder="用户名"]', "admin")
    page.fill('input[placeholder="密码"]', "admin123")
    page.click('button:has-text("登 录")')
    page.wait_for_timeout(2500)
    for path, name in PAGES:
        page.goto(f"{BASE}{path}")
        page.wait_for_timeout(2500)
        page.screenshot(path=f"{OUT}/{name}.png", full_page=(name == "stats"))
        print("saved", name)
    # 详情页
    page.goto(f"{BASE}/cases")
    page.wait_for_timeout(2000)
    page.locator("tbody tr td a, tbody tr .ant-btn-link").first.click()
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{OUT}/detail.png")
    browser.close()
print("done")
