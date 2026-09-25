document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const currentUser = JSON.parse(localStorage.getItem("user"));

  if (!token || !currentUser) {
    alert("Bạn chưa đăng nhập!");
    window.location.href = "/html/login.html";
    return;
  }

  if (currentUser.role !== "admin") {
    alert("Bạn không có quyền truy cập trang này!");
    window.location.href = "/html/index.html";
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
    window.location.href = "/html/index.html";
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
        window.location.href = "/html/login.html";
        return null;
      }

      return await res.json();
    } catch (err) {
      console.error("Fetch Error:", err);
      return { error: true, message: "Lỗi kết nối server" };
    }
  }

  // ------------------- RENDER USERS -------------------
  async function renderUsers() {
    const data = await fetchAPI("users");
    if (!data || data.error) {
      alert("Không thể tải danh sách người dùng");
      return;
    }

    const users = data.users || [];
    const tbody = document.querySelector("#userTable tbody");
    tbody.innerHTML = "";

    users.forEach((u) => {
      const tr = document.createElement("tr");

      const isCurrentUser = u.id === currentUser.id;
      const isAdmin = u.role === "admin";

      // Tạo dropdown role
      const roleOptions = isAdmin
        ? '<span style="font-weight: bold; color: #e91e63;">admin</span>'
        : `<select class="role-select" data-id="${u.id}">
             <option value="user" ${u.role === "user" ? "selected" : ""}>user</option>
             <option value="staff" ${u.role === "staff" ? "selected" : ""}>staff</option>
           </select>`;

      tr.innerHTML = `
        <td>${u.id}</td>
        <td>${u.ten}</td>
        <td>${u.email}</td>
        <td>${roleOptions}</td>
        <td>
          ${
            !isCurrentUser && !isAdmin
              ? `<button class="action-btn delete-btn" data-id="${u.id}">Xóa</button>`
              : '<span style="color: #999">-</span>'
          }
        </td>
      `;

      tbody.appendChild(tr);
    });

    // Thêm event listener cho role select
    document.querySelectorAll(".role-select").forEach((select) => {
      select.addEventListener("change", async (e) => {
        const userId = e.target.dataset.id;
        const newRole = e.target.value;

        if (confirm(`Bạn có chắc muốn thay đổi quyền thành "${newRole}"?`)) {
          await updateUserRole(userId, newRole);
        } else {
          // Khôi phục giá trị cũ nếu cancel
          renderUsers();
        }
      });
    });

    // Thêm event listener cho nút xóa
    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const userId = e.target.dataset.id;
        if (confirm("Bạn có chắc muốn xóa người dùng này?")) {
          await deleteUser(userId);
        }
      });
    });
  }

  // ------------------- XÓA USER -------------------
  async function deleteUser(userId) {
    const data = await fetchAPI(`users/${userId}`, {
      method: "DELETE",
    });

    if (data && !data.error) {
      alert(data.message || "Xóa người dùng thành công!");
      renderUsers();
    } else {
      alert(data?.message || "Lỗi khi xóa người dùng");
    }
  }

  // ------------------- CẬP NHẬT ROLE -------------------
  async function updateUserRole(userId, role) {
    const data = await fetchAPI(`users/${userId}/role`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (data && !data.error) {
      alert(data.message || "Cập nhật quyền thành công!");
      renderUsers();
    } else {
      alert(data?.message || "Lỗi khi cập nhật quyền");
      renderUsers(); // Reload để khôi phục UI
    }
  }

  // ------------------- RENDER ORDERS -------------------
  async function renderOrders() {
    const data = await fetchAPI("orders");
    if (!data || data.error) return;

    const orders = data.orders || [];
    const tbody = document.querySelector("#orderTable tbody");
    tbody.innerHTML = "";

    if (orders.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center">Chưa có đơn hàng</td></tr>';
      return;
    }

    orders.forEach((o) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${o.id}</td>
        <td>${o.user_name || "N/A"}</td>
        <td>${o.status || "Đang xử lý"}</td>
        <td>${o.date || "N/A"}</td>
        <td><button class="action-btn edit-btn" data-id="${o.id}">Cập nhật</button></td>
      `;
      tbody.appendChild(tr);
    });
  }
  // ------------------- KHỞI TẠO -------------------
  renderUsers();
  renderOrders();
});
