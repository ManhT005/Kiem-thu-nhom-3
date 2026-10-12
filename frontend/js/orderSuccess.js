document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("maDonHang");
  const token = localStorage.getItem("token");
  const successView = document.getElementById("success-view");
  const failView = document.getElementById("fail-view");
  const pendingView = document.getElementById("pending-view");
  const refundView = document.getElementById("refund-view");
  const checkButton = document.getElementById("check-payment-button");
  let retryTimer;
  let checking = false;
  const clearCheckoutSession = (clearItems = false) => {
    const user = JSON.parse(localStorage.getItem("user") || "null");
    if (user?.id) {
      const key = `checkoutSession:${user.id}`;
      let session;
      try { session = JSON.parse(localStorage.getItem(key)); } catch {}
      if (String(session?.orderId) === String(orderId)) {
        localStorage.removeItem(key);
        if (clearItems) localStorage.removeItem("checkoutItems");
      }
    }
    localStorage.removeItem("pendingMomoOrderId");
  };

  const show = (view) => {
    [successView, failView, pendingView, refundView].forEach((element) => {
      element.style.display = element === view ? "block" : "none";
    });
  };

  const showFailure = (message) => {
    show(failView);
    const detail = failView.querySelector("p");
    if (detail && message) detail.textContent = message;
  };

  const checkPaymentStatus = async () => {
    if (checking) return;
    if (!orderId || !token) {
      showFailure("Không thể xác minh giao dịch. Vui lòng đăng nhập và kiểm tra đơn hàng.");
      return;
    }

    show(pendingView);
    checking = true;
    checkButton.disabled = true;
    try {
      const response = await fetch(
        `/api/payments/momo/orders/${encodeURIComponent(orderId)}/status`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const result = await response.json();
      if (!response.ok || !result.success) {
        showFailure(result.message || "Không thể xác minh trạng thái thanh toán.");
        return;
      }

      const paymentStatus = result.data.paymentStatus;
      if (paymentStatus === "PAID") {
        show(successView);
        clearCheckoutSession(true);
        return;
      }
      if (paymentStatus === "REFUND_REQUIRED") {
        show(refundView);
        clearCheckoutSession();
        return;
      }
      if (paymentStatus === "FAILED" || paymentStatus === "EXPIRED" || paymentStatus === "CANCELLED") {
        showFailure(
          paymentStatus === "EXPIRED"
            ? "Thời hạn thanh toán đã hết. Đơn hàng đã hủy; giỏ hàng vẫn được giữ."
            : "Giao dịch không thành công. Giỏ hàng vẫn được giữ để bạn thử lại.",
        );
        clearCheckoutSession();
        return;
      }

      document.getElementById("pending-message").textContent =
        "Giao dịch chưa được MoMo xác nhận. Trang sẽ tự kiểm tra lại.";
      retryTimer = window.setTimeout(checkPaymentStatus, 3000);
    } catch (error) {
      console.error("Không thể kiểm tra trạng thái MoMo:", error);
      document.getElementById("pending-message").textContent =
        "Chưa kết nối được máy chủ. Trang sẽ thử kiểm tra lại.";
      retryTimer = window.setTimeout(checkPaymentStatus, 5000);
    } finally {
      checking = false;
      checkButton.disabled = false;
    }
  };

  checkButton.addEventListener("click", () => {
    window.clearTimeout(retryTimer);
    checkPaymentStatus();
  });
  checkPaymentStatus();
  window.addEventListener("pagehide", () => window.clearTimeout(retryTimer));
});
