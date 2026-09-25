// frontend/js/cart.js
document.addEventListener("DOMContentLoaded", async () => {
  const user = JSON.parse(localStorage.getItem("user"));
  const token = localStorage.getItem("token");

  if (!user || !token) {
    alert("Bạn chưa đăng nhập!");
    window.location.href = "/html/login.html";
    return;
  }

  const cartList = document.getElementById("cartList");
  const totalPriceEl = document.getElementById("totalPrice");
  const checkoutBtn = document.getElementById("checkoutBtn");

  let cartData = []; // Lưu dữ liệu giỏ hàng để dùng ở checkout

  async function loadCart() {
    try {
      const res = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      cartData = data.cart;

      if (!cartList) return;
      cartList.innerHTML = "";

      if (cartData.length === 0) {
        cartList.innerHTML = "<p>Giỏ hàng trống</p>";
        totalPriceEl.innerText = "0";
        return;
      }

      cartData.forEach((item) => {
        const div = document.createElement("div");
        div.className = "cart-item";

        // Checkbox
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "select-item";
        checkbox.checked = false;
        div.appendChild(checkbox);

        // Ảnh sản phẩm
        const img = document.createElement("img");
        img.src = item.anhSP ? `/Asset/${item.anhSP}` : "/Asset/no-image.jpg";
        img.alt = item.tenSP;
        div.appendChild(img);

        // Thông tin chi tiết
        const detailsDiv = document.createElement("div");
        detailsDiv.className = "cart-item-details";
        // SỬA: Xóa thẻ p thừa, thêm class item-price để chọn cho đúng
        detailsDiv.innerHTML = `
          <h3>${item.tenSP}</h3>
          <p class="item-size">Size: ${item.tenSize || "N/A"}</p> 
          <p class="item-price" data-price="${item.gia}">${Number(item.gia).toLocaleString()} VND</p>
          <div class="quantity-control">
            <button class="minus">-</button>
            <input type="number" value="${item.soLuongMua}" min="1" readonly>
            <button class="plus">+</button>
          </div>
        `;
        div.appendChild(detailsDiv);

        // Nút xóa
        const removeBtn = document.createElement("span");
        removeBtn.className = "remove-btn";
        removeBtn.innerText = "Xóa";
        div.appendChild(removeBtn);

        cartList.appendChild(div);

        // --- Event listeners ---
        const btnMinus = detailsDiv.querySelector(".minus");
        const btnPlus = detailsDiv.querySelector(".plus");

        // SỬA: Logic tính tổng tiền
        function updateTotal() {
          let total = 0;
          document.querySelectorAll(".cart-item").forEach((ci) => {
            const cb = ci.querySelector(".select-item");
            if (cb.checked) {
              // Lấy giá trị từ data-price thay vì innerText để chính xác hơn
              const priceElement = ci.querySelector(".item-price");
              const price = Number(priceElement.getAttribute("data-price"));
              const qty = Number(
                ci.querySelector("input[type='number']").value,
              );
              total += price * qty;
            }
          });
          totalPriceEl.innerText = total.toLocaleString();
        }

        // Nút giảm
        btnMinus.addEventListener("click", async () => {
          if (item.soLuongMua > 1) {
            await updateItemQuantity(
              item.maSP,
              item.maSize,
              item.soLuongMua - 1,
            );
          }
        });

        // Nút tăng
        btnPlus.addEventListener("click", async () => {
          // SỬA: Truyền đúng tham số
          await updateItemQuantity(item.maSP, item.maSize, item.soLuongMua + 1);
        });

        // Hàm gọi API update chung
        async function updateItemQuantity(maSP, maSize, newQty) {
          try {
            await fetch("/api/cart/update", {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              // SỬA: Gửi kèm maSize để backend biết update dòng nào
              body: JSON.stringify({
                maSP: maSP,
                soLuong: newQty,
                maSize: maSize,
              }),
            });
            loadCart(); // Load lại giỏ để cập nhật UI
            if (window.updateHeaderCartCount) window.updateHeaderCartCount();
          } catch (error) {
            console.error("Lỗi update:", error);
          }
        }

        removeBtn.addEventListener("click", async () => {
          if (!confirm("Bạn có chắc muốn xóa?")) return;
          try {
            await fetch(`/api/cart/remove`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ maSP: item.maSP, maSize: item.maSize }),
            });
            loadCart();
          } catch (error) {
            console.error("Lỗi xóa:", error);
          }
        });

        checkbox.addEventListener("change", updateTotal);
      });
    } catch (err) {
      console.error(err);
    }
  }

  if (checkoutBtn) {
    checkoutBtn.addEventListener("click", () => {
      const selectedItems = [];
      document.querySelectorAll(".cart-item").forEach((ci) => {
        const cb = ci.querySelector(".select-item");
        if (cb.checked) {
          const name = ci.querySelector("h3").innerText;
          const sizeTxt = ci
            .querySelector(".item-size")
            .innerText.replace("Size: ", "");
          // Tìm trong data gốc để lấy đúng ID
          const itemData = cartData.find(
            (i) => i.tenSP === name && (i.tenSize || "N/A") === sizeTxt,
          );
          if (itemData) selectedItems.push(itemData);
        }
      });

      if (selectedItems.length === 0) {
        alert("Vui lòng chọn sản phẩm để thanh toán");
        return;
      }

      localStorage.setItem("checkoutItems", JSON.stringify(selectedItems));
      window.location.href = "/html/checkout.html";
    });
  }

  loadCart();
});
