document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html";
    return;
  }

  fetchProfile(token);
  fetchOrders(token);

  document
    .getElementById("update-btn")
    .addEventListener("click", () => updateBasicInfo(token));

  // ================== [MỚI] KHÔI PHỤC TAB KHI F5 ==================

  const savedTab = localStorage.getItem("currentProfileTab") || "info";
  switchTab(savedTab);
});

async function fetchProfile(token) {
  try {
    const response = await fetch("/api/users/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json();

    if (response.ok) {
      document.getElementById("sidebar-username").innerText = data.username;
      document.getElementById("username").value = data.username;
      document.getElementById("email").value = data.email;
      document.getElementById("phone").value = data.phone;
      renderAddressList(data.addresses);
    }
  } catch (error) {
    console.error("Lỗi profile:", error);
  }
}

// HÀM HIỂN THỊ DANH SÁCH ĐỊA CHỈ (ĐÃ CẬP NHẬT)
function renderAddressList(addresses) {
  const listEl = document.getElementById("address-list");
  listEl.innerHTML = "";

  if (!addresses || addresses.length === 0) {
    listEl.innerHTML = "<li>Chưa có địa chỉ nào.</li>";
    return;
  }

  addresses.forEach((addr) => {
    const li = document.createElement("li");
    li.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;";

    // Kiểm tra xem có phải mặc định không (dựa vào cột macDinh trả về từ backend)
    const isDefault = addr.macDinh === 1;

    // Tạo nút hoặc Badge hiển thị trạng thái
    const statusHtml = isDefault
      ? `<span style="color: #28a745; font-size: 12px; border: 1px solid #28a745; padding: 2px 6px; border-radius: 4px; margin-right: 10px; font-weight: bold;">Mặc định</span>`
      : `<button onclick="setAddressDefault(${addr.maDiaChi})" style="font-size: 12px; color: #007bff; background: none; border: 1px solid #007bff; padding: 2px 6px; border-radius: 4px; cursor: pointer; margin-right: 10px;">Đặt làm mặc định</button>`;

    li.innerHTML = `
            <div style="display: flex; align-items: center;">
                <i class="fa-solid fa-map-marker-alt" style="color:#ee4d2d; margin-right:8px;"></i> 
                <span>${addr.tenDiaChi}</span>
            </div>
            <div style="display: flex; align-items: center;">
                ${statusHtml}
                <button onclick="removeAddress(${addr.maDiaChi})" style="background:none; border:none; color: red; cursor: pointer; margin-left: 5px;" title="Xóa">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    listEl.appendChild(li);
  });
}
// === [MỚI] HÀM GỌI API ĐẶT MẶC ĐỊNH ===
async function setAddressDefault(id) {
  const token = localStorage.getItem("token");
  try {
    // Gọi API PUT mà bạn vừa tạo ở backend
    const res = await fetch(`/api/users/address/${id}/default`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      alert("Đã thay đổi địa chỉ mặc định!");
      fetchProfile(token); // Tải lại danh sách để cập nhật giao diện ngay lập tức
    } else {
      const data = await res.json();
      alert(data.message || "Lỗi khi đặt mặc định");
    }
  } catch (err) {
    console.error(err);
    alert("Lỗi kết nối server");
  }
}

async function updateBasicInfo(token) {
  const username = document.getElementById("username").value;
  const phone = document.getElementById("phone").value;

  try {
    const res = await fetch("/api/users/profile", {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, phone }),
    });
    const result = await res.json();

    // --- SỬA TỪ ĐÂY ---
    if (res.ok) {
      // 1. Lấy thông tin user hiện tại từ localStorage
      let currentUser = JSON.parse(localStorage.getItem("user")) || {};

      // 2. Cập nhật thông tin mới
      // Lưu ý: Kiểm tra xem backend trả về key là "ten" hay "username" để gán cho đúng
      // Thường trong CSDL bạn dùng cột "ten", nên ở đây mình gán cả 2 cho chắc
      if (username) {
        currentUser.ten = username;
        currentUser.username = username;
      }
      if (phone) currentUser.sdt = phone;

      // 3. Lưu ngược lại vào localStorage
      localStorage.setItem("user", JSON.stringify(currentUser));

      // 4. Thông báo thành công
      alert("Cập nhật thông tin thành công!");

      // (Tùy chọn) Cập nhật luôn tên trên sidebar nếu có
      const sidebarName = document.getElementById("sidebar-username");
      if (sidebarName) sidebarName.innerText = username;
    } else {
      alert(result.message || "Lỗi cập nhật!");
    }
    // --- HẾT PHẦN SỬA ---
  } catch (err) {
    console.error(err);
    alert("Lỗi cập nhật!");
  }
}

async function addNewAddress() {
  const token = localStorage.getItem("token");
  const address = document.getElementById("new-address").value.trim();
  if (!address) return alert("Vui lòng nhập địa chỉ!");

  try {
    const res = await fetch("/api/users/address", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ address }),
    });

    if (res.ok) {
      alert("Thêm địa chỉ thành công!");
      document.getElementById("new-address").value = "";
      fetchProfile(token);
    } else {
      alert("Lỗi thêm địa chỉ");
    }
  } catch (err) {
    console.error(err);
  }
}

async function removeAddress(id) {
  if (!confirm("Bạn có chắc muốn xóa địa chỉ này?")) return;
  const token = localStorage.getItem("token");

  try {
    const res = await fetch(`/api/users/address/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      fetchProfile(token);
    } else {
      alert("Không thể xóa địa chỉ này.");
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchOrders(token) {
  const orderListDiv = document.getElementById("order-list");
  orderListDiv.innerHTML = "<p>Đang tải đơn hàng...</p>";

  try {
    const response = await fetch("/api/orders/my-orders", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || response.statusText);
    }

    const orders = await response.json();

    if (orders.length > 0) {
      orderListDiv.innerHTML = orders
        .map((order) => {
          const productsHtml = order.items
            .map(
              (item) => `
                    <div style="display: flex; gap: 15px; padding: 10px 0; border-top: 1px solid #f0f0f0;">
                        <img src="../Asset/${item.anhSP}" alt="${item.tenSP}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px; border: 1px solid #ddd;">
                        <div style="flex: 1;">
                            <div style="font-weight: 500; font-size: 14px;">${item.tenSP}</div>
                            <div style="font-size: 13px; color: #777;">
                                Phân loại: ${item.tenSize || "N/A"} | x${item.soLuongMua}
                            </div>
                            <div style="font-size: 14px; color: #ee4d2d; margin-top: 2px;">
                                ${Number(item.giaMua).toLocaleString("vi-VN")} đ
                            </div>
                        </div>
                    </div>
                `,
            )
            .join("");

          // [MỚI] Kiểm tra nếu đơn hàng "Chờ xác nhận" thì hiện nút Hủy
          let actionButton = "";
          if (order.trangThai === "Chờ xác nhận") {
            actionButton = `
                        <button onclick="cancelOrder(${order.maDonHang})" 
                                style="padding: 6px 12px; background: #fff; color: #555; border: 1px solid #ddd; border-radius: 4px; cursor: pointer; font-size: 13px; margin-left: 10px; transition: 0.2s;">
                            Hủy đơn hàng
                        </button>
                    `;
          }

          return `
                <div class="order-item" style="background: #fff; padding: 15px; margin-bottom: 15px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #eee;">
                    <div class="order-header" style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 5px;">
                        <div>
                            <strong>Đơn hàng #${order.maDonHang}</strong>
                            <br><span style="font-size: 12px; color: #888;">${new Date(order.ngayDat).toLocaleString("vi-VN")}</span>
                        </div>
                        <span class="status-badge" 
                              style="padding: 4px 8px; border-radius: 4px; font-size: 12px; height: fit-content; background: #e0f2f1; color: #00695c;">
                            ${order.trangThai}
                        </span>
                    </div>
                    
                    <div class="order-body">
                        ${productsHtml}
                    </div>

                    <div class="order-footer" style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #ddd; display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-size: 13px; color: #555;">Người nhận: ${order.tenNguoiNhan} (${order.sdt})</span>
                        <div style="display: flex; align-items: center;">
                            <div class="order-total" style="font-size: 15px; font-weight: bold; color: #ee4d2d; margin-right: 10px;">
                                Thành tiền: ${Number(order.tongTien).toLocaleString("vi-VN")} đ
                            </div>
                            ${actionButton}
                        </div>
                    </div>
                </div>
            `;
        })
        .join("");
    } else {
      orderListDiv.innerHTML =
        "<p style='text-align:center'>Bạn chưa có đơn hàng nào.</p>";
    }
  } catch (error) {
    console.error("Lỗi orders:", error);
    orderListDiv.innerHTML = `<p style='color:red; text-align:center;'>Có lỗi xảy ra: ${error.message}</p>`;
  }
}

// ================== [ĐÃ SỬA] LOGIC CHUYỂN TAB ==================
function switchTab(tabName) {
  // Lưu tab hiện tại vào localStorage
  localStorage.setItem("currentProfileTab", tabName);

  // Ẩn tất cả nội dung tab
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => (el.style.display = "none"));

  // Xóa active ở tất cả menu
  document
    .querySelectorAll(".profile-menu li")
    .forEach((el) => el.classList.remove("active"));

  // Hiện tab được chọn (dựa vào ID: tab-info hoặc tab-orders)
  const targetTab = document.getElementById(`tab-${tabName}`);
  if (targetTab) targetTab.style.display = "block";

  // Thêm class active cho menu item tương ứng
  // Tìm thẻ li có chứa hàm switchTab('tabName') trong onclick
  const activeLi = document.querySelector(
    `.profile-menu li[onclick*="'${tabName}'"]`,
  );
  if (activeLi) activeLi.classList.add("active");
}
// ================== [MỚI] HÀM HỦY ĐƠN HÀNG ==================
async function cancelOrder(orderId) {
  if (!confirm("Bạn có chắc chắn muốn hủy đơn hàng này không?")) return;

  const token = localStorage.getItem("token");
  if (!token) return alert("Vui lòng đăng nhập lại!");

  try {
    const res = await fetch(`/api/orders/${orderId}/status`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ trangThai: "Đã hủy" }),
    });

    const data = await res.json();

    if (res.ok) {
      alert("Đã hủy đơn hàng thành công!");
      // Tải lại danh sách đơn hàng
      fetchOrders(token);
    } else {
      alert(data.message || "Lỗi khi hủy đơn hàng");
    }
  } catch (error) {
    console.error("Lỗi hủy đơn:", error);
    alert("Có lỗi xảy ra, vui lòng thử lại sau.");
  }
}
function getStatusClass(status) {
  if (status === "Đã giao" || status === "completed") return "status-completed";
  if (status === "Đã hủy" || status === "cancelled") return "status-cancelled";
  return "status-pending";
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "login.html";
}
