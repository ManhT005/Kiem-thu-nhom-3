const { test, expect } = require("@playwright/test");
test("staff creates a DRAFT receipt in the UI and posts it exactly once through MySQL", async ({ page }) => {
  test.skip(!/_test$/i.test(process.env.DB_NAME || ""), "Requires a seeded *_test database");
  page.on("dialog", (dialog) => dialog.accept());
  const login = await (await page.request.post("/api/auth/login", { data: { email: "phase2-staff@example.test", password: "Phase2Test!" } })).json();
  await page.addInitScript((login) => { localStorage.setItem("user", JSON.stringify(login.user)); localStorage.setItem("token", login.token); }, login);
  const stock = async () => (await (await page.request.get("/api/products/93004")).json()).data.product.sizes.find((size) => size.maSize === 92901).soLuongTon;
  const before = await stock();
  await page.goto("/inventory");
  await expect(page.locator("#message")).toContainText("Sẵn sàng");
  await expect(page.locator("#adjustment-section")).toBeHidden();
  await page.locator('#receipt-form [name="note"]').fill("Browser Phase 3 receipt");
  await page.locator('#receipt-items [name="maSP"]').selectOption("93004");
  await page.locator('#receipt-items [name="maSize"]').selectOption("92901");
  await page.locator('#receipt-items [name="soLuongNhap"]').fill("3");
  await page.locator('#receipt-items [name="donGiaNhap"]').fill("100");
  const created = page.waitForResponse((response) => response.url().endsWith("/api/inventory/receipts") && response.request().method() === "POST");
  await page.locator("#save-receipt").click();
  const receipt = (await (await created).json()).data;
  await expect(page.locator("#message")).toContainText("Đã lưu phiếu nháp");
  expect(await stock()).toBe(before);
  const row = page.locator("#receipts tr").filter({ hasText: receipt.maPhieu });
  await row.getByRole("button", { name: "Ghi nhận nhập kho" }).click();
  await expect(page.locator("#message")).toContainText("Đã ghi nhận phiếu nhập");
  expect(await stock()).toBe(before + 3);
  const posted = await page.request.post(`/api/inventory/receipts/${receipt.maPhieuNhap}/post`, { headers: { Authorization: `Bearer ${login.token}` }, data: {} });
  expect((await posted.json()).data.duplicate).toBe(true);
  expect(await stock()).toBe(before + 3);
  await page.screenshot({ path: "test-results/phase3-receipt.png", fullPage: true });
  const admin = await (await page.request.post("/api/auth/login", { data: { email: "phase2-admin@example.test", password: "Phase2Test!" } })).json();
  const adjusted = await page.request.post("/api/inventory/adjustments", { headers: { Authorization: `Bearer ${admin.token}` }, data: {
    reason: "Browser fixture cleanup", idempotencyKey: require("node:crypto").randomUUID(), items: [{ maSP: 93004, maSize: 92901, delta: -3 }],
  } });
  expect(adjusted.ok()).toBeTruthy();
});
