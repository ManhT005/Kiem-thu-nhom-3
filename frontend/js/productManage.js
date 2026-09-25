document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  let editingProductId = null;

  async function fetchData(endpoint) {
    try {
      const res = await fetch(`/api/${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return await res.json();
    } catch (err) {
      return { error: true };
    }
  }

  // --- Render List (Giữ nguyên) ---
  async function renderProducts() {
    const data = await fetchData("products");
    const products = data.products || [];
    const tbody = document.querySelector("#productTable tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    if (products.length === 0) {
      tbody.innerHTML = "<tr><td colspan='6'>Chưa có sản phẩm nào</td></tr>";
      return;
    }

    const catData = await fetchData("categories");
    const categories = catData.categories || [];
    const catMap = {};
    categories.forEach((c) => (catMap[c.maDanhMuc] = c.tenDanhMuc));

    for (const p of products) {
      const pCats = await fetchData(`products/${p.maSP}/categories`);
      const catNames = (pCats.categories || []).map(
        (c) => catMap[c.maDanhMuc] || c.maDanhMuc,
      );
      const catDisplay =
        catNames.length > 0 ? catNames.join(", ") : "Chưa phân loại";
      const imgSrc = p.anhSP ? `/Asset/${p.anhSP}` : "/Asset/no-image.jpg";

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${p.maSP}</td>
        <td>${p.tenSP}</td>
        <td>${Number(p.gia).toLocaleString()}</td>
        <td>${catDisplay}</td>
        <td><img src="${imgSrc}" width="50"></td>
        <td>
          <button class="edit-btn" data-id="${p.maSP}">Sửa</button>
          <button class="delete-btn" data-id="${p.maSP}">Xóa</button>
        </td>
      `;
      tbody.appendChild(tr);
    }

    document
      .querySelectorAll(".edit-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => editProduct(btn.dataset.id)),
      );
    document
      .querySelectorAll(".delete-btn")
      .forEach((btn) =>
        btn.addEventListener("click", () => deleteProduct(btn.dataset.id)),
      );
  }

  // --- Logic Form ---
  const form = document.getElementById("productForm");
  const modal = document.getElementById("productModal");
  const closeBtn = document.getElementById("closeProductModal");

  // === HÀM SỬA (ĐÃ SỬA LOGIC HIỂN THỊ SIZE) ===
  window.editProduct = async function (id) {
    console.log("Đang sửa sản phẩm:", id);
    editingProductId = id;

    // 1. Lấy dữ liệu sản phẩm từ Backend
    const data = await fetchData(`products/${id}`);
    if (!data.product) return alert("Lỗi tải sản phẩm");
    const p = data.product;

    const title = document.getElementById("modalTitle");
    if (title) title.innerText = "Sửa sản phẩm";

    // 2. Điền thông tin cơ bản
    const nameInput = document.getElementById("productName");
    if (nameInput) nameInput.value = p.tenSP || "";

    const priceInput = document.getElementById("productPrice");
    if (priceInput) priceInput.value = p.gia || 0;

    const descInput = document.getElementById("productDesc");
    if (descInput) descInput.value = p.moTa || "";

    // 3. --- SỬA ĐOẠN NÀY: XỬ LÝ CHECKBOX SIZE ---

    // Bước A: Reset (Bỏ chọn hết các ô checkbox trước)
    document
      .querySelectorAll('input[name="productSize"]')
      .forEach((cb) => (cb.checked = false));
    document.querySelectorAll(".size-stock").forEach((input) => {
      input.value = 0;
      input.disabled = true;
    });

    // Bước B: Điền lại các ô đã có
    // Backend trả về mảng object: [{maSize: 1, tenSize: "S"}, ...]
    if (p.sizes && Array.isArray(p.sizes)) {
      p.sizes.forEach((sizeObj) => {
        // LƯU Ý: Phải lấy thuộc tính .tenSize của đối tượng
        // sizeObj.tenSize sẽ là "S", "M"... khớp với value trong HTML
        const cb = document.querySelector(
          `input[name="productSize"][value="${sizeObj.tenSize}"]`,
        );
        const stockInput = document.querySelector(
          `.size-stock[data-size="${sizeObj.tenSize}"]`,
        );
        if (cb) cb.checked = true;
        if (stockInput) {
          stockInput.disabled = false;
          stockInput.value = sizeObj.soLuongTon || 0;
        }
      });
    }
    // ---------------------------------------------

    // 4. Xử lý Ảnh
    const imgDiv = document.getElementById("currentImage");
    if (imgDiv) {
      if (p.anhSP) {
        imgDiv.innerHTML = `<img src="/Asset/${p.anhSP}" width="80" style="margin-top:5px;">`;
        imgDiv.dataset.oldimage = p.anhSP;
        imgDiv.style.display = "block";
      } else {
        imgDiv.style.display = "none";
      }
    }

    // 5. Xử lý Danh mục
    const pCatData = await fetchData(`products/${id}/categories`);
    const selectedIds = (pCatData.categories || []).map((c) => c.maDanhMuc);
    loadCategories(selectedIds);

    // Hiện Modal
    if (modal) modal.style.display = "block";
  };

  // Hàm Xóa (Giữ nguyên)
  window.deleteProduct = async function (id) {
    if (!confirm("Chắc chắn xóa?")) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (res.ok) {
        alert("Đã xóa");
        renderProducts();
      } else alert(d.message);
    } catch (e) {
      console.error(e);
    }
  };

  // === SUBMIT FORM (Logic gửi Size về Backend) ===
  const btnSave = document.getElementById("btnSaveProduct");

  if (btnSave) {
    btnSave.addEventListener("click", async () => {
      // Validation
      const form = document.getElementById("productForm");
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Gom dữ liệu vào FormData
      const formData = new FormData();
      formData.append("tenSP", document.getElementById("productName").value);
      formData.append("gia", document.getElementById("productPrice").value);
      formData.append("moTa", document.getElementById("productDesc").value);

      // Lấy Categories
      const cats = [];
      document
        .querySelectorAll("#productCategoriesContainer input:checked")
        .forEach((cb) => cats.push(cb.value));
      formData.append("categories", JSON.stringify(cats));

      // --- XỬ LÝ LẤY SIZE ĐỂ GỬI ĐI (QUAN TRỌNG) ---
      const sizes = [];
      document
        .querySelectorAll('input[name="productSize"]:checked')
        .forEach((cb) => {
          const stockInput = document.querySelector(
            `.size-stock[data-size="${cb.value}"]`,
          );
          sizes.push({
            tenSize: cb.value,
            soLuongTon: Number(stockInput?.value || 0),
          });
        });
      formData.append("sizes", JSON.stringify(sizes));

      // Lấy Ảnh
      const file = document.getElementById("productImage").files[0];
      if (file) formData.append("anhSP", file);
      if (editingProductId) {
        const old = document.getElementById("currentImage")?.dataset.oldimage;
        if (old) formData.append("oldImage", old);
      }

      // Gửi API
      const url = editingProductId
        ? `/api/products/${editingProductId}`
        : "/api/products";
      const method = editingProductId ? "PUT" : "POST";

      try {
        const res = await fetch(url, {
          method: method,
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (res.ok) {
          alert("Thành công!");
          document.getElementById("productModal").style.display = "none";
          renderProducts(); // Tải lại danh sách để cập nhật
        } else {
          const d = await res.json();
          alert(d.message || "Có lỗi xảy ra");
        }
      } catch (err) {
        console.error(err);
        alert("Lỗi kết nối server");
      }
    });
  }

  // Helper functions
  async function loadCategories(selectedIds = []) {
    const data = await fetchData("categories");
    const container = document.getElementById("productCategoriesContainer");
    container.innerHTML = "";
    (data.categories || []).forEach((c) => {
      const div = document.createElement("div");
      div.className = "checkbox-wrapper";
      div.innerHTML = `
            <input type="checkbox" id="cat_${c.maDanhMuc}" value="${c.maDanhMuc}" 
              ${selectedIds.includes(c.maDanhMuc) ? "checked" : ""}>
            <label for="cat_${c.maDanhMuc}">${c.tenDanhMuc}</label>
          `;
      container.appendChild(div);
    });
  }

  // Nút Thêm sản phẩm (Reset form)
  const addBtn = document.getElementById("addProductBtn");
  if (addBtn)
    addBtn.onclick = () => {
      editingProductId = null;
      form.reset();
      document.getElementById("currentImage").style.display = "none";
      document.getElementById("modalTitle").innerText = "Thêm sản phẩm";

      // Reset checkbox size khi thêm mới (bỏ chọn hết)
      document
        .querySelectorAll('input[name="productSize"]')
        .forEach((cb) => (cb.checked = false));
      document.querySelectorAll(".size-stock").forEach((input) => {
        input.value = 0;
        input.disabled = true;
      });

      loadCategories([]);
      modal.style.display = "block";
    };

  // Nút Đóng Modal
  if (closeBtn) {
    closeBtn.onclick = () => {
      modal.style.display = "none";
    };
  }

  document.querySelectorAll('input[name="productSize"]').forEach((cb) => {
    cb.addEventListener("change", () => {
      const stockInput = document.querySelector(
        `.size-stock[data-size="${cb.value}"]`,
      );
      if (stockInput) stockInput.disabled = !cb.checked;
    });
  });

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  // Init
  const activeTab = localStorage.getItem("activeTab");
  if (activeTab === "products") {
    renderProducts();
  }

  const productTabBtn = document.querySelector('li[data-tab="products"]');
  if (productTabBtn) {
    productTabBtn.addEventListener("click", () => {
      renderProducts();
    });
  }
});
