const createTextElement = (tagName, className, text) => {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  element.textContent = String(text ?? "");
  return element;
};

document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "/login";
    return;
  }

  fetchProfile(token);
  fetchOrders(token);

  document
    .getElementById("update-btn")
    .addEventListener("click", () => updateBasicInfo(token));

  // ================== [MỚI] KHÔI PHỤC TAB KHI F5 ==================

  const routeDefaultTab =
    window.location.pathname === "/orders" ? "orders" : "info";
  const savedTab = localStorage.getItem("currentProfileTab");
  switchTab(routeDefaultTab === "orders" ? "orders" : savedTab || "info");
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
  listEl.replaceChildren();

  if (!addresses || addresses.length === 0) {
    listEl.appendChild(createTextElement("li", "", "Chưa có địa chỉ nào."));
    return;
  }

  addresses.forEach((addr) => {
    const li = document.createElement("li");
    li.style.cssText =
      "display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee;";

    // Kiểm tra xem có phải mặc định không (dựa vào cột macDinh trả về từ backend)
    const addressId = Number(addr.maDiaChi);
    const hasValidId = Number.isSafeInteger(addressId) && addressId > 0;
    const isDefault = Number(addr.macDinh) === 1;
    const addressDetails = document.createElement("div");
    addressDetails.style.display = "flex";
    addressDetails.style.alignItems = "center";
    const marker = document.createElement("i");
    marker.className = "fa-solid fa-map-marker-alt";
    marker.style.color = "#ee4d2d";
    marker.style.marginRight = "8px";
    addressDetails.append(
      marker,
      createTextElement("span", "", addr.tenDiaChi),
    );

    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.alignItems = "center";
    if (isDefault) {
      const badge = createTextElement("span", "", "Mặc định");
      Object.assign(badge.style, {
        color: "#28a745",
        fontSize: "12px",
        border: "1px solid #28a745",
        padding: "2px 6px",
        borderRadius: "4px",
        marginRight: "10px",
        fontWeight: "bold",
      });
      actions.appendChild(badge);
    } else if (hasValidId) {
      const setDefaultButton = createTextElement(
        "button",
        "",
        "Đặt làm mặc định",
      );
      Object.assign(setDefaultButton.style, {
        fontSize: "12px",
        color: "#007bff",
        background: "none",
        border: "1px solid #007bff",
        padding: "2px 6px",
        borderRadius: "4px",
        cursor: "pointer",
        marginRight: "10px",
      });
      setDefaultButton.addEventListener("click", () =>
        setAddressDefault(addressId),
      );
      actions.appendChild(setDefaultButton);
    }

    if (hasValidId) {
      const removeButton = createTextElement("button", "", "Xóa");
      Object.assign(removeButton.style, {
        background: "none",
        border: "none",
        color: "red",
        cursor: "pointer",
        marginLeft: "5px",
      });
      removeButton.title = "Xóa";
      removeButton.addEventListener("click", () => removeAddress(addressId));
      actions.appendChild(removeButton);
    }

    li.append(addressDetails, actions);
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
  orderListDiv.replaceChildren(
    createTextElement("p", "", "Đang tải đơn hàng..."),
  );

  try {
    const response = await fetch("/api/orders/my-orders", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || response.statusText);
    }

    const responseData = await response.json();
    const orders = responseData.data ?? responseData;

    if (orders.length > 0) {
      const orderCards = orders.map((order) => {
        const card = document.createElement("div");
        card.className = "order-item";
        Object.assign(card.style, {
          background: "#fff",
          padding: "15px",
          marginBottom: "15px",
          borderRadius: "8px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          border: "1px solid #eee",
        });

        const header = document.createElement("div");
        header.className = "order-header";
        Object.assign(header.style, {
          display: "flex",
          justifyContent: "space-between",
          marginBottom: "10px",
          paddingBottom: "5px",
        });
        const identity = document.createElement("div");
        const orderId = Number(order.maDonHang);
        identity.appendChild(
          createTextElement(
            "strong",
            "",
            `Đơn hàng #${Number.isSafeInteger(orderId) ? orderId : ""}`,
          ),
        );
        const orderDate = createTextElement(
          "span",
          "",
          new Date(order.ngayDat).toLocaleString("vi-VN"),
        );
        Object.assign(orderDate.style, {
          fontSize: "12px",
          color: "#888",
        });
        identity.append(document.createElement("br"), orderDate);

        const status = createTextElement("span", "status-badge", order.trangThai);
        status.classList.add(getStatusClass(order.trangThai));
        header.append(identity, status);

        const body = document.createElement("div");
        body.className = "order-body";
        (order.items || []).forEach((item) => {
          const row = document.createElement("div");
          Object.assign(row.style, {
            display: "flex",
            gap: "15px",
            padding: "10px 0",
            borderTop: "1px solid #f0f0f0",
          });
          const image = document.createElement("img");
          image.src = window.safeAssetUrl(item.anhSP);
          image.alt = String(item.tenSP ?? "");
          Object.assign(image.style, {
            width: "60px",
            height: "60px",
            objectFit: "cover",
            borderRadius: "4px",
            border: "1px solid #ddd",
          });
          const details = document.createElement("div");
          details.style.flex = "1";
          const name = createTextElement("div", "", item.tenSP);
          Object.assign(name.style, { fontWeight: "500", fontSize: "14px" });
          const variant = createTextElement(
            "div",
            "",
            `Phân loại: ${item.tenSize || "N/A"} | x${Number(item.soLuongMua)}`,
          );
          Object.assign(variant.style, {
            fontSize: "13px",
            color: "#777",
          });
          const price = createTextElement(
            "div",
            "",
            `${Number(item.giaMua).toLocaleString("vi-VN")} đ`,
          );
          Object.assign(price.style, {
            fontSize: "14px",
            color: "#ee4d2d",
            marginTop: "2px",
          });
          details.append(name, variant, price);
          row.append(image, details);
          body.appendChild(row);
        });

        const footer = document.createElement("div");
        Object.assign(footer.style, {
          marginTop: "10px",
          paddingTop: "10px",
          borderTop: "1px dashed #ddd",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        });
        const receiver = createTextElement(
          "span",
          "",
          `Người nhận: ${order.tenNguoiNhan} (${order.sdt})`,
        );
        Object.assign(receiver.style, { fontSize: "13px", color: "#555" });
        const actions = document.createElement("div");
        Object.assign(actions.style, {
          display: "flex",
          alignItems: "center",
        });
        const total = createTextElement(
          "div",
          "order-total",
          `Thành tiền: ${Number(order.tongTien).toLocaleString("vi-VN")} đ`,
        );
        Object.assign(total.style, {
          fontSize: "15px",
          fontWeight: "bold",
          color: "#ee4d2d",
          marginRight: "10px",
        });
        actions.appendChild(total);
        if (
          order.trangThai === "Chờ xác nhận" &&
          Number.isSafeInteger(orderId) &&
          orderId > 0
        ) {
          const cancelButton = createTextElement(
            "button",
            "",
            "Hủy đơn hàng",
          );
          Object.assign(cancelButton.style, {
            padding: "6px 12px",
            background: "#fff",
            color: "#555",
            border: "1px solid #ddd",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "13px",
            marginLeft: "10px",
            transition: "0.2s",
          });
          cancelButton.addEventListener("click", () => cancelOrder(orderId));
          actions.appendChild(cancelButton);
        }
        footer.append(receiver, actions);
        card.append(header, body, footer);
        return card;
      });
      orderListDiv.replaceChildren(...orderCards);
    } else {
      orderListDiv.replaceChildren(
        createTextElement("p", "", "Bạn chưa có đơn hàng nào."),
      );
    }
  } catch (error) {
    console.error("Lỗi orders:", error);
    const message = createTextElement(
      "p",
      "",
      `Có lỗi xảy ra: ${error.message}`,
    );
    message.style.color = "red";
    message.style.textAlign = "center";
    orderListDiv.replaceChildren(message);
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
    const res = await fetch(`/api/orders/${orderId}/cancel`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
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
  switch (status) {
    case "Chờ xác nhận":
      return "status-pending";
    case "Đã xác nhận":
      return "status-confirmed";
    case "Đang giao":
      return "status-shipping";
    case "Hoàn thành":
      return "status-completed";
    case "Đã hủy":
      return "status-cancelled";
    default:
      return "status-unknown";
  }
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/login";
}
