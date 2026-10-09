document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const userMenu = document.getElementById("userMenu");
  const userAvatar = document.getElementById("userAvatar");
  const userName = document.getElementById("userName");
  const dropdownMenu = document.getElementById("dropdownMenu");
  const logoutBtn = document.getElementById("logoutBtn");
  const cartBtn = document.getElementById("cartBtn");
  const cartCount = document.getElementById("cartCount");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");
  const searchResults = document.getElementById("searchResults");
  const searchTitle = document.getElementById("searchTitle");

  // ================= SEARCH =================
  const urlParams = new URLSearchParams(window.location.search);
  const keyword = urlParams.get("keyword") || "";
  searchInput.value = keyword;
  searchTitle.textContent = `Kết quả tìm kiếm: "${keyword}"`;

  function goToSearch() {
    const kw = searchInput.value.trim();
    if (!kw) return;
    window.location.href = `/search?keyword=${encodeURIComponent(
      kw,
    )}`;
  }

  searchBtn.addEventListener("click", goToSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goToSearch();
    }
  });

  // ================= LOAD PRODUCTS =================
  try {
    const res = await fetch("/api/products");
    const data = await res.json();
    if (!res.ok) throw new Error("Không thể tải sản phẩm");

    const results = data.products.filter((p) =>
      String(p.tenSP ?? "").toLowerCase().includes(keyword.toLowerCase()),
    );

    searchResults.replaceChildren();
    if (results.length === 0) {
      const message = document.createElement("p");
      message.textContent = `Không tìm thấy sản phẩm cho "${keyword}"`;
      searchResults.appendChild(message);
      return;
    }

    results.forEach((p) => {
      const productId = Number(p.maSP);
      if (!Number.isSafeInteger(productId) || productId < 1) return;
      const productName = String(p.tenSP ?? "");
      const div = document.createElement("div");
      div.className = "product-card";
      const image = document.createElement("img");
      image.src = window.safeAssetUrl(p.anhSP);
      image.alt = productName;
      const title = document.createElement("h3");
      title.textContent = productName;
      const price = document.createElement("p");
      price.textContent = `${Number(p.gia).toLocaleString()} VND`;
      div.append(image, title, price);
      div.addEventListener("click", () => {
        window.location.href = `/products/${productId}`;
      });
      searchResults.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    const message = document.createElement("p");
    message.textContent = "Lỗi khi tải sản phẩm";
    searchResults.replaceChildren(message);
  }
});
