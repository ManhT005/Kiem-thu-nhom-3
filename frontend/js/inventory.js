document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "null");
  if (!token) { window.location.href = "/login"; return; }
  const message = document.getElementById("message");
  const tell = (text, error = false) => { message.textContent = text; message.className = error ? "error" : ""; };
  async function api(path, options = {}) {
    const response = await fetch("/api/inventory" + path, {
      ...options, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: options.data ? JSON.stringify(options.data) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Không thể thực hiện thao tác");
    return result.data;
  }
  async function busy(button, work) {
    if (button.disabled) return;
    button.disabled = true; button.setAttribute("aria-busy", "true"); tell("Đang xử lý...");
    try { await work(); } catch (error) { tell(error.message, true); }
    finally { button.disabled = false; button.removeAttribute("aria-busy"); }
  }
  let catalog = [], editingId = null, receiptPage = 1, movementPage = 1;
  const receiptForm = document.getElementById("receipt-form");
  const rowContainer = document.getElementById("receipt-items");
  const stateKey = `inventoryRequests:${user?.id}`;
  function keyFor(payload, operation) {
    let saved;
    try { saved = JSON.parse(sessionStorage.getItem(stateKey + operation)); } catch {}
    const fingerprint = JSON.stringify(payload);
    if (!saved || saved.fingerprint !== fingerprint) {
      saved = { fingerprint, key: crypto.randomUUID() };
      sessionStorage.setItem(stateKey + operation, JSON.stringify(saved));
    }
    return saved.key;
  }
  const label = (name, control) => {
    const wrapper = document.createElement("label"); wrapper.append(document.createTextNode(name), control); return wrapper;
  };
  function itemRow(container, values = {}, adjustment = false) {
    const row = document.createElement("div"); row.className = "item-row";
    const product = document.createElement("select"); product.name = "maSP";
    for (const item of catalog) { const option = document.createElement("option"); option.value = item.maSP; option.textContent = item.tenSP; product.append(option); }
    if (values.maSP) product.value = values.maSP;
    const size = document.createElement("select"); size.name = "maSize";
    function sizes() {
      size.replaceChildren();
      for (const item of catalog.find((item) => String(item.maSP) === product.value)?.sizes || []) {
        const option = document.createElement("option"); option.value = item.maSize; option.textContent = item.tenSize; size.append(option);
      }
    }
    sizes(); product.addEventListener("change", sizes); if (values.maSize) size.value = values.maSize;
    const quantity = document.createElement("input"); quantity.type = "number";
    quantity.name = adjustment ? "delta" : "soLuongNhap"; quantity.min = adjustment ? "-2147483647" : "1";
    quantity.max = "2147483647"; quantity.required = true; quantity.value = values.soLuongNhap || 1;
    row.append(label("Sản phẩm", product), label("Size", size), label(adjustment ? "Tăng / giảm" : "Số lượng nhập", quantity));
    if (!adjustment) {
      const cost = document.createElement("input"); cost.type = "number"; cost.name = "donGiaNhap";
      cost.min = "0"; cost.step = "0.01"; cost.required = true; cost.value = values.donGiaNhap || 0;
      row.append(label("Đơn giá nhập", cost));
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Xóa dòng";
      remove.addEventListener("click", () => row.remove()); row.append(remove);
    }
    container.append(row);
  }
  function items(container, adjustment = false) {
    return Array.from(container.querySelectorAll(".item-row")).map((row) => {
      const value = (name) => row.querySelector(`[name="${name}"]`).value;
      return { maSP: Number(value("maSP")), maSize: Number(value("maSize")),
        ...(adjustment ? { delta: Number(value("delta")) } : { soLuongNhap: Number(value("soLuongNhap")), donGiaNhap: value("donGiaNhap") }) };
    });
  }
  function renderRows(id, values, cells, actions) {
    const body = document.getElementById(id); body.replaceChildren();
    for (const item of values) {
      const row = document.createElement("tr");
      for (const value of cells(item)) { const cell = document.createElement("td"); cell.textContent = String(value ?? ""); row.append(cell); }
      if (actions) { const cell = document.createElement("td"); actions(item, cell); row.append(cell); }
      body.append(row);
    }
    if (!values.length) { const row = document.createElement("tr"), cell = document.createElement("td"); cell.colSpan = 8; cell.textContent = "Chưa có dữ liệu."; row.append(cell); body.append(row); }
  }
  async function loadReceipts() {
    const query = new URLSearchParams({ page: receiptPage, limit: 10 });
    if (document.getElementById("receipt-status").value) query.set("status", document.getElementById("receipt-status").value);
    const result = await api("/receipts?" + query);
    renderRows("receipts", result.items, (item) => [item.maPhieu, item.status === "DRAFT" ? "Nháp" : "Đã ghi nhận", item.total_amount, item.ghiChu], (item, cell) => {
      const view = document.createElement("button"); view.type = "button"; view.textContent = item.status === "DRAFT" ? "Chỉnh phiếu" : "Xem chi tiết";
      view.onclick = () => busy(view, async () => {
        const receipt = await api("/receipts/" + item.maPhieuNhap);
        editingId = item.status === "DRAFT" ? item.maPhieuNhap : null;
        rowContainer.replaceChildren(); receipt.items.forEach((line) => itemRow(rowContainer, line));
        receiptForm.elements.note.value = receipt.ghiChu || "";
        document.getElementById("save-receipt").hidden = item.status !== "DRAFT";
        document.getElementById("add-item").hidden = item.status !== "DRAFT";
        rowContainer.querySelectorAll("input,select,button").forEach((control) => { control.disabled = item.status !== "DRAFT"; });
        receiptForm.elements.note.readOnly = item.status !== "DRAFT";
        tell(item.status === "DRAFT" ? "Đang chỉnh phiếu nháp." : "Phiếu đã ghi nhận; nội dung được giữ nguyên.");
        receiptForm.scrollIntoView({ behavior: "auto" });
      }); cell.append(view);
      if (item.status === "DRAFT") {
        const post = document.createElement("button"); post.type = "button"; post.textContent = "Ghi nhận nhập kho";
        post.onclick = () => { if (confirm("Ghi nhận phiếu sẽ tăng tồn kho và không thể sửa phiếu. Tiếp tục?")) busy(post, async () => {
          await api("/receipts/" + item.maPhieuNhap + "/post", { method: "POST" });
          tell("Đã ghi nhận phiếu nhập."); await loadReceipts(); await loadMovements();
        }); }; cell.append(post);
      }
    });
    document.getElementById("receipt-page").textContent = `Trang ${receiptPage} / ${Math.max(1, result.pagination.totalPages)}`;
    document.getElementById("receipt-prev").disabled = receiptPage === 1;
    document.getElementById("receipt-next").disabled = receiptPage >= result.pagination.totalPages;
  }
  async function loadMovements() {
    const eventNames = { OPENING: "Tồn đầu", RECEIPT: "Nhập kho", ORDER: "Đặt hàng", CANCEL: "Hủy đơn", ADJUSTMENT: "Điều chỉnh" };
    const sources = { OPENING: "Tồn đầu", GOODS_RECEIPT: "Phiếu nhập", ORDER: "Đơn hàng", ADJUSTMENT: "Điều chỉnh" };
    const query = new URLSearchParams({ page: movementPage, limit: 20 });
    for (const [name, id] of [["maSP","movement-product"],["eventType","movement-event"],["fromDate","movement-from"],["toDate","movement-to"]]) {
      const value = document.getElementById(id).value; if (value) query.set(name, value);
    }
    const result = await api("/movements?" + query);
    renderRows("movements", result.items, (item) => [`${item.maSP} / ${item.maSize}`, eventNames[item.event_type], item.delta,
      `${item.quantity_before} → ${item.quantity_after}`, `${sources[item.reference_type]} #${item.reference_id}`, item.reason]);
    document.getElementById("movement-page").textContent = `Trang ${movementPage} / ${Math.max(1,result.pagination.totalPages)}`;
    document.getElementById("movement-prev").disabled = movementPage === 1;
    document.getElementById("movement-next").disabled = movementPage >= result.pagination.totalPages;
  }
  function fresh() {
    editingId = null; rowContainer.replaceChildren(); itemRow(rowContainer); receiptForm.reset();
    receiptForm.elements.note.readOnly = false;
    document.getElementById("save-receipt").hidden = false; document.getElementById("add-item").hidden = false;
  }
  receiptForm.onsubmit = (event) => {
    event.preventDefault();
    busy(document.getElementById("save-receipt"), async () => {
      const data = { note: receiptForm.elements.note.value, items: items(rowContainer) };
      if (!editingId) data.idempotencyKey = keyFor(data, "receipt");
      await api("/receipts" + (editingId ? "/" + editingId : ""), { method: editingId ? "PUT" : "POST", data });
      sessionStorage.removeItem(stateKey + "receipt"); fresh(); tell("Đã lưu phiếu nháp. Tồn kho chưa thay đổi."); await loadReceipts();
    });
  };
  document.getElementById("add-item").onclick = () => itemRow(rowContainer);
  document.getElementById("new-receipt").onclick = fresh;
  document.getElementById("refresh-receipts").onclick = (event) => busy(event.target, loadReceipts);
  document.getElementById("receipt-status").onchange = () => { receiptPage = 1; loadReceipts().catch((error) => tell(error.message, true)); };
  for (const [id, direction] of [["receipt-prev",-1],["receipt-next",1]]) document.getElementById(id).onclick = () => { receiptPage += direction; loadReceipts().catch((error) => tell(error.message,true)); };
  for (const [id, direction] of [["movement-prev",-1],["movement-next",1]]) document.getElementById(id).onclick = () => { movementPage += direction; loadMovements().catch((error) => tell(error.message,true)); };
  document.getElementById("movement-filters").onsubmit = (event) => { event.preventDefault(); movementPage = 1; loadMovements().catch((error) => tell(error.message, true)); };
  document.getElementById("low-stock-form").onsubmit = (event) => {
    event.preventDefault(); busy(event.submitter, async () => {
      const result = await api("/low-stock?threshold=" + encodeURIComponent(document.getElementById("threshold").value));
      renderRows("low-stock", result.items, (item) => [item.tenSP, item.tenSize, item.soLuongTon]); tell("Đã kiểm tra ngưỡng tồn.");
    });
  };
  document.getElementById("adjustment-form").onsubmit = (event) => {
    event.preventDefault(); if (!confirm("Ghi nhận điều chỉnh kho theo lý do đã nhập?")) return;
    busy(event.submitter, async () => {
      const data = { reason: event.target.elements.reason.value, items: items(document.getElementById("adjustment-item"), true) };
      data.idempotencyKey = keyFor(data, "adjustment");
      await api("/adjustments", { method: "POST", data }); sessionStorage.removeItem(stateKey + "adjustment");
      tell("Đã ghi nhận điều chỉnh."); await loadMovements();
    });
  };
  document.getElementById("reconcile").onclick = (event) => busy(event.target, async () => {
    const result = await api("/reconciliation?limit=100");
    renderRows("reconciliation", result.items, (item) => [`${item.maSP} / ${item.maSize}`, item.snapshotQuantity, item.ledgerQuantity, item.difference]);
    tell(result.items.some((item) => item.difference !== 0) ? "Có chênh lệch cần kiểm tra." : "Tồn kho khớp lịch sử trong trang đang xem.");
  });
  try {
    const response = await fetch("/api/kho", { headers: { Authorization: `Bearer ${token}` } });
    const result = await response.json(); if (!response.ok) throw new Error(result.message || "Bạn không có quyền xem kho");
    catalog = (result.data?.products || result.products || []).filter((item) => item.sizes?.length);
    for (const product of catalog) { const option = document.createElement("option"); option.value = product.maSP; option.textContent = product.tenSP; document.getElementById("movement-product").append(option); }
    fresh(); itemRow(document.getElementById("adjustment-item"), {}, true);
    document.getElementById("adjustment-section").hidden = user?.role !== "admin";
    await loadReceipts(); await loadMovements(); tell("Sẵn sàng tạo và ghi nhận phiếu nhập.");
  } catch (error) { tell(error.message, true); document.getElementById("save-receipt").disabled = true; }
});
