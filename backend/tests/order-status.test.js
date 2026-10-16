import test from "node:test";
import assert from "node:assert/strict";
import {
  isOrderStatus,
  isOrderTransitionAllowed,
  ORDER_STATUS,
} from "../domain/order-status.js";

const allowedTransitions = [
  [ORDER_STATUS.PENDING, ORDER_STATUS.CONFIRMED],
  [ORDER_STATUS.PENDING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED, ORDER_STATUS.SHIPPING],
  [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPING, ORDER_STATUS.COMPLETED],
];

const deniedTransitions = [
  [ORDER_STATUS.SHIPPING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CANCELLED, ORDER_STATUS.COMPLETED],
  [ORDER_STATUS.COMPLETED, ORDER_STATUS.PENDING],
  [ORDER_STATUS.PENDING, ORDER_STATUS.SHIPPING],
  [ORDER_STATUS.PENDING, ORDER_STATUS.PENDING],
];

test("allows only documented order transitions", () => {
  for (const [from, to] of allowedTransitions) {
    assert.equal(isOrderTransitionAllowed(from, to), true, `${from} -> ${to}`);
  }

  for (const [from, to] of deniedTransitions) {
    assert.equal(isOrderTransitionAllowed(from, to), false, `${from} -> ${to}`);
  }
});

test("recognizes only known order statuses", () => {
  for (const status of Object.values(ORDER_STATUS)) {
    assert.equal(isOrderStatus(status), true);
  }

  assert.equal(isOrderStatus("unknown"), false);
});
