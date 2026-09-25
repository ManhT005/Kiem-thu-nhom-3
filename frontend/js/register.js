document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const messageEl = document.getElementById("message");
  const loginBtn = document.getElementById("loginBtn");

  // --- BẮT ĐẦU CODE XỬ LÝ 2 CON MẮT ---
  // Hàm dùng chung để cài đặt chức năng ẩn/hiện
  const setupPasswordToggle = (inputId, iconId) => {
    const input = document.getElementById(inputId);
    const icon = document.getElementById(iconId);

    if (input && icon) {
      icon.addEventListener("click", () => {
        const isPassword = input.getAttribute("type") === "password";

        // Đổi type
        input.setAttribute("type", isPassword ? "text" : "password");

        // Đổi icon
        if (isPassword) {
          icon.classList.remove("fa-eye-slash");
          icon.classList.add("fa-eye");
        } else {
          icon.classList.remove("fa-eye");
          icon.classList.add("fa-eye-slash");
        }
      });
    }
  };

  // Gọi hàm cho 2 ô mật khẩu
  setupPasswordToggle("password", "togglePassword");
  setupPasswordToggle("confirmPassword", "toggleConfirmPassword");
  // --- KẾT THÚC CODE XỬ LÝ CON MẮT ---

  // Regex kiểm tra mật khẩu
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  // Xử lý submit register
  if (registerForm) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const ten = document.getElementById("name").value.trim();
      const email = document.getElementById("email").value.trim();
      const matKhau = document.getElementById("password").value.trim();
      const confirmPassword = document
        .getElementById("confirmPassword")
        .value.trim();

      if (!ten || !email || !matKhau || !confirmPassword) {
        messageEl.textContent = "Vui lòng nhập đầy đủ thông tin";
        return;
      }

      if (matKhau !== confirmPassword) {
        messageEl.textContent = "Mật khẩu và xác nhận mật khẩu không khớp";
        return;
      }

      // Kiểm tra mật khẩu theo yêu cầu
      if (!passwordRegex.test(matKhau)) {
        messageEl.textContent =
          "Mật khẩu phải ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt";
        return;
      }

      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ten,
            email,
            matKhau,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          messageEl.textContent = data.message || "Đăng ký thất bại";
          return;
        }

        alert("Đăng ký thành công! Vui lòng đăng nhập.");
        window.location.href = "/html/login.html";
      } catch (error) {
        console.error(error);
        messageEl.textContent = "Lỗi server. Vui lòng thử lại";
      }
    });
  }

  // Xử lý nút đăng nhập
  loginBtn?.addEventListener("click", () => {
    window.location.href = "/html/login.html";
  });
});
