// frontend/js/Header.js
document.addEventListener("DOMContentLoaded", () => {
  // ---------------- 1. TỰ ĐỘNG TẠO NAVIGATION BAR & MENU CẤP 2 ----------------
  const header = document.querySelector(".header");
  const logo = document.getElementById("logo");

  // Kiểm tra xem header và logo có tồn tại không để chèn menu vào giữa
  if (header && logo && !document.querySelector(".navbar")) {
    const navHTML = `
      <nav class="navbar">
        <ul class="nav-links">
          <li><a href="/html/index.html">Trang chủ</a></li>
          
          <li class="nav-item-dropdown">
            <a href="/html/search.html?keyword=Áo">Áo ▾</a>
            <ul class="dropdown-content">
              <li><a href="/html/search.html?keyword=Áo sơ mi">Áo sơ mi</a></li>
              <li><a href="/html/search.html?keyword=Áo phông">Áo phông</a></li>
              <li><a href="/html/search.html?keyword=Áo thun">Áo thun</a></li>
              <li><a href="/html/search.html?keyword=Áo khoác">Áo khoác</a></li>
            </ul>
          </li>

          <li class="nav-item-dropdown">
            <a href="/html/search.html?keyword=Quần">Quần ▾</a>
            <ul class="dropdown-content">
              <li><a href="/html/search.html?keyword=Quần ngố bò">Quần ngố bò</a></li>
              <li><a href="/html/search.html?keyword=Quần jean">Quần jean</a></li>
              <li><a href="/html/search.html?keyword=Quần âu">Quần âu</a></li>
            </ul>
          </li>

          <li><a href="#">Giới thiệu</a></li>
          <li><a href="#footer-contact" id="contactLink">Liên hệ</a></li>
        </ul>
      </nav>
    `;
    // Chèn Navigation Bar ngay sau Logo
    logo.insertAdjacentHTML("afterend", navHTML);
  }

  // Xử lý sự kiện click cho nút "Liên hệ" vừa tạo động
  const contactLink = document.getElementById("contactLink");
  contactLink?.addEventListener("click", (e) => {
    e.preventDefault();
    const footer = document.getElementById("footer-contact"); // Đảm bảo footer có id này
    if (footer) footer.scrollIntoView({ behavior: "smooth" });
  });

  // ---------------- 2. LOGIC CŨ (ĐĂNG NHẬP/GIỎ HÀNG...) ----------------
  const loginBtn = document.getElementById("loginBtn");
  const registerBtn = document.getElementById("registerBtn");
  const userMenu = document.getElementById("userMenu");
  const userName = document.getElementById("userName");
  const dropdownMenu = document.getElementById("dropdownMenu"); // Menu User
  const logoutBtn = document.getElementById("logoutBtn");
  const cartBtn = document.getElementById("cartBtn");
  const cartCount = document.getElementById("cartCount");
  const searchInput = document.getElementById("searchInput");
  const searchBtn = document.getElementById("searchBtn");

  // --- Nút Đăng nhập / Đăng ký ---
  loginBtn?.addEventListener("click", () => {
    window.location.href = "/html/login.html";
  });

  registerBtn?.addEventListener("click", () => {
    window.location.href = "/html/register.html";
  });

  // --- Update Header ---
  async function updateHeader() {
    const user = JSON.parse(localStorage.getItem("user"));
    const token = localStorage.getItem("token");

    if (user && token) {
      if (loginBtn) loginBtn.style.display = "none";
      if (registerBtn) registerBtn.style.display = "none";
      if (userMenu) userMenu.style.display = "flex";
      if (userName) userName.innerText = user.ten || user.username || "User";
      if (cartBtn) cartBtn.style.display = "flex";
      await updateCartCount();
    } else {
      if (loginBtn) loginBtn.style.display = "inline-block";
      if (registerBtn) registerBtn.style.display = "inline-block";
      if (userMenu) userMenu.style.display = "none";
      if (cartBtn) cartBtn.style.display = "none";
      if (cartCount) cartCount.innerText = 0;
    }
  }

  updateHeader();

  // --- Click User Menu ---
  userMenu?.addEventListener("click", (e) => {
    const token = localStorage.getItem("token");
    if (token) {
      window.location.href = "/html/profile.html";
    } else {
      window.location.href = "/html/login.html";
    }
    e.stopPropagation();
  });

  // --- Logout ---
  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("cart");
    alert("Đã đăng xuất!");
    window.location.href = "/html/login.html";
  });

  // --- Logo click ---
  logo?.addEventListener("click", () => {
    window.location.href = "/html/index.html";
  });

  // --- Cart click ---
  cartBtn?.addEventListener("click", () => {
    window.location.href = "/html/cart.html";
  });

  // --- Search ---
  function goToSearch() {
    const keyword = searchInput.value.trim();
    if (!keyword) return;
    window.location.href = `/html/search.html?keyword=${encodeURIComponent(keyword)}`;
  }
  searchBtn?.addEventListener("click", goToSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") goToSearch();
  });

  // --- Cart Count ---
  async function updateCartCount() {
    try {
      let total = 0;
      const token = localStorage.getItem("token");
      if (token) {
        const res = await fetch("/api/cart", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (data.cart) {
            total = data.cart.reduce((sum, item) => sum + item.soLuongMua, 0);
          } else if (Array.isArray(data)) {
            total = data.reduce((sum, item) => sum + item.soLuongMua, 0);
          }
        }
      } else {
        const cart = JSON.parse(localStorage.getItem("cart")) || [];
        total = cart.reduce((sum, item) => sum + item.quantity, 0);
      }
      if (cartCount) cartCount.innerText = total;
    } catch (err) {
      console.error(err);
      if (cartCount) cartCount.innerText = 0;
    }
  }

  window.updateHeaderCartCount = updateCartCount;
  window.addEventListener("storage", (e) => {
    if (e.key === "cart") updateCartCount();
  });
});
