const { test, expect } = require("@playwright/test");
async function login(page,email,password="Phase2Test!"){
  const response=await page.request.post("/api/auth/login",{data:{email,password}});expect(response.ok()).toBeTruthy();return response.json();
}
async function storeLogin(page,login,items){
  await page.evaluate(({login,items})=>{
    localStorage.clear();localStorage.setItem("user",JSON.stringify(login.user));localStorage.setItem("token",login.token);
    if(items)localStorage.setItem("checkoutItems",JSON.stringify(items));
  },{login,items});
}
async function connection(){
  return require("../../backend/node_modules/mysql2/promise").createConnection({host:process.env.DB_HOST||"127.0.0.1",port:Number(process.env.DB_PORT||3306),
    user:process.env.DB_USER||"root",password:process.env.DB_PASSWORD||"",database:process.env.DB_NAME});
}
test("admin UI locks/unlocks a user and changes role while old sessions are rejected",async({page})=>{
  test.skip(!/_test$/i.test(process.env.DB_NAME||""),"Dedicated seeded test DB required");
  page.on("dialog",dialog=>dialog.accept());
  const email="browser-life-"+Date.now()+"@example.test",password="BrowserLife123!";
  let userId;
  try{
    expect((await page.request.post("/api/auth/register",{data:{ten:"Browser lifecycle",email,matKhau:password}})).ok()).toBeTruthy();
    const user=await login(page,email,password);userId=user.user.id;
    const admin=await login(page,"phase2-admin@example.test");
    await page.goto("/");await storeLogin(page,admin);await page.goto("/admin");
    await expect(page.locator("#user-page")).toContainText("Trang");
    await page.locator("#user-search").fill(email);await page.locator("#user-filter").getByRole("button",{name:"Lọc tài khoản"}).click();
    const row=page.locator("#userTable tbody tr").filter({hasText:email});
    await expect(row).toBeVisible();await page.locator("#user-reason").fill("Browser lifecycle verification");
    await row.getByRole("button",{name:"Khóa tài khoản"}).click();await expect(row).toContainText("Đã khóa");
    expect((await page.request.get("/api/cart",{headers:{Authorization:`Bearer ${user.token}`}})).status()).toBe(403);
    const locked=await page.request.post("/api/auth/login",{data:{email,password}});expect(locked.status()).toBe(403);
    await row.getByRole("button",{name:"Mở khóa"}).click();await expect(row).toContainText("Hoạt động");
    expect((await page.request.get("/api/cart",{headers:{Authorization:`Bearer ${user.token}`}})).status()).toBe(401);
    const fresh=await login(page,email,password);
    const changed=page.waitForResponse(response=>response.url().endsWith(`/api/admin/users/${userId}/role`)&&response.request().method()==="PUT");
    await row.locator("select").selectOption("staff");
    expect((await changed).status()).toBe(200);await expect(row.locator("select")).toHaveValue("staff");
    await expect(page.locator("#user-message")).toContainText("Đã cập nhật tài khoản");
    expect((await page.request.get("/api/inventory/receipts",{headers:{Authorization:`Bearer ${fresh.token}`}})).status()).toBe(401);
    const staff=await login(page,email,password);expect(staff.user.role).toBe("staff");
    expect((await page.request.get("/api/inventory/receipts",{headers:{Authorization:`Bearer ${staff.token}`}})).status()).toBe(200);
    await page.screenshot({path:"test-results/phase4-users.png",fullPage:true});
  }finally{
    if(userId){const db=await connection();try{await db.execute("DELETE FROM UserLifecycleAudit WHERE user_id=?",[userId]);await db.execute("DELETE FROM users WHERE id=?",[userId]);}finally{await db.end();}}
  }
});
test("admin creates a voucher in UI and real checkout previews and reserves a server-priced discount",async({page})=>{
  test.skip(!/_test$/i.test(process.env.DB_NAME||""),"Dedicated seeded test DB required");
  page.on("dialog",dialog=>dialog.accept());
  const code="BR-"+Date.now(),email="browser-voucher-"+Date.now()+"@example.test",password="BrowserVoucher123!";
  let voucherId,userId,orderId,user;
  try{
    const admin=await login(page,"phase2-admin@example.test");
    await page.goto("/");await storeLogin(page,admin);await page.goto("/vouchers");
    await expect(page.locator("#voucher-message")).toContainText("Sẵn sàng");
    await page.locator('#voucher-form [name="code"]').fill(code);
    await page.locator('#voucher-form [name="discountType"]').selectOption("FIXED");
    await page.locator('#voucher-form [name="discountValue"]').fill("500");
    await page.locator('#voucher-form [name="usageLimit"]').fill("1");
    const created=page.waitForResponse(response=>response.url().endsWith("/api/admin/vouchers")&&response.request().method()==="POST");
    await page.locator("#save-voucher").click();voucherId=(await(await created).json()).data.maGiamGia;
    await expect(page.locator("#voucher-message")).toContainText("Đã lưu voucher");
    await expect(page.locator("#vouchers tr").filter({hasText:code})).toBeVisible();
    expect((await page.request.post("/api/auth/register",{data:{ten:"Browser voucher",email,matKhau:password}})).ok()).toBeTruthy();
    user=await login(page,email,password);userId=user.user.id;
    const headers={Authorization:`Bearer ${user.token}`};
    expect((await page.request.post("/api/users/address",{headers,data:{address:"Voucher browser address"}})).ok()).toBeTruthy();
    expect((await page.request.post("/api/cart/add",{headers,data:{maSP:93003,maSize:92901,soLuong:1}})).ok()).toBeTruthy();
    await storeLogin(page,user,[{maSP:93003,maSize:92901,soLuongMua:1,gia:1,tenSP:"Fake displayed price"}]);
    await page.goto("/checkout");await page.locator("#sdt").fill("0900000000");
    await page.waitForFunction(()=>document.getElementById("diaChiGiaoHang").value==="Voucher browser address");
    await page.locator("#voucherCode").fill(code);
    const preview=page.waitForResponse(response=>response.url().endsWith("/api/vouchers/validate"));
    await page.locator("#applyVoucher").click();
    const quoted=(await(await preview).json()).data;expect(quoted.subtotalBeforeDiscount).toBe(3000);expect(quoted.discountAmount).toBe(500);
    await expect(page.locator("#voucherDiscount")).toHaveText("500 VND");await expect(page.locator("#finalTotal")).toHaveText(/2[,.]500 VND/);
    const before=await(await page.request.get("/api/admin/vouchers?code="+code,{headers:{Authorization:`Bearer ${admin.token}`}})).json();expect(before.data.items[0].used_count).toBe(0);
    await page.screenshot({path:"test-results/phase4-checkout.png",fullPage:true});
    const ordered=page.waitForResponse(response=>response.url().endsWith("/api/orders/create"));await page.locator("#btnPlaceOrder").click();
    const order=(await(await ordered).json()).data;orderId=order.maDonHang;expect(order.tongTien).toBe(2500);expect(order.discountAmount).toBe(500);
    await expect(page).toHaveURL("http://127.0.0.1:3000/");
    const after=await(await page.request.get("/api/admin/vouchers?code="+code,{headers:{Authorization:`Bearer ${admin.token}`}})).json();expect(after.data.items[0].used_count).toBe(1);
    expect((await page.request.put(`/api/orders/${orderId}/cancel`,{headers,data:{}})).ok()).toBeTruthy();
    const released=await(await page.request.get("/api/admin/vouchers?code="+code,{headers:{Authorization:`Bearer ${admin.token}`}})).json();expect(released.data.items[0].used_count).toBe(0);
  }finally{
    if(userId||voucherId){
      if(orderId&&user)await page.request.put(`/api/orders/${orderId}/cancel`,{headers:{Authorization:`Bearer ${user.token}`},data:{}});
      const db=await connection();try{
        if(userId){await db.execute("DELETE FROM DonHang WHERE id=?",[userId]);await db.execute("DELETE FROM users WHERE id=?",[userId]);}
        if(voucherId){await db.execute("DELETE FROM VoucherAudit WHERE voucher_id=?",[voucherId]);await db.execute("DELETE FROM GiamGia WHERE maGiamGia=?",[voucherId]);}
      }finally{await db.end();}
    }
  }
});
