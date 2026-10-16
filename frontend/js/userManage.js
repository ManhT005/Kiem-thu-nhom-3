document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("user"));

  if (!token || !currentUser) {
    alert("Bạn chưa đăng nhập!");
    window.location.href = "/login";
    return;
  }

  if (currentUser.role !== "admin") {
    alert("Bạn không có quyền truy cập trang này!");
    window.location.href = "/";
    return;
  }

  const tabs = document.querySelectorAll(".sidebar ul li");
  const tabContents = document.querySelectorAll(".tab-content");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminName = document.getElementById("adminName");

  if (adminName) {
    adminName.textContent = currentUser.ten || "Admin";
  }

  // ------------------- CHUYỂN TAB -------------------
  // Mặc định khi F5: Active tab đầu tiên (Users) và ẩn các tab khác
  const defaultTab = "users";

  // Reset trạng thái hiển thị khi load trang
  tabs.forEach((t) => t.classList.remove("active"));
  tabContents.forEach((tc) => (tc.style.display = "none"));

  // Kích hoạt tab mặc định (Users)
  document
    .querySelector(`.sidebar ul li[data-tab="${defaultTab}"]`)
    .classList.add("active");
  document.getElementById(defaultTab).style.display = "block";

  // Xử lý sự kiện click chuyển tab
  tabs.forEach((tab) => {
    if (!tab.querySelector("button")) {
      tab.tabIndex = 0;
      tab.setAttribute("role", "button");
      tab.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          tab.click();
        }
      });
    }
    tab.addEventListener("click", () => {
      // 1. Xóa active cũ
      tabs.forEach((t) => t.classList.remove("active"));
      tabContents.forEach((tc) => (tc.style.display = "none"));

      // 2. Active tab được nhấn
      tab.classList.add("active");
      const target = tab.dataset.tab;
      document.getElementById(target).style.display = "block";

      // 3. Nếu chuyển sang tab sản phẩm hoặc danh mục thì load lại dữ liệu cho mới
      if (target === "products" && typeof renderProducts === "function") {
        renderProducts();
      }
      if (target === "categories" && typeof renderCategories === "function") {
        renderCategories();
      }
    });
  });

  // ------------------- LOGOUT -------------------
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("checkoutSession:")) localStorage.removeItem(key);
    }
    localStorage.removeItem("checkoutItems");
    localStorage.removeItem("pendingMomoOrderId");
    window.location.href = "/";
  });

  // ------------------- FETCH API (có token) -------------------
  async function fetchAPI(endpoint, options = {}) {
    try {
      const res = await fetch(`/api/${endpoint}`, {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401 || res.status === 403) {
        alert("Phiên đăng nhập hết hạn hoặc không có quyền!");
        localStorage.clear();
        window.location.href = "/login";
        return null;
      }

      return await res.json();
    } catch (err) {
      console.error("Fetch Error:", err);
      return { error: true, message: "Lỗi kết nối server" };
    }
  }

  let userPage = 1;
  const message = document.getElementById("user-message");
  const tell = (text, error = false) => {
    message.textContent = text;
    message.style.color = error ? "#a22120" : "#075d8c";
  };
  async function renderUsers() {
    const query = new URLSearchParams({ page: userPage, limit: 20 });
    for (const [name, id] of [
      ["search", "user-search"],
      ["status", "user-status"],
      ["role", "user-role"],
    ]) {
      const value = document.getElementById(id).value.trim();
      if (value) query.set(name, value);
    }
    const result = await fetchAPI("admin/users?" + query);
    if (!result || result.error || !result.success) {
      tell(result?.message || "Không thể tải tài khoản", true);
      return;
    }
    const data = result.data;
    const tbody = document.querySelector("#userTable tbody");
    tbody.replaceChildren();
    for (const user of data.items) {
      const row = document.createElement("tr");
      const cell = (value) => {
        const element = document.createElement("td");
        element.textContent = String(value);
        row.append(element);
        return element;
      };
      cell(user.id);
      cell(user.ten);
      cell(user.email);
      const roleCell = cell("");
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Quyền của ${user.ten}`);
      for (const role of ["user", "staff", "admin"]) {
        const option = document.createElement("option");
        option.value = role;
        option.textContent = role;
        select.append(option);
      }
      select.value = user.role;
      select.disabled = Number(user.id) === Number(currentUser.id);
      roleCell.append(select);
      cell(user.status === "ACTIVE" ? "Hoạt động" : "Đã khóa");
      const actions = cell("");
      const button = document.createElement("button");
      button.type = "button";
      button.textContent =
        user.status === "ACTIVE" ? "Khóa tài khoản" : "Mở khóa";
      button.disabled = Number(user.id) === Number(currentUser.id);
      actions.append(button);
      async function change(operation, control, extra = {}) {
        const reason = document.getElementById("user-reason").value.trim();
        if (!reason) {
          tell("Nhập lý do trước khi thay đổi tài khoản.", true);
          document.getElementById("user-reason").focus();
          select.value = user.role;
          return;
        }
        if (
          !confirm("Thay đổi này sẽ yêu cầu tài khoản đăng nhập lại. Tiếp tục?")
        ) {
          select.value = user.role;
          return;
        }
        control.disabled = true;
        control.setAttribute("aria-busy", "true");
        tell("Đang cập nhật tài khoản...");
        try {
          const response = await fetchAPI(
            `admin/users/${user.id}/${operation}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason, ...extra }),
            },
          );
          if (!response?.success)
            tell(response?.message || "Không thể cập nhật tài khoản", true);
          else
            tell("Đã cập nhật tài khoản. Phiên đăng nhập cũ đã hết hiệu lực.");
          await renderUsers();
        } finally {
          control.disabled = false;
          control.removeAttribute("aria-busy");
        }
      }
      button.onclick = () =>
        change(user.status === "ACTIVE" ? "lock" : "unlock", button);
      select.onchange = () => change("role", select, { role: select.value });
      tbody.append(row);
    }
    document.getElementById("user-page").textContent =
      `Trang ${userPage} / ${Math.max(1, data.pagination.totalPages)}`;
    document.getElementById("user-prev").disabled = userPage === 1;
    document.getElementById("user-next").disabled =
      userPage >= data.pagination.totalPages;
  }
  document.getElementById("user-filter").onsubmit = (event) => {
    event.preventDefault();
    userPage = 1;
    renderUsers();
  };
  document.getElementById("user-prev").onclick = () => {
    userPage--;
    renderUsers();
  };
  document.getElementById("user-next").onclick = () => {
    userPage++;
    renderUsers();
  };
  renderUsers();
});
