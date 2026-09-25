document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const savedTab = localStorage.getItem("currentStaffTab") || "tabKho";
  // 1. Kiểm tra đăng nhập
  if (!token) {
    alert("Bạn chưa đăng nhập!");
    window.location.href = "/html/login.html";
    return;
  }

  document.getElementById("staffName").innerText = user
    ? `Xin chào, ${user.ten}`
    : "Staff";

  // 2. Đăng xuất
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      window.location.href = "/html/index.html";
    });
  }

  // ================== QUẢN LÝ TAB ==================
  window.switchTab = function (tabId, element) {
    // 1. Lưu tab hiện tại vào localStorage
    localStorage.setItem("currentStaffTab", tabId);

    // Ẩn tất cả tab content
    document
      .querySelectorAll(".tab-content")
      .forEach((div) => (div.style.display = "none"));
    // Bỏ active sidebar
    document
      .querySelectorAll(".sidebar li")
      .forEach((li) => li.classList.remove("active"));

    // Hiện tab được chọn
    const tabElement = document.getElementById(tabId);
    if (tabElement) tabElement.style.display = "block";

    // Active class cho sidebar
    // Nếu có element (click chuột) thì dùng nó
    if (element) {
      element.classList.add("active");
    } else {
      // Nếu không (F5 refresh), tìm thẻ li trong sidebar có onclick chứa tabId này
      const sidebarItem = document.querySelector(
        `.sidebar li[onclick*="'${tabId}'"]`,
      );
      if (sidebarItem) sidebarItem.classList.add("active");
    }

    // Load dữ liệu tương ứng
    if (tabId === "tabKho") renderKho();
    if (tabId === "tabDonHang") renderStaffOrders();
  };

  // ================== LOGIC KHO HÀNG ==================
  let currentEditingProductId = null;

  async function renderKho() {
    const searchInput = document.getElementById("searchInput");
    const search = searchInput ? searchInput.value : "";
    try {
      const res = await fetch(`/api/kho?search=${search}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      const tbody = document.querySelector("#khoTable tbody");
      tbody.innerHTML = "";

      if (!data.products || data.products.length === 0) {
        tbody.innerHTML =
          "<tr><td colspan='6' style='text-align:center'>Không tìm thấy sản phẩm</td></tr>";
        return;
      }

      data.products.forEach((sp) => {
        const imgSrc = sp.anhSP
          ? `../Asset/${sp.anhSP}`
          : "../Asset/no-image.jpg";

        let sizeSummary =
          '<span style="color:#999; font-style:italic;">Chưa có size</span>';
        if (sp.sizes && sp.sizes.length > 0) {
          sizeSummary = sp.sizes
            .map(
              (s) =>
                `<span class="size-badge">${s.tenSize}: <b>${s.soLuongTon}</b></span>`,
            )
            .join(" ");
        }

        const tr = document.createElement("tr");
        tr.innerHTML = `
                    <td>${sp.maSP}</td>
                    <td><img src="${imgSrc}" width="50" style="object-fit:cover; border-radius:4px;"></td>
                    <td>${sp.tenSP}</td>
                    <td style="font-weight:bold; color: #2ecc71;">${sp.tongTonKho}</td>
                    <td>${sizeSummary}</td>
                    <td><button class="edit-btn" style="cursor:pointer; padding:5px 10px;">Sửa kho</button></td>
                `;
        const editBtn = tr.querySelector(".edit-btn");
        editBtn.productData = sp;
        tbody.appendChild(tr);
      });
      attachEditEvents();
    } catch (err) {
      console.error(err);
    }
  }

  function attachEditEvents() {
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const sp = e.target.productData;
        currentEditingProductId = sp.maSP;
        const modal = document.getElementById("editModal");
        const container = document.getElementById("sizeInputsContainer");
        document.getElementById("modalTitle").innerText =
          `Cập nhật: ${sp.tenSP}`;

        container.innerHTML = "";
        if (sp.sizes) {
          sp.sizes.forEach((s) => {
            container.innerHTML += `
                            <div class="input-group-row">
                                <label>Size ${s.tenSize}</label>
                                <input type="number" class="qty-input" data-size-id="${s.maSize}" value="${s.soLuongTon}" min="0">
                            </div>`;
          });
        }
        modal.style.display = "block";
      });
    });
  }

  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", async () => {
      const inputs = document.querySelectorAll(
        "#sizeInputsContainer .qty-input",
      );
      const inventoryUpdate = Array.from(inputs).map((inp) => ({
        maSize: parseInt(inp.dataset.sizeId),
        soLuong: parseInt(inp.value) || 0,
      }));

      try {
        const res = await fetch(`/api/kho/${currentEditingProductId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ inventory: inventoryUpdate }),
        });
        if (res.ok) {
          alert("Cập nhật thành công!");
          document.getElementById("editModal").style.display = "none";
          renderKho();
        } else {
          alert("Lỗi cập nhật");
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  document.getElementById("closeModal").onclick = () =>
    (document.getElementById("editModal").style.display = "none");
  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.onclick = () => renderKho();

  // ================== LOGIC ĐƠN HÀNG (ĐÃ SỬA NGÀY GIỜ) ==================

  async function renderStaffOrders() {
    const tbody = document.getElementById("orderTableBody");
    tbody.innerHTML = "<tr><td colspan='6'>Đang tải...</td></tr>";

    try {
      // FIX: Đúng đường dẫn API (bỏ /manage)
      const res = await fetch("/api/orders/all", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orders = await res.json();

      tbody.innerHTML = "";
      if (!orders || orders.length === 0) {
        tbody.innerHTML =
          "<tr><td colspan='6' style='text-align:center'>Chưa có đơn hàng nào</td></tr>";
        return;
      }

      orders.forEach((order) => {
        const tr = document.createElement("tr");

        const itemsHtml = order.items
          .map(
            (i) =>
              `<div style="font-size:13px;">- ${i.tenSP} (${i.tenSize}) x${i.soLuongMua}</div>`,
          )
          .join("");

        const statusSelect = `
                    <select onchange="updateStatus(${order.maDonHang}, this.value)" 
                            class="status-select status-${getStatusClass(order.trangThai)}"
                            ${
                              order.trangThai === "Đã hủy" ||
                              order.trangThai === "Hoàn thành"
                                ? "disabled"
                                : ""
                            }>
                        <option value="Chờ xác nhận" ${order.trangThai === "Chờ xác nhận" ? "selected" : ""}>Chờ xác nhận</option>
                        <option value="Đang xử lý" ${order.trangThai === "Đang xử lý" ? "selected" : ""}>Đang xử lý</option>
                        <option value="Đang giao" ${order.trangThai === "Đang giao" ? "selected" : ""}>Đang giao</option>
                        <option value="Hoàn thành" ${order.trangThai === "Hoàn thành" ? "selected" : ""}>Hoàn thành</option>
                        <option value="Đã hủy" ${order.trangThai === "Đã hủy" ? "selected" : ""}>Hủy đơn</option>
                    </select>
                `;

        // [Thay đổi ở đây]: toLocaleString() thay vì toLocaleDateString()
        const formattedDate = new Date(order.ngayDat).toLocaleString("vi-VN");

        tr.innerHTML = `
                    <td>#${order.maDonHang}</td>
                    <td>
                        <b>${order.tenNguoiNhan}</b><br>
                        <small>${order.sdt}</small><br>
                        <small style="color:#777; font-style:italic;">${order.diaChiGiaoHang}</small>
                    </td>
                    <td>${formattedDate}</td> 
                    <td>${itemsHtml}</td>
                    <td style="color:red; font-weight:bold;">${Number(order.tongTien).toLocaleString("vi-VN")} đ</td>
                    <td>${statusSelect}</td>
                `;
        tbody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      tbody.innerHTML = "<tr><td colspan='6'>Lỗi tải dữ liệu</td></tr>";
    }
  }

  function getStatusClass(status) {
    switch (status) {
      case "Chờ xác nhận":
        return "pending";
      case "Đang xử lý":
        return "processing";
      case "Đang giao":
        return "shipping";
      case "Hoàn thành":
        return "completed";
      case "Đã hủy":
        return "cancelled";
      default:
        return "";
    }
  }

  window.updateStatus = async function (orderId, newStatus) {
    if (newStatus === "Đã hủy") {
      if (
        !confirm("Hủy đơn hàng sẽ hoàn lại số lượng tồn kho. Bạn có chắc chắn?")
      ) {
        renderStaffOrders();
        return;
      }
    }

    try {
      // FIX: Đúng đường dẫn API (bỏ /manage)
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ trangThai: newStatus }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        renderStaffOrders();
      } else {
        alert("Lỗi: " + data.message);
      }
    } catch (err) {
      console.error(err);
      alert("Lỗi kết nối server");
    }
  };

  renderKho();

  switchTab(savedTab);
});
