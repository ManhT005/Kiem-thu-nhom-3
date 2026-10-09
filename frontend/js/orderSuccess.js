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
    if (!orderId || !token) {
      showFailure("Không thể xác minh giao dịch. Vui lòng đăng nhập và kiểm tra đơn hàng.");
      return;
    }

    show(pendingView);
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
        localStorage.removeItem("checkoutItems");
        localStorage.removeItem("pendingMomoOrderId");
        return;
      }
      if (paymentStatus === "REFUND_REQUIRED") {
        show(refundView);
        localStorage.removeItem("pendingMomoOrderId");
        return;
      }
      if (paymentStatus === "FAILED" || paymentStatus === "EXPIRED" || paymentStatus === "CANCELLED") {
        showFailure(
          paymentStatus === "EXPIRED"
            ? "Thời hạn thanh toán đã hết. Đơn hàng đã hủy; giỏ hàng vẫn được giữ."
            : "Giao dịch không thành công. Giỏ hàng vẫn được giữ để bạn thử lại.",
        );
        localStorage.removeItem("pendingMomoOrderId");
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
    }
  };

  checkButton.addEventListener("click", () => {
    window.clearTimeout(retryTimer);
    checkPaymentStatus();
  });
  checkPaymentStatus();
});