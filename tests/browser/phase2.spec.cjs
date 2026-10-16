const { test, expect } = require("@playwright/test");

async function setup(page, { session, items } = {}) {
  page.on("dialog", (dialog) => dialog.dismiss());
  await page.addInitScript(({ session, items }) => {
    localStorage.setItem("user", JSON.stringify({ id: 7, ten: "QA", sdt: "0900000000", role: "user" }));
    localStorage.setItem("token", "browser-test-token");
    if (!localStorage.getItem("checkoutItems")) localStorage.setItem("checkoutItems", JSON.stringify(items || [
      { maSP: 17, maSize: 1, soLuongMua: 2, gia: 2500, tenSP: "QA product" },
    ]));
    if (session) localStorage.setItem("checkoutSession:7", JSON.stringify(session));
  }, { session, items });
  await page.route("**/api/**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    let data = [];
    if (pathname === "/api/orders/payment-methods") data = [
      { maPTTT: 71, tenPTTT: "COD", code: "COD" }, { maPTTT: 73, tenPTTT: "MOMO", code: "MOMO" },
    ];
    if (pathname === "/api/users/profile") data = { addresses: [{ tenDiaChi: "QA address", macDinh: 1 }] };
    await route.fulfill({ json: { success: true, data, ...data } });
  });
}

test("legacy redirect keeps unicode query, deep links reload, local assets load and traversal is rejected", async ({ page }) => {
  await page.route("**/api/**", (route) => route.fulfill({ json: { success: true, data: [] } }));
  await page.goto("/pages/search.html?keyword=%C3%A1o%20%C4%91%E1%BB%8F");
  await expect(page).toHaveURL(/\/search\?keyword=%C3%A1o%20%C4%91%E1%BB%8F/);
  for (const path of ["/products/17", "/order-success?maDonHang=42"]) {
    const response = await page.goto(path);
    expect(response.status()).toBe(200);
    expect((await page.reload()).status()).toBe(200);
    const sources = await page.locator('script[src^="/"], link[href^="/"]').evaluateAll((nodes) => nodes.map((node) => node.src || node.href));
    for (const source of sources) expect((await page.request.get(source)).status(), source).toBe(200);
  }
  expect((await page.request.get("/Asset/user.jpg")).status()).toBe(200);
  expect((await page.request.get("/backend/server.js")).status()).toBe(404);
});

test("checkout double click submits once, sends no price/total and uses payment method code with a non-3 id", async ({ page }) => {
  await setup(page);
  let creates = 0, submitted;
  await page.route("**/api/orders/create", async (route) => {
    creates++;
    submitted = route.request().postDataJSON();
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ json: { success: true, data: { maDonHang: 42, paymentStatus: "PENDING" } } });
  });
  await page.route("**/api/payments/momo/create", (route) => route.fulfill({ status: 502, json: { success: false, message: "Provider offline" } }));
  await page.goto("/checkout");
  await page.selectOption("#maPTTT", "73");
  await page.waitForFunction(() => document.querySelector("#diaChiGiaoHang").value === "QA address");
  await page.locator("#btnPlaceOrder").evaluate((button) => { button.click(); button.click(); });
  await expect(page.locator("#btnPlaceOrder")).toBeEnabled();
  expect(creates).toBe(1);
  expect(submitted.maPTTT).toBe(73);
  expect(submitted).not.toHaveProperty("tongTien");
  expect(submitted.items[0]).not.toHaveProperty("gia");
  expect(submitted.idempotencyKey).toBeTruthy();
  expect(JSON.parse(await page.evaluate(() => localStorage.getItem("checkoutSession:7"))).orderId).toBe(42);
});

test("lost create response retries with the same idempotency key and finishes COD", async ({ page }) => {
  await setup(page);
  const keys = [];
  await page.route("**/api/orders/create", async (route) => {
    keys.push(route.request().postDataJSON().idempotencyKey);
    if (keys.length === 1) await route.abort("failed");
    else await route.fulfill({ json: { success: true, data: { maDonHang: 42, paymentStatus: "NOT_REQUIRED" } } });
  });
  await page.goto("/checkout");
  await page.waitForFunction(() => document.querySelector("#diaChiGiaoHang").value === "QA address");
  await page.locator("#btnPlaceOrder").click();
  await expect(page.locator("#btnPlaceOrder")).toBeEnabled();
  await page.locator("#btnPlaceOrder").click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
});

test("MoMo retry verifies ownership/status, rejects a foreign stored order and clears stale state", async ({ page }) => {
  await setup(page);
  let creates = 0;
  await page.route("**/api/orders/create", (route) => {
    creates++;
    return route.fulfill({ json: { success: true, data: { maDonHang: 42, paymentStatus: "PENDING" } } });
  });
  await page.route("**/api/payments/momo/create", (route) => route.fulfill({ status: 502, json: { success: false, message: "Offline" } }));
  await page.route("**/api/payments/momo/orders/42/status", (route) => route.fulfill({ status: 403, json: { success: false, message: "Foreign order" } }));
  await page.goto("/checkout");
  await page.selectOption("#maPTTT", "73");
  await page.waitForFunction(() => document.querySelector("#diaChiGiaoHang").value === "QA address");
  await page.locator("#btnPlaceOrder").click();
  await expect(page.locator("#btnPlaceOrder")).toBeEnabled();
  await page.locator("#btnPlaceOrder").click();
  await expect(page.locator("#btnPlaceOrder")).toBeEnabled();
  expect(creates).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("checkoutSession:7"))).toBeNull();
});

test("spoofed payment return resultCode=0 stays pending until authenticated API reports PAID", async ({ page }) => {
  await setup(page, { session: { orderId: 42 } });
  let paymentStatus = "PENDING";
  await page.route("**/api/payments/momo/orders/42/status", (route) => route.fulfill({ json: { success: true, data: { paymentStatus } } }));
  await page.goto("/order-success?maDonHang=42&resultCode=0");
  await expect(page.locator("#pending-view")).toBeVisible();
  await expect(page.locator("#success-view")).toBeHidden();
  paymentStatus = "PAID";
  await page.locator("#check-payment-button").click();
  await expect(page.locator("#success-view")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("checkoutItems"))).toBeNull();
});

test("real COD checkout prices on the server, consumes cart and records one order history", async ({ page }) => {
  test.skip(!/_test$/i.test(process.env.DB_NAME || ""), "Requires a dedicated seeded *_test database");
  const mysql = require("../../backend/node_modules/mysql2/promise");
  let userId;
  page.on("dialog", (dialog) => dialog.dismiss());
  try {
    const email = `browser-${Date.now()}@example.test`;
    expect((await page.request.post("/api/auth/register", { data: {
      ten: "Browser QA", email, sdt: "0900000000", matKhau: "BrowserQA123!",
    } })).ok()).toBeTruthy();
    const login = await (await page.request.post("/api/auth/login", { data: { email, password: "BrowserQA123!" } })).json();
    userId = login.user.id;
    const headers = { Authorization: `Bearer ${login.token}` };
    expect((await page.request.post("/api/users/address", { headers, data: { address: "Browser QA address" } })).ok()).toBeTruthy();
    expect((await page.request.post("/api/cart/add", { headers, data: { maSP: 93003, maSize: 92901, soLuong: 1 } })).ok()).toBeTruthy();
    const productBefore = await (await page.request.get("/api/products/93003")).json();
    const beforeStock = productBefore.data.product.sizes.find((size) => size.maSize === 92901).soLuongTon;
    await page.addInitScript(({ login }) => {
      localStorage.setItem("user", JSON.stringify(login.user));
      localStorage.setItem("token", login.token);
      localStorage.setItem("checkoutItems", JSON.stringify([
        { maSP: 93003, maSize: 92901, soLuongMua: 1, gia: 1, tenSP: "Fake client price" },
      ]));
    }, { login });
    await page.goto("/checkout");
    await page.fill("#sdt", "0900000000");
    await page.waitForFunction(() => document.querySelector("#diaChiGiaoHang").value === "Browser QA address");
    await expect(page.locator("#btnPlaceOrder")).toBeEnabled();
    await page.screenshot({ path: "test-results/checkout-e2e.png", fullPage: true });
    const created = page.waitForResponse((response) => response.url().endsWith("/api/orders/create"));
    await page.click("#btnPlaceOrder");
    const response = await created;
    expect(response.status()).toBe(201);
    const order = (await response.json()).data;
    expect(order.tongTien).toBe(3000);
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    const productAfter = await (await page.request.get("/api/products/93003")).json();
    expect(productAfter.data.product.sizes.find((size) => size.maSize === 92901).soLuongTon).toBe(beforeStock - 1);
    const cart = await (await page.request.get("/api/cart", { headers })).json();
    expect(cart.data.cart).toHaveLength(0);
    const history = await (await page.request.get(`/api/orders/${order.maDonHang}/history`, { headers })).json();
    expect(history.data).toHaveLength(1);
    expect(history.data[0].lyDo).toBe("ORDER_CREATED");
    expect((await page.request.put(`/api/orders/${order.maDonHang}/cancel`, { headers, data: {} })).ok()).toBeTruthy();
  } finally {
    if (userId) {
      const connection = await mysql.createConnection({ host: process.env.DB_HOST || "127.0.0.1", port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || "root", password: process.env.DB_PASSWORD || "", database: process.env.DB_NAME });
      try {
        await connection.execute("DELETE FROM DonHang WHERE id = ?", [userId]);
        await connection.execute("DELETE FROM users WHERE id = ?", [userId]);
      } finally { await connection.end(); }
    }
  }
});
