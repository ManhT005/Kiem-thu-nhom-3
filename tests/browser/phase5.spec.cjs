const {test,expect}=require("@playwright/test");
let fixture,pool;
test.beforeAll(async()=>{
  if(!/_test$/i.test(process.env.DB_NAME||"")||process.env.ORDER_CONCURRENCY_TEST!=="1")throw new Error("Reporting browser acceptance requires isolated test fixtures");
  const {default:db}=await import("../../backend/config/db.js");pool=db.promise();
  const {reportingFixture}=await import("../../backend/tests/integration/reporting-fixture.js");fixture=await reportingFixture(pool);
});
test.afterAll(async()=>{try{if(fixture)await fixture.cleanup();}finally{if(pool)await pool.end();}});
async function admin(page) {
  page.on("dialog",dialog=>dialog.accept());
  const response=await page.request.post("/api/auth/login",{data:{email:"phase2-admin@example.test",password:"Phase2Test!"}});
  expect(response.ok()).toBeTruthy();const login=await response.json();await page.goto("/");
  await page.evaluate(login=>{localStorage.setItem("user",JSON.stringify(login.user));localStorage.setItem("token",login.token);},login);
  await page.goto("/admin");await page.getByRole("button",{name:"Thống kê",exact:true}).click();
  await expect(page.locator("#dashboard-results")).toBeVisible();
}
async function period(page,from="2091-01-01",to="2091-01-05") {
  await page.locator("#dashboard-from").fill(from);await page.locator("#dashboard-to").fill(to);
  await page.locator("#dashboard-refresh").click();await expect(page.locator("#dashboard-results")).toBeVisible();
}
test("P5 UI populated reporting, keyboard filters, exact table, refund marker and safe product labels",async({page})=>{
  const name='<img src=x onerror="window.reportingXss=1">';
  await pool.execute("UPDATE SanPham SET tenSP=? WHERE maSP=?",[name,fixture.productId]);
  await admin(page);await period(page);
  await expect(page.locator("#dashboard-message")).toHaveText("Đã tải báo cáo.");
  await expect(page.locator("#dashboard-kpis")).toContainText("7.000");
  await expect(page.locator("#dashboard-products")).toContainText(name);await expect(page.locator("#dashboard-products img")).toHaveCount(0);
  expect(await page.evaluate(()=>window.reportingXss)).toBeUndefined();
  await expect(page.locator("#dashboard-series tr")).toHaveCount(4);
  await expect(page.locator("#dashboard-exceptions")).toContainText("REFUND_REQUIRED");await expect(page.locator("#dashboard-next")).toBeDisabled();
  await page.locator("#dashboard-group").selectOption("week");await page.locator("#dashboard-refresh").focus();await page.keyboard.press("Enter");
  await expect(page.locator("#dashboard-series tr")).toHaveCount(1);
  await page.screenshot({path:"test-results/phase5-dashboard.png",fullPage:true});
});
test("P5 UI empty, validation, loading, API error, denied access and mobile layout",async({page})=>{
  await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:"reduce"});await admin(page);
  await period(page,"1900-01-01","1900-01-05");await expect(page.locator("#dashboard-message")).toHaveText("Không có đơn hoàn tất trong kỳ.");
  await expect(page.locator("#dashboard-products")).toContainText("Không có sản phẩm");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.locator("#dashboard-from").fill("1900-01-06");await page.locator("#dashboard-refresh").click();
  await expect(page.locator("#dashboard-message")).toContainText("Ngày bắt đầu phải trước");await expect(page.locator("#dashboard-from")).toBeFocused();
  await page.locator("#dashboard-from").fill("1900-01-01");
  await page.route("**/api/admin/dashboard/summary?**",async route=>{await new Promise(resolve=>setTimeout(resolve,250));await route.fulfill({status:500,contentType:"application/json",body:JSON.stringify({success:false,code:"TEST_ERROR",message:"Báo cáo tạm thời không khả dụng"})});});
  await page.locator("#dashboard-refresh").click();await expect(page.locator("#dashboard-refresh")).toBeDisabled();
  await expect(page.locator("#dashboard-message")).toContainText("Báo cáo tạm thời");await expect(page.locator("#dashboard-results")).toBeHidden();
  await page.unroute("**/api/admin/dashboard/summary?**");
  await page.route("**/api/admin/dashboard/summary?**",route=>route.fulfill({status:403,contentType:"application/json",body:'{"success":false,"code":"FORBIDDEN"}'}));
  await page.locator("#dashboard-refresh").click();await expect(page.locator("#dashboard-message")).toContainText("Không có quyền");await expect(page.locator("#dashboard-results")).toBeHidden();
  await page.screenshot({path:"test-results/phase5-mobile-empty-error.png",fullPage:true});
});
