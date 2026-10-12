document.addEventListener("DOMContentLoaded", () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");
  const checkoutItems = JSON.parse(localStorage.getItem("checkoutItems")) || [];

  if (!token || !user?.id || checkoutItems.length === 0) {
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
    localStorage.removeItem(`checkoutSession:${user.id}`);
    if (paymentMethods.find((method) => String(method.maPTTT) === e.target.value)?.code === "BANK_TRANSFER") {
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

  const sessionKey = `checkoutSession:${user.id}`;
  localStorage.removeItem("pendingMomoOrderId");
  const button = document.getElementById("btnPlaceOrder");
  const buttonText = button.textContent;
  let submitting = false;
  let previewing = false;
  const voucherInput = document.getElementById("voucherCode");
  const applyVoucherButton = document.getElementById("applyVoucher");
  const voucherFeedback = document.getElementById("voucherFeedback");
  const voucherDiscount = document.getElementById("voucherDiscount");
  voucherInput.addEventListener("input", () => {
    voucherDiscount.textContent = "0 VND";
    voucherFeedback.textContent = "Ưu đãi sẽ được kiểm tra lại khi đặt hàng.";
    finalTotalEl.textContent = totalAmount.toLocaleString() + " VND";
  });
  applyVoucherButton.addEventListener("click", async () => {
    if (submitting || previewing) return;
    const code = voucherInput.value.trim().toUpperCase();
    if (!code) { voucherFeedback.textContent = "Vui lòng nhập mã ưu đãi."; return; }
    previewing = true; applyVoucherButton.disabled = true; button.disabled = true;
    applyVoucherButton.setAttribute("aria-busy", "true"); voucherFeedback.textContent = "Đang kiểm tra ưu đãi...";
    try {
      const response = await fetch("/api/vouchers/validate", { method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ voucherCode: code, items: checkoutItems.map(({ maSP, maSize, soLuongMua }) => ({ maSP, maSize, soLuongMua })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Không thể áp dụng mã ưu đãi");
      if (voucherInput.value.trim().toUpperCase() !== code) return;
      voucherDiscount.textContent = Number(result.data.discountAmount).toLocaleString() + " VND";
      finalTotalEl.textContent = Number(result.data.totalAfterDiscount).toLocaleString() + " VND";
      voucherFeedback.textContent = "Mã hợp lệ. Ưu đãi sẽ được kiểm tra lại khi đặt hàng.";
    } catch (error) {
      voucherDiscount.textContent = "0 VND"; finalTotalEl.textContent = totalAmount.toLocaleString() + " VND";
      voucherFeedback.textContent = error.message;
    } finally {
      previewing = false; applyVoucherButton.disabled = false; button.disabled = submitting || paymentMethods.length === 0;
      applyVoucherButton.removeAttribute("aria-busy");
    }
  });
  button.disabled = true;
  let paymentMethods = [];
  const methodsReady = fetch("/api/orders/payment-methods")
    .then(async (response) => {
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.data)) throw new Error("Không thể tải phương thức thanh toán");
      paymentMethods = result.data;
      ptttSelect.replaceChildren();
      for (const method of paymentMethods) {
        const option = document.createElement("option");
        option.value = method.maPTTT;
        option.textContent = method.tenPTTT;
        ptttSelect.appendChild(option);
      }
      button.disabled = previewing || paymentMethods.length === 0;
    }).catch((error) => alert(error.message));

  button.addEventListener("click", async () => {
    if (submitting || previewing) return;
    const tenNguoiNhan = document.getElementById("tenNguoiNhan").value.trim();
    const sdt = document.getElementById("sdt").value.trim();
    const diaChiGiaoHang = document.getElementById("diaChiGiaoHang").value.trim();
    if (!validateForm(tenNguoiNhan, sdt, diaChiGiaoHang)) return;
    submitting = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.textContent = "ĐANG XỬ LÝ...";
    try {
      await methodsReady;
      const method = paymentMethods.find((value) => String(value.maPTTT) === ptttSelect.value);
      if (!method) throw new Error("Vui lòng chọn phương thức thanh toán");
      const payload = {
        tenNguoiNhan, sdt, diaChiGiaoHang, maPTTT: method.maPTTT,
        ghiChu: document.getElementById("ghiChu").value,
        items: checkoutItems.map(({ maSP, maSize, soLuongMua }) => ({ maSP, maSize, soLuongMua })),
      };
      if (voucherInput.value.trim()) payload.voucherCode = voucherInput.value.trim().toUpperCase();
      const fingerprint = JSON.stringify(payload);
      let session;
      try { session = JSON.parse(localStorage.getItem(sessionKey)); } catch { /* discard corrupt state */ }
      if (!session || session.fingerprint !== fingerprint) {
        session = { fingerprint, idempotencyKey: crypto.randomUUID() };
        localStorage.setItem(sessionKey, JSON.stringify(session));
      }
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      if (method.code === "MOMO" && session.orderId) {
        const response = await fetch(`/api/payments/momo/orders/${encodeURIComponent(session.orderId)}/status`, { headers });
        const status = await response.json();
        if (!response.ok) {
          if ([401, 403, 404].includes(response.status)) localStorage.removeItem(sessionKey);
          throw new Error(status.message || "Không thể xác minh đơn hàng");
        }
        if (status.data.paymentStatus !== "PENDING") {
          localStorage.removeItem(sessionKey);
          if (status.data.paymentStatus === "PAID") {
            localStorage.removeItem("checkoutItems");
            window.location.href = `/order-success?maDonHang=${session.orderId}`;
            return;
          }
          throw new Error("Đơn hàng đã kết thúc hoặc hết hạn. Vui lòng đặt lại.");
        }
      }
      const orderResponse = await fetch("/api/orders/create", {
        method: "POST", headers,
        body: JSON.stringify({ ...payload, idempotencyKey: session.idempotencyKey }),
      });
      const orderData = await orderResponse.json();
      if (!orderResponse.ok || !orderData.data?.maDonHang) {
        if (String(orderData.code || "").startsWith("VOUCHER") || orderData.code === "MIN_ORDER_NOT_MET") voucherFeedback.textContent = orderData.message;
        throw new Error(orderData.message || "Không thể tạo đơn hàng");
      }
      const orderId = orderData.data.maDonHang;
      if (orderData.data.discountAmount !== undefined) {
        voucherDiscount.textContent = Number(orderData.data.discountAmount).toLocaleString() + " VND";
        finalTotalEl.textContent = Number(orderData.data.tongTien).toLocaleString() + " VND";
      }
      if (orderData.data.trangThai === "Đã hủy") {
        localStorage.removeItem(sessionKey);
        throw new Error("Đơn hàng đã hủy. Vui lòng đặt lại.");
      }
      session.orderId = orderId;
      localStorage.setItem(sessionKey, JSON.stringify(session));
      if (method.code === "MOMO") {
        if (orderData.data.paymentStatus !== "PENDING") {
          localStorage.removeItem(sessionKey);
          window.location.href = `/order-success?maDonHang=${orderId}`;
          return;
        }
        const response = await fetch("/api/payments/momo/create", {
          method: "POST", headers, body: JSON.stringify({ orderId }),
        });
        const data = await response.json();
        if (!response.ok || !data.data?.payUrl) {
          if (["PAYMENT_EXPIRED", "ORDER_CANCELLED", "PAYMENT_NOT_PENDING"].includes(data.code)) {
            localStorage.removeItem(sessionKey);
          }
          throw new Error(data.message || "Không thể tạo giao dịch MoMo");
        }
        const payUrl = new URL(data.data.payUrl);
        if (payUrl.protocol !== "https:" || payUrl.username || payUrl.password || payUrl.port ||
            !["test-payment.momo.vn", "payment.momo.vn"].includes(payUrl.hostname)) {
          throw new Error("Địa chỉ thanh toán không hợp lệ");
        }
        window.location.href = payUrl.href;
      } else {
        localStorage.removeItem(sessionKey);
        localStorage.removeItem("checkoutItems");
        alert("Đặt hàng thành công!");
        window.location.href = "/";
      }
    } catch (error) {
      alert(error.message || "Lỗi kết nối server. Vui lòng thử lại.");
    } finally {
      submitting = false;
      button.disabled = paymentMethods.length === 0;
      button.removeAttribute("aria-busy");
      button.textContent = buttonText;
    }
  });
});
