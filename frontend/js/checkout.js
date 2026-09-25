document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const checkoutItems = JSON.parse(localStorage.getItem("checkoutItems")) || [];

  if (!token || checkoutItems.length === 0) {
    alert("Không có thông tin đơn hàng!");
    window.location.href = "/html/cart.html";
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
        addressSelect.innerHTML =
          '<option value="">-- Chọn địa chỉ giao hàng --</option>';
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
        addressSelect.innerHTML =
          '<option value="">Bạn chưa lưu địa chỉ nào</option>';
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

  orderItemsList.innerHTML = "";
  checkoutItems.forEach((item) => {
    const itemTotal = item.gia * item.soLuongMua;
    totalAmount += itemTotal;
    const div = document.createElement("div");
    div.className = "order-item";
    div.innerHTML = `
            <div><strong>${item.tenSP}</strong> <br> <small>Size: ${item.tenSize} x ${item.soLuongMua}</small></div>
            <span>${itemTotal.toLocaleString()} đ</span>
        `;
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

      // -------------------------------------------------------------
      // A. NẾU CHỌN MOMO (Giả sử ID của MoMo trong DB là "3")
      // Bạn cần kiểm tra trong Database xem ID của MoMo là số mấy nhé!
      // -------------------------------------------------------------
      if (maPTTT === "3") {
        try {
          // Gọi API backend để lấy link thanh toán MoMo
          const res = await fetch("/api/create-payment-momo", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: totalAmount }), // Gửi tổng tiền lên
          });

          const data = await res.json();

          if (data && data.payUrl) {
            // Lưu tạm thông tin đơn hàng vào localStorage để khi quay lại có thể lưu vào DB sau
            // (Hoặc bạn có thể lưu đơn hàng trạng thái 'Pending' trước khi chuyển hướng)
            alert("Đang chuyển hướng sang MoMo...");
            window.location.href = data.payUrl; // CHUYỂN HƯỚNG SANG TRANG THANH TOÁN
          } else {
            alert(
              "Lỗi tạo giao dịch MoMo: " + (data.message || "Không xác định"),
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
      const payload = {
        tenNguoiNhan,
        sdt,
        diaChiGiaoHang,
        maPTTT,
        ghiChu,
        tongTien: totalAmount,
        items: checkoutItems,
      };

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
          window.location.href = "/html/index.html";
        } else {
          alert(data.message || "Có lỗi xảy ra");
        }
      } catch (error) {
        console.error(error);
        alert("Lỗi kết nối server");
      }
    });
});
