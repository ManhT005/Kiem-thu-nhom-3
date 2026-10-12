import "dotenv/config";
import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import db from "../../config/db.js";
import app from "../../app.js";
import { SECRET_KEY } from "../../config/config.js";
import { fixture, integrationEnabled } from "./fixture-helper.js";
import { saveVoucher, previewVoucher, setVoucherStatus } from "../../services/voucher.service.js";
import { createOrder, cancelOrder, updateOrderStatus } from "../../services/order.service.js";
import { changeUserLifecycle } from "../../services/user-lifecycle.service.js";
import { createMomoPaymentForOrder, processMomoIpn, expirePendingMomoPayments } from "../../services/payment.service.js";
import { ORDER_STATUS } from "../../domain/order-status.js";
const pool = db.promise();
let server,baseUrl;
before(async()=>{
  if(!integrationEnabled)return;
  server=app.listen(0);await once(server,"listening");baseUrl="http://127.0.0.1:"+server.address().port;
});
after(async()=>{
  if(server)await new Promise((resolve,reject)=>{server.close(error=>error?reject(error):resolve());server.closeIdleConnections();});
  await pool.end();
});
function input(overrides={}) {
  return {code:"V-"+randomUUID(),discountType:"FIXED",discountValue:500,minimumOrderAmount:0,
    startAt:new Date(Date.now()-60000).toISOString(),endAt:new Date(Date.now()+3600000).toISOString(),
    usageLimit:10,perUserLimit:1,enabled:true,...overrides};
}
const integration=(name,work)=>test(name,{skip:!integrationEnabled},async()=>{
  const f=await fixture(pool),vouchers=[];
  const createVoucher=async(overrides={})=>{const value=input(overrides),voucher=await saveVoucher(value,f.users.admin);vouchers.push(voucher.maGiamGia);return {input:value,voucher};};
  try{await work(f,createVoucher);}finally{
    await pool.execute("DELETE FROM UserLifecycleAudit WHERE user_id IN ("+Object.values(f.users).map(()=>"?").join(",")+")",Object.values(f.users));
    await f.cleanup();
    for(const id of vouchers){await pool.execute("DELETE FROM VoucherAudit WHERE voucher_id = ?",[id]);await pool.execute("DELETE FROM GiamGia WHERE maGiamGia = ?",[id]);}
  }
});
async function token(id,claimRole="user") {
  const [[user]]=await pool.execute("SELECT token_version FROM users WHERE id = ?",[id]);
  return jwt.sign({id,role:claimRole,token_version:user.token_version},SECRET_KEY);
}
async function api(path,method="GET",auth,data) {
  const response=await fetch(baseUrl+path,{method,headers:{"Content-Type":"application/json",...(auth?{Authorization:"Bearer "+auth}:{})},
    body:data===undefined?undefined:JSON.stringify(data)});
  return {status:response.status,body:await response.json()};
}
async function voucherCount(id){const [[row]]=await pool.execute("SELECT used_count FROM GiamGia WHERE maGiamGia = ?",[id]);return row.used_count;}

integration("lock/unlock revokes old JWT immediately, locked login fails, and audit records actor/reason/version",async(f)=>{
  await pool.execute("UPDATE users SET matKhau = ? WHERE id = ?",[bcrypt.hashSync("Phase4Test!",10),f.users.user]);
  const [[user]]=await pool.execute("SELECT email FROM users WHERE id = ?",[f.users.user]);
  const old=await token(f.users.user),admin=await token(f.users.admin,"admin");
  assert.equal((await api("/api/cart","GET",old)).status,200);
  assert.equal((await api("/api/admin/users/"+f.users.user+"/lock","PUT",admin,{reason:"QA lock"})).status,200);
  const locked=await api("/api/cart","GET",old);
  assert.equal(locked.status,403);assert.equal(locked.body.code,"ACCOUNT_LOCKED");
  const login=await api("/api/auth/login","POST",null,{email:user.email,password:"Phase4Test!"});
  assert.equal(login.status,403);assert.equal(login.body.code,"ACCOUNT_LOCKED");
  assert.equal((await api("/api/admin/users/"+f.users.user+"/unlock","PUT",admin,{reason:"QA unlock"})).status,200);
  assert.equal((await api("/api/cart","GET",old)).body.code,"TOKEN_REVOKED");
  const fresh=await api("/api/auth/login","POST",null,{email:user.email,password:"Phase4Test!"});
  assert.equal(fresh.status,200);assert.equal((await api("/api/cart","GET",fresh.body.token)).status,200);
  const [audit]=await pool.execute("SELECT * FROM UserLifecycleAudit WHERE user_id = ? ORDER BY id",[f.users.user]);
  assert.equal(audit.length,2);assert.ok(audit.every(row=>row.actor_id===f.users.admin));assert.equal(audit[0].reason,"QA lock");
  assert.equal(audit[1].after_state.token_version,2);
});
integration("role change revokes old staff JWT, current role ignores claims, and legacy role setter is audited",async(f)=>{
  const staff=await token(f.users.staff,"staff"),admin=await token(f.users.admin,"admin");
  assert.equal((await api("/api/inventory/receipts","GET",staff)).status,200);
  const changed=await api("/api/users/"+f.users.staff+"/role","PUT",admin,{role:"user",reason:"QA legacy role"});
  assert.equal(changed.status,200);
  assert.equal((await api("/api/inventory/receipts","GET",staff)).body.code,"TOKEN_REVOKED");
  const forged=await token(f.users.staff,"admin");
  assert.equal((await api("/api/admin/users","GET",forged)).status,403);
  assert.equal((await api("/api/cart","GET",forged)).status,200);
  assert.equal((await api("/api/admin/users/"+f.users.admin+"/lock","PUT",admin,{reason:"Self lock"})).body.code,"SELF_MANAGEMENT_FORBIDDEN");
  const [audit]=await pool.execute("SELECT * FROM UserLifecycleAudit WHERE user_id = ?",[f.users.staff]);assert.equal(audit.length,1);
});
integration("RBAC matrix covers guest/user/staff/admin on protected inventory/user/cart/order/voucher/product routes",async(f)=>{
  const routes=[
    ["/api/admin/users","GET",{admin:200}],["/api/admin/vouchers","GET",{admin:200}],
    ["/api/inventory/receipts","GET",{staff:200,admin:200}],["/api/inventory/reconciliation","GET",{admin:200}],
    ["/api/cart","GET",{user:200}],["/api/orders/my-orders","GET",{user:200}],["/api/orders/all","GET",{staff:200,admin:200}],
    ["/api/vouchers/validate","POST",{user:400}],["/api/inventory/receipts","POST",{staff:400,admin:400}],
    ["/api/inventory/adjustments","POST",{admin:400}],["/api/payments/momo/create","POST",{user:400}],
    ["/api/products","POST",{admin:400}],
  ];
  for(const role of ["guest","user","staff","admin"]){
    const auth=role==="guest"?null:await token(f.users[role],role);
    for(const[path,method,allowed]of routes){
      const result=await api(path,method,auth,method==="POST"?{}:undefined);
      assert.equal(result.status,role==="guest"?401:allowed[role]??403,role+" "+method+" "+path);
    }
  }
});
integration("concurrent reciprocal admin demotions serialize and preserve an active administrator",async(f)=>{
  const [added]=await pool.execute("INSERT INTO users (ten,email,matKhau,role) VALUES ('Admin QA',?,'unused','admin')",["admin-"+randomUUID()+"@example.test"]);
  f.users.admin2=added.insertId;
  const changes=await Promise.allSettled([
    changeUserLifecycle({actorId:f.users.admin,userId:f.users.admin2,operation:"ROLE",role:"user",reason:"QA reciprocal"}),
    changeUserLifecycle({actorId:f.users.admin2,userId:f.users.admin,operation:"ROLE",role:"user",reason:"QA reciprocal"}),
  ]);
  assert.equal(changes.filter(value=>value.status==="fulfilled").length,1);
  const [[count]]=await pool.execute("SELECT COUNT(*) AS count FROM users WHERE id IN (?,?) AND role='admin' AND status='ACTIVE'",[f.users.admin,f.users.admin2]);
  assert.equal(count.count,1);
});
integration("preview is server-priced and consumes no usage; concurrent identical checkout reserves once",async(f,create)=>{
  const {voucher}=await create({discountType:"PERCENT",discountValue:"20.00",maximumDiscountAmount:400});
  const preview=await previewVoucher({userId:f.users.user,voucherCode:voucher.code,subtotal:1,discountAmount:999999,items:f.order().items});
  assert.equal(preview.subtotalBeforeDiscount,2500);assert.equal(preview.discountAmount,400);assert.equal(preview.totalAfterDiscount,2100);
  assert.equal(await voucherCount(voucher.maGiamGia),0);
  const request=f.order({voucherCode:voucher.code,idempotencyKey:randomUUID(),tongTien:1,discountAmount:9999});
  const orders=await Promise.all(Array.from({length:10},()=>createOrder(request)));
  assert.equal(new Set(orders.map(order=>order.maDonHang)).size,1);assert.equal(orders[0].tongTien,2100);
  assert.equal(await voucherCount(voucher.maGiamGia),1);assert.equal(await f.stock(),9);
  const [[rows]]=await pool.execute("SELECT COUNT(*) AS count FROM VoucherRedemption WHERE voucher_id=?",[voucher.maGiamGia]);assert.equal(rows.count,1);
});
integration("ten buyers competing for one voucher usage produce one order and one reservation",async(f,create)=>{
  const {voucher}=await create({usageLimit:1});
  const buyers=[f.users.user];
  for(let index=0;index<9;index++){const[result]=await pool.execute("INSERT INTO users (ten,email,matKhau,role) VALUES ('Buyer',?,'unused','user')",["buyer-"+randomUUID()+"@example.test"]);buyers.push(result.insertId);f.users["buyer"+index]=result.insertId;}
  const outcomes=await Promise.allSettled(buyers.map(userId=>createOrder(f.order({userId,voucherCode:voucher.code}))));
  assert.equal(outcomes.filter(value=>value.status==="fulfilled").length,1);
  assert.ok(outcomes.filter(value=>value.status==="rejected").every(value=>value.reason.code==="VOUCHER_USAGE_LIMIT"));
  assert.equal(await voucherCount(voucher.maGiamGia),1);assert.equal(await f.stock(),9);
});
integration("per-user limit and invalid/disabled voucher failures leave order/cart/ledger/stock untouched",async(f,create)=>{
  const {voucher}=await create({usageLimit:null});
  await createOrder(f.order({voucherCode:voucher.code}));
  const [cart]=await pool.execute("INSERT INTO GioHang (userId) VALUES (?)",[f.users.user]);
  await pool.execute("INSERT INTO ChiTietGioHang (maGioHang,maSP,maSize,soLuongMua) VALUES (?,?,?,1)",[cart.insertId,f.productId,f.variant().maSize]);
  await assert.rejects(createOrder(f.order({voucherCode:voucher.code})),{code:"VOUCHER_USER_LIMIT"});
  await setVoucherStatus(voucher.maGiamGia,false,f.users.admin);
  await assert.rejects(createOrder(f.order({voucherCode:voucher.code})),{code:"VOUCHER_DISABLED"});
  await assert.rejects(createOrder(f.order({voucherCode:"UNKNOWN-"+randomUUID()})),{code:"VOUCHER_NOT_FOUND"});
  const [[orders]]=await pool.execute("SELECT COUNT(*) AS count FROM DonHang WHERE id=?",[f.users.user]);assert.equal(orders.count,1);
  assert.equal(await f.stock(),9);assert.equal(await voucherCount(voucher.maGiamGia),1);
  const [[ledger]]=await pool.execute("SELECT COUNT(*) AS count FROM InventoryMovement WHERE maSP=? AND event_type='ORDER'",[f.productId]);assert.equal(ledger.count,1);
  const [[cartItems]]=await pool.execute("SELECT COUNT(*) AS count FROM ChiTietGioHang WHERE maGioHang=?",[cart.insertId]);assert.equal(cartItems.count,1);
});
integration("late DB failure rolls back voucher reservation, order, all stock rows and ledger",async(f,create)=>{
  const {voucher}=await create();
  const trigger="voucher_qa_"+randomUUID().replaceAll("-","");
  assert.match(trigger,/^voucher_qa_[a-f0-9]{32}$/);
  try{
    await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON InventoryMovement FOR EACH ROW BEGIN
      IF NEW.maSP=${f.productId} AND NEW.maSize=${f.variant(1).maSize} AND NEW.event_type='ORDER' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='QA rollback injection'; END IF; END`);
    await assert.rejects(createOrder(f.order({voucherCode:voucher.code,items:[0,1].map(index=>({...f.variant(index),soLuongMua:1}))})),{code:"ER_SIGNAL_EXCEPTION"});
    assert.equal(await voucherCount(voucher.maGiamGia),0);assert.equal(await f.stock(),10);assert.equal(await f.stock(1),10);
    const [[orders]]=await pool.execute("SELECT COUNT(*) AS count FROM DonHang WHERE id=?",[f.users.user]);assert.equal(orders.count,0);
    const [[redemptions]]=await pool.execute("SELECT COUNT(*) AS count FROM VoucherRedemption WHERE voucher_id=?",[voucher.maGiamGia]);assert.equal(redemptions.count,0);
    const [[ledger]]=await pool.execute("SELECT COUNT(*) AS count FROM InventoryMovement WHERE maSP=?",[f.productId]);assert.equal(ledger.count,0);
  }finally{await pool.query(`DROP TRIGGER IF EXISTS ${trigger}`);}
});
integration("concurrent cancellation releases usage once and completed COD keeps discount snapshot after edits",async(f,create)=>{
  const {input:definition,voucher}=await create();
  const request=f.order({voucherCode:voucher.code});
  const order=await createOrder(request);
  const cancelled=await Promise.allSettled(Array.from({length:10},()=>cancelOrder({orderId:order.maDonHang,actorId:f.users.user})));
  assert.equal(cancelled.filter(value=>value.status==="fulfilled").length,1);assert.equal(await voucherCount(voucher.maGiamGia),0);assert.equal(await f.stock(),10);
  const next=await createOrder(request);
  for(const targetStatus of [ORDER_STATUS.CONFIRMED,ORDER_STATUS.SHIPPING,ORDER_STATUS.COMPLETED])await updateOrderStatus({orderId:next.maDonHang,actorId:f.users.staff,targetStatus});
  await saveVoucher({...definition,discountValue:1000},f.users.admin,voucher.maGiamGia);
  const [[snapshot]]=await pool.execute("SELECT tongTien,discount_amount,subtotal_before_discount,voucher_code_snapshot FROM DonHang WHERE maDonHang=?",[next.maDonHang]);
  assert.equal(Number(snapshot.tongTien),2000);assert.equal(Number(snapshot.discount_amount),500);assert.equal(Number(snapshot.subtotal_before_discount),2500);assert.equal(snapshot.voucher_code_snapshot,voucher.code);
  await assert.rejects(cancelOrder({orderId:next.maDonHang,actorId:f.users.user}),{code:"ORDER_CANCEL_NOT_ALLOWED"});
  assert.equal(await voucherCount(voucher.maGiamGia),1);
  await assert.rejects(saveVoucher({...definition,usageLimit:0},f.users.admin,voucher.maGiamGia),{code:"VOUCHER_LIMIT_BELOW_USAGE"});
});
integration("MoMo FAILED/EXPIRED release once; PAID commits and paid cancellation retains usage for refund",async(f,create)=>{
  const {voucher}=await create({usageLimit:10,perUserLimit:10});
  const [[method]]=await pool.execute("SELECT maPTTT FROM phuongThucThanhToan WHERE tenPTTT='MOMO' LIMIT 1");
  for(const outcome of ["FAILED","EXPIRED","PAID"]){
    const order=await createOrder(f.order({maPTTT:method.maPTTT,voucherCode:voucher.code}));
    await createMomoPaymentForOrder({orderId:order.maDonHang,userId:f.users.user},{makePaymentLink:async()=>({resultCode:0,payUrl:"https://test-payment.momo.vn/pay"})});
    const [[payment]]=await pool.execute("SELECT * FROM MomoPaymentTransaction WHERE maDonHang=?",[order.maDonHang]);
    const payload={partnerCode:"MOMO",amount:Number(payment.amount),orderId:payment.provider_order_id,requestId:payment.request_id,resultCode:outcome==="FAILED"?1006:0,transId:String(payment.id+10000000)};
    if(outcome==="EXPIRED"){
      await pool.execute("UPDATE DonHang SET payment_expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE maDonHang=?",[order.maDonHang]);
      await pool.execute("UPDATE MomoPaymentTransaction SET expires_at=DATE_SUB(NOW(),INTERVAL 1 MINUTE) WHERE maDonHang=?",[order.maDonHang]);
      await Promise.all([expirePendingMomoPayments(),expirePendingMomoPayments()]);
      assert.equal(await voucherCount(voucher.maGiamGia),0);
      const late=await processMomoIpn(payload);assert.equal(late.paymentStatus,"REFUND_REQUIRED");assert.equal(await voucherCount(voucher.maGiamGia),0);
    }else{
      await processMomoIpn(payload);await processMomoIpn(payload);
      assert.equal(await voucherCount(voucher.maGiamGia),outcome==="PAID"?1:0);
      if(outcome==="PAID"){
        await updateOrderStatus({orderId:order.maDonHang,targetStatus:ORDER_STATUS.CANCELLED,actorId:f.users.staff,reason:"Paid refund"});
        assert.equal(await voucherCount(voucher.maGiamGia),1);
        const [[state]]=await pool.execute("SELECT payment_status FROM DonHang WHERE maDonHang=?",[order.maDonHang]);assert.equal(state.payment_status,"REFUND_REQUIRED");
      }
    }
    const [[redemption]]=await pool.execute("SELECT status FROM VoucherRedemption WHERE order_id=?",[order.maDonHang]);
    assert.equal(redemption.status,outcome==="PAID"?"COMMITTED":"RELEASED");assert.equal(await f.stock(),10);
  }
});
