import test from "node:test";
import assert from "node:assert/strict";
import { voucherInput, voucherCode, calculateVoucher } from "../domain/voucher.js";
const start=new Date("2026-01-01T00:00:00Z"),end=new Date("2026-01-02T00:00:00Z"),now=new Date("2026-01-01T12:00:00Z");
const voucher=(overrides={})=>({enabled:1,discount_type:"PERCENT",discount_value:"10.00",minimum_order_amount:"1000.00",
  maximum_discount_amount:null,start_at:start,end_at:end,usage_limit:1,used_count:0,per_user_limit:1,...overrides});
test("voucher decision table rejects each ineligible state before returning a discount",()=>{
  for(const[fields,subtotal,uses,time,code]of [
    [{enabled:0},1000,0,now,"VOUCHER_DISABLED"],[{},1000,0,new Date(start-1),"VOUCHER_NOT_STARTED"],
    [{},1000,0,end,"VOUCHER_EXPIRED"],[{},999,0,now,"MIN_ORDER_NOT_MET"],
    [{used_count:1},1000,0,now,"VOUCHER_USAGE_LIMIT"],[{},1000,1,now,"VOUCHER_USER_LIMIT"],
    [{usage_limit:0},1000,0,now,"VOUCHER_USAGE_LIMIT"],[{per_user_limit:0},1000,0,now,"VOUCHER_USER_LIMIT"]]) {
    assert.throws(()=>calculateVoucher(voucher(fields),subtotal,uses,time),{code});
  }
  assert.equal(calculateVoucher(voucher(),1000,0,start),100);
  assert.equal(calculateVoucher(voucher(),1000,0,new Date(end-1)),100);
});
test("voucher percent/fixed floors VND, applies cap and never produces a negative total",()=>{
  assert.equal(calculateVoucher(voucher({discount_value:"12.34",minimum_order_amount:"0"}),10001,0,now),1234);
  assert.equal(calculateVoucher(voucher({maximum_discount_amount:"50.00"}),2000,0,now),50);
  assert.equal(calculateVoucher(voucher({maximum_discount_amount:"0.00"}),2000,0,now),0);
  assert.equal(calculateVoucher(voucher({discount_value:"100"}),2000,0,now),2000);
  assert.equal(calculateVoucher(voucher({discount_type:"FIXED",discount_value:"5000",minimum_order_amount:"0"}),1000,0,now),1000);
  assert.equal(calculateVoucher(voucher({discount_type:"FIXED",discount_value:"1.99",minimum_order_amount:"0"}),1000,0,now),1);
});
test("voucher input validates normalized code, money/date/type boundaries and zero/unlimited usage",()=>{
  const input={code:" test_code ",discountType:"PERCENT",discountValue:1,startAt:start.toISOString(),endAt:end.toISOString()};
  assert.equal(voucherInput(input).code,"TEST_CODE");assert.equal(voucherInput({...input,usageLimit:0}).usage_limit,0);
  assert.equal(voucherInput({...input,usageLimit:null}).usage_limit,null);
  for(const value of [0,-1,101])assert.throws(()=>voucherInput({...input,discountValue:value}),{code:"VALIDATION_ERROR"});
  assert.equal(voucherInput({...input,discountValue:100}).discount_value,"100.00");
  assert.throws(()=>voucherInput({...input,startAt:"2026-02-30T00:00:00Z"}),{code:"VALIDATION_ERROR"});
  assert.throws(()=>voucherInput({...input,startAt:"2026-01-01T00:00:00"}),{code:"VALIDATION_ERROR"});
  assert.throws(()=>voucherInput({...input,endAt:input.startAt}),{code:"VALIDATION_ERROR"});
  assert.throws(()=>voucherInput({...input,enabled:"true"}),{code:"VALIDATION_ERROR"});
  assert.throws(()=>voucherCode("1 OR 1=1"),{code:"VALIDATION_ERROR"});
});
