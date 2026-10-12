document.addEventListener("DOMContentLoaded", () => {
  const root = document.getElementById("dashboard");
  if (!root || !localStorage.getItem("token")) return;
  const element = (id) => document.getElementById("dashboard-" + id);
  const message = element("message"),
    results = element("results"),
    refresh = element("refresh");
  const end = new Date();
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() + 1);
  element("to").value = end.toISOString().slice(0, 10);
  element("from").value = new Date(end.getTime() - 14 * 86400000)
    .toISOString()
    .slice(0, 10);
  let page = 1,
    loaded = false,
    loading = false,
    activePeriod,
    exceptionTotal = 0;
  const format = (value) => BigInt(value).toLocaleString("vi-VN");
  function cell(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }
  function rows(target, values, empty) {
    target.replaceChildren();
    for (const value of values) {
      const tr = document.createElement("tr");
      for (const text of value) tr.append(cell("td", text));
      target.append(tr);
    }
    if (!values.length) {
      const tr = document.createElement("tr"),
        td = cell("td", empty);
      td.colSpan = 5;
      tr.append(td);
      target.append(tr);
    }
  }
  async function request(path, query) {
    const response = await fetch("/api/admin/" + path + "?" + query, {
      headers: { Authorization: "Bearer " + localStorage.getItem("token") },
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      localStorage.removeItem("token");
      window.location.assign("/login");
      throw new Error("Cần đăng nhập lại.");
    }
    if (response.status === 403) throw new Error("Không có quyền xem báo cáo.");
    const body = await response.json();
    if (!response.ok || !body.success)
      throw new Error(body.message || "Không thể tải báo cáo.");
    return body.data;
  }
  function drawChart(buckets) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 720 180");
    svg.setAttribute("aria-hidden", "true");
    const maximum = buckets.reduce(
      (max, b) =>
        BigInt(b.completedOrderValue) > max
          ? BigInt(b.completedOrderValue)
          : max,
      1n,
    );
    buckets.forEach((bucket, index) => {
      const rect = document.createElementNS(svg.namespaceURI, "rect"),
        width = 700 / buckets.length;
      // Scale integer ratios before converting; table always preserves exact VND.
      const height = Number(
        (BigInt(bucket.completedOrderValue) * 140n) / maximum,
      );
      rect.setAttribute("x", 10 + index * width);
      rect.setAttribute("y", 160 - height);
      rect.setAttribute("width", Math.max(1, width - 4));
      rect.setAttribute("height", Math.max(1, height));
      const title = document.createElementNS(svg.namespaceURI, "title");
      title.textContent =
        bucket.start.slice(0, 10) +
        ": " +
        format(bucket.completedOrderValue) +
        " VND";
      rect.append(title);
      svg.append(rect);
    });
    element("chart").replaceChildren(svg);
  }
  function render(summary, top, chart) {
    element("kpis").replaceChildren();
    for (const [label, value] of [
      ["Giá trị đơn hoàn tất (VND)", summary.completedOrderValue],
      ["Đơn hoàn tất trong kỳ", summary.completedOrderCount],
      ["Đơn tạo trong kỳ", summary.totalOrders],
      ["Giảm giá đơn hoàn tất (VND)", summary.completedDiscountAmount],
      ["Khách hàng hoạt động (toàn hệ thống)", summary.activeCustomerCount],
      ["Cần hoàn tiền (toàn hệ thống)", summary.refundRequiredCount],
    ]) {
      const card = document.createElement("div");
      card.append(cell("dt", label), cell("dd", format(value)));
      element("kpis").append(card);
    }
    element("generated").textContent = "Snapshot: " + summary.generatedAt;
    element("warning").textContent = summary.legacyExcluded
      ? format(summary.legacyExcluded) +
        " đơn legacy không có thời điểm hoàn tất hợp lệ đã bị loại khỏi doanh số."
      : "";
    rows(
      element("products"),
      top.items.map((item) => [
        item.name,
        format(item.quantity),
        format(item.grossSales),
      ]),
      "Không có sản phẩm bán trong kỳ.",
    );
    rows(
      element("series"),
      chart.buckets.map((b) => [
        b.start.slice(0, 10),
        format(b.completedOrderCount),
        format(b.completedOrderValue),
      ]),
      "Không có dữ liệu.",
    );
    element("statuses").replaceChildren(
      ...summary.ordersByStatus.map((row) =>
        cell("li", row.status + ": " + format(row.count)),
      ),
    );
    drawChart(chart.buckets);
  }
  async function exceptions() {
    const query = new URLSearchParams({
      ...activePeriod,
      status: element("exception").value,
      page,
      limit: 20,
    });
    const data = await request("payments/reconciliation", query);
    exceptionTotal = data.total;
    rows(
      element("exceptions"),
      data.items.map((item) => [
        item.orderId,
        item.orderStatus,
        item.paymentStatus,
        format(item.orderValue),
        item.reasons.join(", "),
      ]),
      "Không có ngoại lệ thanh toán trong kỳ.",
    );
    element("page").textContent =
      " Trang " + page + " · " + format(data.total) + " hồ sơ ";
    element("prev").disabled = page === 1;
    element("next").disabled = BigInt(page * 20) >= BigInt(data.total);
  }
  function busy(value) {
    loading = value;
    root.setAttribute("aria-busy", String(value));
    root.querySelectorAll("button,input,select").forEach((node) => {
      node.disabled = value;
    });
    if (!value) {
      element("prev").disabled = page === 1;
      element("next").disabled = BigInt(page * 20) >= BigInt(exceptionTotal);
    }
  }
  async function load() {
    if (loading) return;
    if (element("from").value >= element("to").value) {
      message.textContent = "Ngày bắt đầu phải trước ngày kết thúc.";
      element("from").focus();
      return;
    }
    busy(true);
    results.hidden = true;
    message.textContent = "Đang tải báo cáo…";
    page = 1;
    activePeriod = { from: element("from").value, to: element("to").value };
    try {
      const query = new URLSearchParams(activePeriod);
      const [summary, top, chart] = await Promise.all([
        request("dashboard/summary", query),
        request(
          "dashboard/top-products",
          new URLSearchParams({ ...activePeriod, sort: element("sort").value }),
        ),
        request(
          "dashboard/revenue-chart",
          new URLSearchParams({
            ...activePeriod,
            groupBy: element("group").value,
          }),
        ),
      ]);
      render(summary, top, chart);
      await exceptions();
      loaded = true;
      results.hidden = false;
      message.textContent =
        BigInt(summary.completedOrderCount) === 0n
          ? "Không có đơn hoàn tất trong kỳ."
          : "Đã tải báo cáo.";
    } catch (error) {
      loaded = false;
      results.hidden = true;
      message.textContent = error.message;
    } finally {
      busy(false);
    }
  }
  async function changePage(delta = 0) {
    if (loading || !activePeriod) return;
    const previous = page;
    page = Math.max(1, page + delta);
    busy(true);
    message.textContent = "Đang tải đối soát…";
    try {
      await exceptions();
      message.textContent = "Đã tải đối soát.";
    } catch (error) {
      page = previous;
      results.hidden = true;
      message.textContent = error.message;
    } finally {
      busy(false);
      element("prev").disabled = page === 1;
    }
  }
  element("filter").addEventListener("submit", (event) => {
    event.preventDefault();
    load();
  });
  element("exception").addEventListener("change", () => {
    page = 1;
    changePage();
  });
  element("prev").addEventListener("click", () => changePage(-1));
  element("next").addEventListener("click", () => changePage(1));
  document
    .querySelector('[data-tab="dashboard"]')
    .addEventListener("click", () => {
      if (!loaded) load();
    });
});
