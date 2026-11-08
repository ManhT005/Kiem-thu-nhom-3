const { test, expect } = require("@playwright/test");

const PASSWORD = "Phase2Test!";
const PRODUCT_ID = 93003;
const SIZE_ID = 92901;
let voucherSequence = 0;
let actors;

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

async function login(request, email) {
  const response = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  });
  expect(response.status(), `Login fixture ${email}`).toBe(200);
  const body = await response.json();
  expect(body.token).toBeTruthy();
  return body.token;
}

function newCode() {
  voucherSequence += 1;
  return `BB-${Date.now()}-${voucherSequence}`;
}

async function createVoucher(request, overrides = {}) {
  const code = overrides.code || newCode();
  const now = Date.now();
  const payload = {
    code,
    discountType: "FIXED",
    discountValue: 500,
    minimumOrderAmount: 0,
    startAt: new Date(now - 60_000).toISOString(),
    endAt: new Date(now + 86_400_000).toISOString(),
    usageLimit: 20,
    perUserLimit: 5,
    enabled: true,
    ...overrides,
  };
  const response = await request.post("/api/admin/vouchers", {
    headers: auth(actors.admin),
    data: payload,
  });
  return { code, payload, response };
}

async function preview(request, token, voucherCode, overrides = {}) {
  return request.post("/api/vouchers/validate", {
    headers: auth(token),
    data: {
      voucherCode,
      // Deliberately false client totals/prices: the server should price from
      // the product variant, not trust the values supplied by the caller.
      subtotal: 1,
      items: [{
        maSP: PRODUCT_ID,
        maSize: SIZE_ID,
        soLuongMua: 1,
        gia: 1,
      }],
      ...overrides,
    },
  });
}

async function expectApiError(response, status, code) {
  expect(response.status()).toBe(status);
  const body = await response.json();
  expect(body.code).toBe(code);
  return body;
}

test.beforeEach(async ({ request }) => {
  test.skip(
    !/_test$/i.test(process.env.DB_NAME || ""),
    "Black-box voucher tests require the isolated *_test database",
  );
  actors = {
    admin: await login(request, "phase2-admin@example.test"),
    staff: await login(request, "phase2-staff@example.test"),
    user: await login(request, "phase2-user-a@example.test"),
  };
});

test("BB-V-01: voucher preview requires authentication", async ({ request }) => {
  const response = await request.post("/api/vouchers/validate", {
    data: { voucherCode: "BB-MISSING", items: [{ maSP: PRODUCT_ID, maSize: SIZE_ID, soLuongMua: 1 }] },
  });
  await expectApiError(response, 401, "UNAUTHORIZED");
});

test("BB-V-02: staff cannot preview a customer voucher", async ({ request }) => {
  const response = await preview(request, actors.staff, "BB-STAFF-01");
  await expectApiError(response, 403, "FORBIDDEN");
});

test("BB-V-03: a customer cannot create an administrative voucher", async ({ request }) => {
  const response = await request.post("/api/admin/vouchers", {
    headers: auth(actors.user),
    data: { code: newCode() },
  });
  await expectApiError(response, 403, "FORBIDDEN");
});

test("BB-V-04: staff cannot create an administrative voucher", async ({ request }) => {
  const response = await request.post("/api/admin/vouchers", {
    headers: auth(actors.staff),
    data: { code: newCode() },
  });
  await expectApiError(response, 403, "FORBIDDEN");
});

test("BB-V-05: a missing voucher code is rejected as invalid input", async ({ request }) => {
  const response = await request.post("/api/vouchers/validate", {
    headers: auth(actors.user),
    data: { items: [{ maSP: PRODUCT_ID, maSize: SIZE_ID, soLuongMua: 1 }] },
  });
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-06: a syntactically invalid voucher code is rejected", async ({ request }) => {
  const response = await preview(request, actors.user, "bad code!");
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-07: a well-formed but unknown voucher returns not found", async ({ request }) => {
  const response = await preview(request, actors.user, newCode());
  await expectApiError(response, 404, "VOUCHER_NOT_FOUND");
});

test("BB-V-08: an empty item list is rejected", async ({ request }) => {
  const response = await preview(request, actors.user, "BB-ITEM-01", { items: [] });
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-09: a zero purchase quantity is rejected", async ({ request }) => {
  const response = await preview(request, actors.user, "BB-ITEM-02", {
    items: [{ maSP: PRODUCT_ID, maSize: SIZE_ID, soLuongMua: 0 }],
  });
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-10: an unknown product-size combination returns not found", async ({ request }) => {
  const response = await preview(request, actors.user, "BB-ITEM-03", {
    items: [{ maSP: 99999999, maSize: SIZE_ID, soLuongMua: 1 }],
  });
  await expectApiError(response, 404, "ORDER_VARIANT_NOT_FOUND");
});

test("BB-V-11: a duplicate product-size line is rejected", async ({ request }) => {
  const response = await preview(request, actors.user, "BB-ITEM-04", {
    items: [
      { maSP: PRODUCT_ID, maSize: SIZE_ID, soLuongMua: 1 },
      { maSP: PRODUCT_ID, maSize: SIZE_ID, soLuongMua: 1 },
    ],
  });
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-12: fixed discount is calculated from the server price, not client totals", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountValue: 500,
    minimumOrderAmount: 0,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.subtotalBeforeDiscount).toBe(3000);
  expect(data.discountAmount).toBe(500);
  expect(data.totalAfterDiscount).toBe(2500);
});

test("BB-V-13: the minimum-order boundary is inclusive at exactly 3000 VND", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountValue: 500,
    minimumOrderAmount: 3000,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.subtotalBeforeDiscount).toBe(3000);
  expect(data.discountAmount).toBe(500);
  expect(data.totalAfterDiscount).toBe(2500);
});

test("BB-V-14: a minimum order one VND above the subtotal is rejected", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountValue: 500,
    minimumOrderAmount: 3001,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  await expectApiError(response, 409, "MIN_ORDER_NOT_MET");
});

test("BB-V-15: fixed discount larger than the subtotal is capped at the subtotal", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountValue: 5000,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.subtotalBeforeDiscount).toBe(3000);
  expect(data.discountAmount).toBe(3000);
  expect(data.totalAfterDiscount).toBe(0);
});

test("BB-V-16: ten-percent discount produces the expected rounded VND value", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountType: "PERCENT",
    discountValue: 10,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.subtotalBeforeDiscount).toBe(3000);
  expect(data.discountAmount).toBe(300);
  expect(data.totalAfterDiscount).toBe(2700);
});

test("BB-V-17: maximum discount cap is applied to a percentage voucher", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountType: "PERCENT",
    discountValue: 50,
    maximumDiscountAmount: 100,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.discountAmount).toBe(100);
  expect(data.totalAfterDiscount).toBe(2900);
});

test("BB-V-18: one-hundred-percent discount is accepted at the upper boundary", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    discountType: "PERCENT",
    discountValue: 100,
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  expect(response.status()).toBe(200);
  const data = (await response.json()).data;
  expect(data.discountAmount).toBe(3000);
  expect(data.totalAfterDiscount).toBe(0);
});

test("BB-V-19: zero-percent discount is rejected when the voucher is created", async ({ request }) => {
  const { response } = await createVoucher(request, {
    discountType: "PERCENT",
    discountValue: 0,
  });
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-20: a percentage above one hundred is rejected when the voucher is created", async ({ request }) => {
  const { response } = await createVoucher(request, {
    discountType: "PERCENT",
    discountValue: 100.01,
  });
  await expectApiError(response, 400, "VALIDATION_ERROR");
});

test("BB-V-21: a voucher whose start time is in the future is not yet usable", async ({ request }) => {
  const now = Date.now();
  const { code, response: created } = await createVoucher(request, {
    startAt: new Date(now + 60_000).toISOString(),
    endAt: new Date(now + 86_400_000).toISOString(),
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  await expectApiError(response, 409, "VOUCHER_NOT_STARTED");
});

test("BB-V-22: an expired voucher is rejected", async ({ request }) => {
  const now = Date.now();
  const { code, response: created } = await createVoucher(request, {
    startAt: new Date(now - 86_400_000).toISOString(),
    endAt: new Date(now - 60_000).toISOString(),
  });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  await expectApiError(response, 409, "VOUCHER_EXPIRED");
});

test("BB-V-23: a disabled voucher cannot be applied", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, { enabled: false });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  await expectApiError(response, 409, "VOUCHER_DISABLED");
});

test("BB-V-24: a voucher with a zero global usage limit is exhausted", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, { usageLimit: 0 });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  await expectApiError(response, 409, "VOUCHER_USAGE_LIMIT");
});

test("BB-V-25: a voucher with a zero per-user limit is unavailable to every user", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, { perUserLimit: 0 });
  expect(created.status()).toBe(201);

  const response = await preview(request, actors.user, code);
  await expectApiError(response, 409, "VOUCHER_USER_LIMIT");
});

test("BB-V-26: repeated preview requests do not consume voucher usage", async ({ request }) => {
  const { code, response: created } = await createVoucher(request, {
    usageLimit: 1,
    perUserLimit: 1,
  });
  expect(created.status()).toBe(201);

  for (let index = 0; index < 3; index += 1) {
    const response = await preview(request, actors.user, code);
    expect(response.status()).toBe(200);
  }

  const usage = await request.get(`/api/admin/vouchers?code=${encodeURIComponent(code)}`, {
    headers: auth(actors.admin),
  });
  expect(usage.status()).toBe(200);
  const body = (await usage.json()).data;
  expect(body.items).toHaveLength(1);
  expect(body.items[0].used_count).toBe(0);
});
