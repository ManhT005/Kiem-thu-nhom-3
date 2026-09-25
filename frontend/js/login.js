document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");
  const messageEl = document.getElementById("message");
  const registerBtn = document.getElementById("registerBtn");

  // --- CODE XỬ LÝ CON MẮT MỚI ---
  const togglePassword = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");

  if (togglePassword && passwordInput) {
    togglePassword.addEventListener("click", () => {
      // 1. Kiểm tra trạng thái hiện tại
      const isPassword = passwordInput.getAttribute("type") === "password";

      // 2. Đổi kiểu input (text <-> password)
      passwordInput.setAttribute("type", isPassword ? "text" : "password");

      // 3. Đổi icon:
      // Nếu vừa chuyển sang HIỆN mật khẩu (text) -> đổi icon thành mắt mở (fa-eye)
      // Nếu vừa chuyển sang ẨN mật khẩu (password) -> đổi icon về mắt gạch chéo (fa-eye-slash)
      if (isPassword) {
        togglePassword.classList.remove("fa-eye-slash"); // Xóa icon gạch chéo
        togglePassword.classList.add("fa-eye"); // Thêm icon mắt mở
      } else {
        togglePassword.classList.remove("fa-eye"); // Xóa icon mắt mở
        togglePassword.classList.add("fa-eye-slash"); // Thêm icon gạch chéo
      }
    });
  }
  // --- HẾT CODE XỬ LÝ CON MẮT MỚI ---

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!email || !password) {
      messageEl.textContent = "Vui lòng nhập đầy đủ thông tin";
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        messageEl.textContent = data.message || "Đăng nhập thất bại";
        return;
      }

      // Lưu token, user và cartCount vào localStorage
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      localStorage.setItem("cartCount", data.cartCount || 0);

      // Điều hướng theo role
      if (data.user.role === "admin") {
        window.location.href = "/html/admin.html";
      } else if (data.user.role === "staff") {
        window.location.href = "/html/staff.html";
      } else {
        window.location.href = "/html/index.html"; // khách hoặc user
      }
    } catch (error) {
      console.error(error);
      messageEl.textContent = "Lỗi server. Vui lòng thử lại";
    }
  });

  // Chuyển sang trang đăng ký
  registerBtn?.addEventListener("click", () => {
    window.location.href = "/html/register.html";
  });
});
