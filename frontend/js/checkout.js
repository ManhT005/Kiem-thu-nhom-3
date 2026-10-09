document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const checkoutItems = JSON.parse(localStorage.getItem("checkoutItems")) || [];

  if (!token || checkoutItems.length === 0) {
    alert("Không có thông tin đơn hàng!");
    window.location.href = "/cart";
    return;
  }

  // Điền sẵn thông tin user
  if (user) {
    document.getElementById("tenNguoiNhan").value = user.ten || "";
    document.getElementById("sdt").value = user.sdt || "";
  }

  // --- 1. TẢI ĐỊA CHỈ (Giữ nguyên code của bạn) ---
  async function loadUserAddresses() {
    const addressSelect = document.getElementById("diaChiGiaoHang");
    if (!addressSelect || addressSelect.tagName !== "SELECT") return;

    try {
      const res = await fetch("/api/users/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.phone) document.getElementById("sdt").value = data.phone;

      if (res.ok && data.addresses && data.addresses.length > 0) {
        addressSelect.replaceChildren();
        const prompt = document.createElement("option");
        prompt.value = "";
        prompt.textContent = "-- Chọn địa chỉ giao hàng --";
        addressSelect.appendChild(prompt);
        let hasDefault = false;
        data.addresses.forEach((addr) => {
          const option = document.createElement("option");
          option.value = addr.tenDiaChi;
          option.text = addr.tenDiaChi;
          if (addr.macDinh === 1) {
            option.selected = true;
            option.text += " (Mặc định)";
            hasDefault = true;
          }
          addressSelect.appendChild(option);
        });
        if (!hasDefault && addressSelect.options.length > 1)
          addressSelect.selectedIndex = 1;
      } else {
        const emptyOption = document.createElement("option");
        emptyOption.value = "";
        emptyOption.textContent = "Bạn chưa lưu địa chỉ nào";
        addressSelect.replaceChildren(emptyOption);
      }
    } catch (err) {
      console.error("Lỗi tải địa chỉ:", err);
    }
  }
  loadUserAddresses();

  // --- 2. HIỂN THỊ SẢN PHẨM & TÍNH TỔNG TIỀN ---
  const orderItemsList = document.getElementById("orderItemsList");
  const finalTotalEl = document.getElementById("finalTotal");
  const ptttSelect = document.getElementById("maPTTT");
  const qrInfo = document.getElementById("qrInfo");
  let totalAmount = 0;

  orderItemsList.replaceChildren();
  checkoutItems.forEach((item) => {
    const itemTotal = item.gia * item.soLuongMua;
    totalAmount += itemTotal;
    const div = document.createElement("div");
    div.className = "order-item";
    const details = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = String(item.tenSP ?? "");
    const variant = document.createElement("small");
    variant.textContent = `Size: ${String(item.tenSize ?? "N/A")} x ${Number(item.soLuongMua)}`;
    details.append(name, document.createElement("br"), variant);
    const price = document.createElement("span");
    price.textContent = `${Number(itemTotal).toLocaleString()} đ`;
    div.append(details, price);
    orderItemsList.appendChild(div);
  });
  finalTotalEl.innerText = totalAmount.toLocaleString() + " VND";

  // --- 3. XỬ LÝ QR CODE (Giữ nguyên) ---
  ptttSelect.addEventListener("change", (e) => {
    // Giả sử ID=2 là Chuyển khoản ngân hàng
    if (e.target.value === "2") {
      qrInfo.style.display = "block";
      const sdt = document.getElementById("sdt").value;
      document.getElementById("qrNote").innerText =
        `Thanh toan don hang ${sdt}`;
    } else {
      qrInfo.style.display = "none";
    }
  });

  // --- 4. VALIDATE FORM (Giữ nguyên) ---
  function validateForm(ten, sdt, diaChi) {
    let isValid = true;
    document
      .querySelectorAll(".error-message")
      .forEach((el) => (el.style.display = "none"));
    if (!ten || ten.trim() === "") {
      document.getElementById("error-ten").style.display = "block";
      isValid = false;
    }
    const phoneRegex = /^[0-9]+$/;
    if (!sdt || !phoneRegex.test(sdt) || sdt.length < 10 || sdt.length > 11) {
      document.getElementById("error-sdt").innerText =
        "SĐT không hợp lệ (10-11 số)";
      document.getElementById("error-sdt").style.display = "block";
      isValid = false;
    }
    if (!diaChi || diaChi.trim() === "") {
      document.getElementById("error-diachi").innerText =
        "Vui lòng chọn địa chỉ";
      document.getElementById("error-diachi").style.display = "block";
      isValid = false;
    }
    return isValid;
  }

  // ==================================================================
  // [QUAN TRỌNG] 5. XỬ LÝ NÚT ĐẶT HÀNG (ĐÃ TÍCH HỢP MOMO)
  // ==================================================================
  document
    .getElementById("btnPlaceOrder")
    .addEventListener("click", async () => {
      const tenNguoiNhan = document.getElementById("tenNguoiNhan").value;
      const sdt = document.getElementById("sdt").value;
      const diaChiGiaoHang = document.getElementById("diaChiGiaoHang").value;
      const maPTTT = document.getElementById("maPTTT").value; // Lấy ID phương thức thanh toán
      const ghiChu = document.getElementById("ghiChu").value;

      // Validate dữ liệu trước
      if (!validateForm(tenNguoiNhan, sdt, diaChiGiaoHang)) return;

      const payload = {
        tenNguoiNhan,
        sdt,
        diaChiGiaoHang,
        maPTTT,
        ghiChu,
        tongTien: totalAmount,
        items: checkoutItems,
      };

      // -------------------------------------------------------------
      // A. NẾU CHỌN MOMO (Giả sử ID của MoMo trong DB là "3")
      // Bạn cần kiểm tra trong Database xem ID của MoMo là số mấy nhé!
      // -------------------------------------------------------------
      if (maPTTT === "3") {
        try {
          let orderId = localStorage.getItem("pendingMomoOrderId");
          if (!orderId) {
            const orderResponse = await fetch("/api/orders/create", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify(payload),
            });
            const orderData = await orderResponse.json();
            if (!orderResponse.ok || !orderData.data?.maDonHang) {
              alert(orderData.message || "Không thể tạo đơn hàng");
              return;
            }
            orderId = String(orderData.data.maDonHang);
            localStorage.setItem("pendingMomoOrderId", orderId);
          }

          const res = await fetch("/api/payments/momo/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ orderId }),
          });

          const data = await res.json();

          if (res.ok && data.data?.payUrl) {
            alert("Đang chuyển hướng sang MoMo...");
            window.location.href = data.data.payUrl;
          } else {
            if (data.code === "PAYMENT_EXPIRED" || data.code === "ORDER_CANCELLED") {
              localStorage.removeItem("pendingMomoOrderId");
            }
            alert(
              "Lỗi tạo giao dịch MoMo: " +
                (data.message || "Không xác định"),
            );
          }
        } catch (err) {
          console.error("Lỗi MoMo:", err);
          alert("Không thể kết nối tới cổng thanh toán MoMo");
        }
        return; // Dừng lại, không chạy code đặt hàng thường bên dưới
      }

      // -------------------------------------------------------------
      // B. NẾU CHỌN COD HOẶC CHUYỂN KHOẢN (Logic cũ của bạn)
      // -------------------------------------------------------------
      localStorage.removeItem("pendingMomoOrderId");
      try {
        const res = await fetch("/api/orders/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();

        if (res.ok) {
          alert("Đặt hàng thành công!");
          localStorage.removeItem("checkoutItems");
          window.location.href = "/";
        } else {
          alert(data.message || "Có lỗi xảy ra");
        }
      } catch (error) {
        console.error(error);
        alert("Lỗi kết nối server");
      }
    });
});
