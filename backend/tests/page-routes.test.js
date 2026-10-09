import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import jwt from "jsonwebtoken";
import app from "../server.js";
import { SECRET_KEY } from "../config/config.js";

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
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

test("legacy page URLs redirect and private HTML is not served directly", async () => {
  for (const [route, target] of [
    ["/html/login.html", "/login"],
    ["/html/admin.html", "/admin"],
    ["/html/productDetail.html?id=17", "/products/17"],
    ["/html/orders.html", "/orders"],
    ["/pages/search.html?keyword=ao", "/search?keyword=ao"],
  ]) {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual" });
    assert.equal(response.status, 301, route);
    assert.equal(response.headers.get("location"), target, route);
  }

  const response = await fetch(`${baseUrl}/html/unknown.html`);
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Không tìm thấy trang/);
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

test("MoMo IPN endpoint rejects invalid signatures and acknowledges valid callbacks", async () => {
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

  const token = jwt.sign({ id: 7, role: "user" }, SECRET_KEY);
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