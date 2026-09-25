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
    productList.innerHTML = "";

    products.forEach((p) => {
      const div = document.createElement("div");
      div.className = "product-card";

      const imgSrc = p.anhSP ? `/Asset/${p.anhSP}` : "/Asset/no-image.jpg";
      div.innerHTML = `
        <img src="${imgSrc}" class="product-img" alt="${p.tenSP}">
        <h3>${p.tenSP}</h3>
        <p>${Number(p.gia).toLocaleString()} VND</p>
      `;

      // CLICK → TRANG CHI TIẾT
      div.addEventListener("click", () => {
        window.location.href = `/html/productDetail.html?id=${p.maSP}`;
      });

      productList.appendChild(div);
    });
  }

  loadProducts();
});
