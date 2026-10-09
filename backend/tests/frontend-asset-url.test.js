import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const assetUrlSource = readFileSync(
  new URL("../../frontend/js/assetUrl.js", import.meta.url),
  "utf8",
);

function createSafeAssetUrl() {
  const window = {};
  runInNewContext(assetUrlSource, { window });
  return window.safeAssetUrl;
}

test("safeAssetUrl allows image filenames and rejects paths or active URLs", () => {
  const safeAssetUrl = createSafeAssetUrl();

  assert.equal(safeAssetUrl("banner.jpg"), "/Asset/banner.jpg");
  assert.equal(safeAssetUrl("product_1.webp"), "/Asset/product_1.webp");
  for (const filename of [
    "../secret.jpg",
    "/uploads/product.jpg",
    "javascript:alert(1)",
    "image.svg",
    null,
  ]) {
    assert.equal(safeAssetUrl(filename), "/Asset/user.jpg", String(filename));
  }
});
