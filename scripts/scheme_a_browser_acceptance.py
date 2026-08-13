from __future__ import annotations

import json
from pathlib import Path

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:3001"
OUTPUT = Path(__file__).resolve().parents[1] / "test-results" / "scheme-a"
OUTPUT.mkdir(parents=True, exist_ok=True)


def main() -> None:
    failures: list[dict[str, object]] = []
    console_errors: list[str] = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 1000})
        page.on(
            "response",
            lambda response: failures.append({"status": response.status, "url": response.url})
            if "/api/" in response.url and response.status >= 400
            else None,
        )
        page.on(
            "console",
            lambda message: console_errors.append(message.text) if message.type == "error" else None,
        )

        page.goto(f"{BASE_URL}/login", wait_until="networkidle")
        page.evaluate("localStorage.setItem('guideCompleted', 'true')")
        page.locator("#username").fill("demo_support_admin")
        page.locator("#password").fill("123456")
        with page.expect_response(
            lambda response: response.url.endswith('/api/auth/login')
        ) as login_response:
            page.locator("#login-button").click()
        response = login_response.value
        if not response.ok:
            raise AssertionError(f"login failed: {response.status} {response.text()}")
        page.wait_for_timeout(500)
        if "/login" in page.url:
            raise AssertionError(f"login did not navigate: {page.locator('body').inner_text()}")
        failures.clear()
        console_errors.clear()

        page.goto(f"{BASE_URL}/admin/dashboard", wait_until="networkidle")
        admin_paths = page.locator(".sidebar-nav .nav-item").evaluate_all(
            "links => links.map(link => link.getAttribute('href')).filter(Boolean)"
        )
        admin_results: dict[str, dict[str, object]] = {}
        for path in admin_paths:
            page.goto(f"{BASE_URL}{path}", wait_until="networkidle")
            body = page.locator("body").inner_text()
            admin_results[path] = {
                "url": page.url,
                "headingCount": page.locator(".admin-main h1, .admin-main h2").count(),
                "resourceNotFound": "请求的资源不存在" in body,
            }

        page.goto(f"{BASE_URL}/admin/knowledge", wait_until="networkidle")
        knowledge = {
            "folderOptions": page.locator(".resource-section select option").count(),
            "resourceRows": page.locator(".resource-section tbody tr").count(),
            "builtinBadges": page.locator(".resource-section .badge.builtin").count(),
        }

        page.goto(f"{BASE_URL}/admin/music", wait_until="networkidle")
        page.locator('[data-test="add-music"]').click()
        music_form_visible = page.locator('[data-test="music-form"]').is_visible()

        page.goto(f"{BASE_URL}/user/setting", wait_until="networkidle")
        page.locator('[data-test="send-test-notification"]').click()
        page.wait_for_timeout(800)
        test_notification_visible = "提醒测试成功" in page.locator("body").inner_text()

        page.goto(f"{BASE_URL}/counseling", wait_until="networkidle")
        counseling = {
            "historyLeft": page.locator(".history-column").bounding_box(),
            "chatCenter": page.locator(".chat-panel").bounding_box(),
            "infoRight": page.locator(".info-panel").bounding_box(),
            "composer": page.locator(".input-panel").bounding_box(),
        }
        page.screenshot(path=str(OUTPUT / "counseling-layout.png"), full_page=True)

        page.goto(f"{BASE_URL}/mood/analysis", wait_until="networkidle")
        page.wait_for_timeout(1000)
        analysis_body = page.locator("body").inner_text()
        analysis = {
            "hasEmptyState": page.locator(".soft-empty-state").count() > 0,
            "summaryCards": page.locator(".summary-card").count(),
            "chartCards": page.locator(".chart-card").count(),
        }
        page.screenshot(path=str(OUTPUT / "mood-analysis.png"), full_page=True)

        report = {
            "admin": admin_results,
            "knowledge": knowledge,
            "musicFormVisible": music_form_visible,
            "testNotificationVisible": test_notification_visible,
            "counseling": counseling,
            "analysis": analysis,
            "apiFailures": failures,
            "consoleErrors": console_errors,
        }
        (OUTPUT / "report.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(json.dumps(report, ensure_ascii=False, indent=2))
        browser.close()

    assert not failures, failures
    assert knowledge["folderOptions"] >= 2
    assert knowledge["resourceRows"] >= 9
    assert knowledge["builtinBadges"] >= 9
    assert music_form_visible
    assert test_notification_visible
    assert counseling["historyLeft"] and counseling["chatCenter"] and counseling["infoRight"]
    assert counseling["historyLeft"]["x"] < counseling["chatCenter"]["x"] < counseling["infoRight"]["x"]
    assert counseling["composer"] and counseling["composer"]["width"] > counseling["chatCenter"]["width"]
    assert not analysis["hasEmptyState"]
    assert analysis["summaryCards"] >= 3
    assert analysis["chartCards"] >= 3


if __name__ == "__main__":
    main()
