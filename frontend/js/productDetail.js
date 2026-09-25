// frontend/js/productDetail.js
document.addEventListener("DOMContentLoaded", async () => {
  const params = new URLSearchParams(window.location.search);
  const productId = params.get("id");
  let selectedSizeId = null;
  let currentStock = 0;

  // --- BIẾN MỚI: Lưu toàn bộ thông tin sản phẩm để dùng cho nút Mua Ngay ---
  let currentProductData = null;

  if (!productId) {
    alert("Không tìm thấy ID sản phẩm");
    window.location.href = "/html/index.html";
    return;
  }

  const productName = document.getElementById("productName");
  const productImage = document.getElementById("productImage");
  const productPrice = document.getElementById("productPrice");
  const productDesc = document.getElementById("productDesc");
  const qtyInput = document.getElementById("quantity");
  const btnMinus = document.getElementById("btnMinus");
  const btnPlus = document.getElementById("btnPlus");
  const addToCartBtn = document.getElementById("addToCartBtn");
  const buyNowBtn = document.getElementById("buyNowBtn");
  const sizeContainer = document.getElementById("sizeContainer");
  const stockInfo = document.getElementById("stockInfo");

  let user = JSON.parse(localStorage.getItem("user"));
  let token = localStorage.getItem("token");

  // ---------------- LOAD PRODUCT ----------------
  async function loadProduct() {
    try {
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error("Lỗi tải sản phẩm");

      const data = await res.json();
      const p = data.product;

      // --- SỬA: Lưu dữ liệu ra biến toàn cục ---
      currentProductData = p;
      // ----------------------------------------

      // Render thông tin
      productName.innerText = p.tenSP;
      productPrice.innerText = Number(p.gia).toLocaleString() + " VND";
      productDesc.innerHTML = p.moTa || "Chưa có mô tả";
      if (p.anhSP) {
        productImage.src = `/Asset/${p.anhSP}`;
      }

      // RENDER SIZE (Giữ nguyên logic cũ của bạn)
      sizeContainer.innerHTML = "";
      if (p.sizes && Array.isArray(p.sizes) && p.sizes.length > 0) {
        p.sizes.forEach((s) => {
          const btn = document.createElement("button");
          btn.className = "size-btn";
          btn.innerText = s.tenSize;
          btn.style.marginRight = "10px";
          btn.style.padding = "5px 15px";
          btn.style.cursor = "pointer";
          btn.style.border = "1px solid #ccc";

          if (s.soLuongTon <= 0) {
            btn.classList.add("disabled");
            btn.disabled = true;
            btn.style.opacity = "0.5";
            btn.title = "Hết hàng";
          }

          btn.addEventListener("click", () => {
            document.querySelectorAll(".size-btn").forEach((b) => {
              b.classList.remove("active");
              b.style.backgroundColor = "";
              b.style.color = "";
            });
            btn.classList.add("active");
            btn.style.backgroundColor = "#333";
            btn.style.color = "#fff";

            selectedSizeId = s.maSize;
            currentStock = s.soLuongTon;

            if (stockInfo) {
              stockInfo.innerText = `Số lượng: ${currentStock} sản phẩm`;
              stockInfo.style.color = currentStock < 5 ? "black" : "#555";
            }
            if (qtyInput) qtyInput.value = 1;
          });
          sizeContainer.appendChild(btn);
        });
      } else {
        sizeContainer.innerHTML = "<p>Sản phẩm này chưa có size</p>";
      }
    } catch (err) {
      console.error(err);
      alert("Không tải được chi tiết sản phẩm");
    }
  }

  loadProduct();

  // ---------------- QUANTITY ----------------
  if (btnMinus && btnPlus && qtyInput) {
    btnMinus.addEventListener("click", () => {
      let qty = parseInt(qtyInput.value);
      if (qty > 1) qtyInput.value = qty - 1;
    });

    btnPlus.addEventListener("click", () => {
      let qty = parseInt(qtyInput.value);
      // SỬA: Không cho tăng quá số lượng kho
      if (selectedSizeId && qty >= currentStock) {
        alert("Đã đạt giới hạn số lượng trong kho!");
        return;
      }
      qtyInput.value = qty + 1;
    });

    // SỬA: Xử lý khi người dùng nhập tay số lượng
    qtyInput.addEventListener("change", () => {
      let qty = parseInt(qtyInput.value);
      if (selectedSizeId && qty > currentStock) {
        alert(`Kho chỉ còn ${currentStock} sản phẩm!`);
        qtyInput.value = currentStock;
      }
      if (qty < 1) qtyInput.value = 1;
    });
  }

  // ---------------- ADD TO CART ----------------
  if (addToCartBtn) {
    addToCartBtn.addEventListener("click", async () => {
      user = JSON.parse(localStorage.getItem("user"));
      token = localStorage.getItem("token");

      if (!user || !token) {
        alert("Bạn cần đăng nhập để mua hàng!");
        window.location.href = "/html/login.html";
        return;
      }

      if (!selectedSizeId) {
        alert("Vui lòng chọn Size!");
        return;
      }

      const qty = parseInt(qtyInput.value);

      // KIỂM TRA SỐ LƯỢNG TRƯỚC KHI GỬI
      if (qty > currentStock) {
        alert(
          `Sản phẩm này chỉ còn ${currentStock} cái trong kho. Vui lòng giảm số lượng!`,
        );
        return;
      }

      try {
        const res = await fetch("/api/cart/add", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            maSP: productId,
            soLuong: qty,
            maSize: selectedSizeId,
          }),
        });

        const result = await res.json();

        if (res.ok) {
          alert("Đã thêm vào giỏ hàng thành công!");
          if (window.updateHeaderCartCount) window.updateHeaderCartCount();
        } else {
          alert(result.message || "Lỗi khi thêm vào giỏ");
        }
      } catch (e) {
        console.error(e);
        alert("Lỗi kết nối server");
      }
    });
  }

  // ---------------- BUY NOW (ĐÃ SỬA) ----------------
  if (buyNowBtn) {
    buyNowBtn.addEventListener("click", () => {
      // Kiểm tra đăng nhập trước (nếu cần thiết)
      user = JSON.parse(localStorage.getItem("user"));
      if (!user) {
        alert("Bạn cần đăng nhập để mua hàng!");
        window.location.href = "/html/login.html";
        return;
      }

      if (!selectedSizeId) {
        alert("Vui lòng chọn Size!");
        return;
      }

      const qty = parseInt(qtyInput.value);

      if (qty > currentStock) {
        alert(
          `Sản phẩm này chỉ còn ${currentStock} cái trong kho. Vui lòng giảm số lượng!`,
        );
        return;
      }

      // --- SỬA LOGIC Ở ĐÂY ---
      // 1. Tìm tên size dựa trên ID đã chọn
      const selectedSizeObj = currentProductData.sizes.find(
        (s) => s.maSize === selectedSizeId,
      );
      const sizeName = selectedSizeObj ? selectedSizeObj.tenSize : "N/A";

      // 2. Tạo đối tượng item đầy đủ thông tin (giống như lấy từ giỏ hàng)
      const buyNowItem = {
        maSP: currentProductData.maSP,
        tenSP: currentProductData.tenSP,
        gia: currentProductData.gia,
        anhSP: currentProductData.anhSP,
        maSize: selectedSizeId,
        tenSize: sizeName, // Cần thêm tên size để hiển thị bên checkout
        soLuongMua: qty,
      };

      // 3. Lưu vào checkoutItems (thay vì "buyNow") để checkout.js đọc được
      localStorage.setItem("checkoutItems", JSON.stringify([buyNowItem]));

      // 4. Chuyển hướng
      window.location.href = "/html/checkout.html";
    });
  }
});
