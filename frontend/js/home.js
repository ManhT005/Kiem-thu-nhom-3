// home.js
document.addEventListener("DOMContentLoaded", () => {
  const productList = document.getElementById("productList");
  let allProducts = [];

  // ---------------- LOAD PRODUCTS ----------------
  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) return;
      const data = await res.json();
      allProducts = data.products;
      renderProducts(allProducts);
    } catch (err) {
      console.error("❌ Lỗi:", err);
    }
  }

  function renderProducts(products) {
    if (!productList) return;
    productList.replaceChildren();

    products.forEach((p) => {
      const productId = Number(p.maSP);
      if (!Number.isSafeInteger(productId) || productId < 1) return;
      const div = document.createElement("div");
      div.className = "product-card";

      const image = document.createElement("img");
      image.src = window.safeAssetUrl(p.anhSP);
      image.className = "product-img";
      image.alt = String(p.tenSP ?? "");
      const title = document.createElement("h3");
      title.textContent = String(p.tenSP ?? "");
      const price = document.createElement("p");
      price.textContent = `${Number(p.gia).toLocaleString()} VND`;
      div.append(image, title, price);

      // CLICK → TRANG CHI TIẾT
      div.addEventListener("click", () => {
        window.location.href = `/products/${productId}`;
      });

      productList.appendChild(div);
    });
  }

  loadProducts();
});
