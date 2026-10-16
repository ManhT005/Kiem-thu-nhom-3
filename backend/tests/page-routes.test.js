import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import jwt from "jsonwebtoken";
import app from "../app.js";
import { SECRET_KEY } from "../config/config.js";
import { userLifecycleRepository } from "../repositories/user-lifecycle.repository.js";
import { mock } from "node:test";

let server;
let baseUrl;

before(async () => {
  mock.method(userLifecycleRepository, "findCurrentUser", async (id) => ({ id, role: "user", status: "ACTIVE", token_version: 0 }));
  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
    server.closeIdleConnections();
  });
});

test("canonical page routes serve their page shells", async () => {
  const routes = [
    "/",
    "/login",
    "/register",
    "/search?keyword=ao",
    "/products/1",
    "/cart",
    "/checkout",
    "/profile",
    "/orders",
    "/admin",
    "/staff",
    "/order-success",
  ];

  for (const route of routes) {
    const response = await fetch(`${baseUrl}${route}`);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("content-type"), /text\/html/, route);
  }
});

test("order success actions navigate to canonical page routes", async () => {
  const response = await fetch(`${baseUrl}/order-success`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(html, /href="\/" class="btn btn-success"/);
  assert.match(html, /href="\/checkout" class="btn btn-fail"/);
  assert.match(html, /href="\/" class="btn btn-home"/);

  for (const route of ["/", "/checkout"]) {
    const targetResponse = await fetch(`${baseUrl}${route}`);
    assert.equal(targetResponse.status, 200, route);
  }
});

test("legacy page URLs redirect and private HTML is not served directly", async () => {
  for (const [route, target] of [
    ["/html/login.html", "/login"],
    ["/html/admin.html", "/admin"],
    ["/html/productDetail.html?id=17", "/products/17"],
    ["/html/orders.html", "/orders"],
    ["/pages/search.html?keyword=ao", "/search?keyword=ao"],
    ["/html/orderSuccess.html?maDonHang=42&resultCode=0", "/order-success?maDonHang=42&resultCode=0"],
    ["/html/productDetail.html?id=17&source=search", "/products/17?source=search"],
    ["/html/login.html?next=%2Fcart", "/login?next=%2Fcart"],
  ]) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    assert.equal(response.status, 301, route);
    assert.equal(response.headers.get("location"), target, route);
  }

  const response = await fetch(`${baseUrl}/html/unknown.html`);
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Không tìm thấy trang/);
});

test("unknown APIs return JSON; invalid products and traversal never serve private files", async () => {
  const response = await fetch(`${baseUrl}/api/unknown`);
  assert.equal(response.status, 404);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.equal((await response.json()).success, false);
  for (const route of ["/products/no-id", "/js/%2e%2e%2f%2e%2e%2fbackend%2fserver.js", "/.env", "/backend/server.js"]) {
    assert.equal((await fetch(`${baseUrl}${route}`)).status, 404, route);
  }
  const search = await fetch(`${baseUrl}/pages/search.html?keyword=%C3%A1o%20%C4%91%E1%BB%8F`, { redirect: "manual" });
  assert.equal(search.headers.get("location"), "/search?keyword=%C3%A1o%20%C4%91%E1%BB%8F");
});

test("assets remain public and unknown paths return the page 404", async () => {
  for (const assetPath of ["/css/home.css", "/js/Header.js", "/Asset/user.jpg"]) {
    const assetResponse = await fetch(`${baseUrl}${assetPath}`);
    assert.equal(assetResponse.status, 200, assetPath);
  }

  const missingResponse = await fetch(`${baseUrl}/nonexistent`);
  assert.equal(missingResponse.status, 404);
  assert.match(await missingResponse.text(), /Không tìm thấy trang/);
});

test("MoMo IPN endpoint rejects invalid signatures", async () => {
  const invalidResponse = await fetch(`${baseUrl}/api/payments/momo/ipn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ signature: "invalid" }),
  });
  assert.equal(invalidResponse.status, 400);
});

test("MoMo payment creation requires authentication and an order id", async () => {
  const unauthenticated = await fetch(`${baseUrl}/api/payments/momo/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: 1 }),
  });
  assert.equal(unauthenticated.status, 401);

  const token = jwt.sign({ id: 7, role: "user", token_version: 0 }, SECRET_KEY);
  const clientAmountOnly = await fetch(`${baseUrl}/api/payments/momo/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount: 1 }),
  });
  assert.equal(clientAmountOnly.status, 400);
});
