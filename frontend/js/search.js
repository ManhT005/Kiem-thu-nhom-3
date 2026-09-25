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
  searchTitle.innerText = `Kết quả tìm kiếm: "${keyword}"`;

  function goToSearch() {
    const kw = searchInput.value.trim();
    if (!kw) return;
    window.location.href = `/pages/search.html?keyword=${encodeURIComponent(
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
      p.tenSP.toLowerCase().includes(keyword.toLowerCase()),
    );

    searchResults.innerHTML = "";
    if (results.length === 0) {
      searchResults.innerHTML = `<p>Không tìm thấy sản phẩm cho "${keyword}"</p>`;
      return;
    }

    results.forEach((p) => {
      const div = document.createElement("div");
      div.className = "product-card";
      div.innerHTML = `
        <img src="${
          p.anhSP ? `/Asset/${p.anhSP}` : "/Asset/no-image.jpg"
        }" alt="${p.tenSP}">
        <h3>${p.tenSP}</h3>
        <p>${Number(p.gia).toLocaleString()} VND</p>
      `;
      div.addEventListener("click", () => {
        window.location.href = `/html/productDetail.html?id=${p.maSP}`;
      });
      searchResults.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    searchResults.innerHTML = "<p>Lỗi khi tải sản phẩm</p>";
  }
});
