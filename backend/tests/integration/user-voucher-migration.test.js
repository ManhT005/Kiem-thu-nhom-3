import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mysql from "mysql2/promise";
import { randomUUID } from "node:crypto";
import { applyMigrations } from "../../scripts/migration-runner.js";
import { rollbackLifecycleVoucherMigration } from "../../scripts/lifecycle-voucher-rollback.js";
import { integrationEnabled } from "./fixture-helper.js";
test("Phase 4 migration preserves legacy voucher/order data and test-only down/up restores a clean schema", {skip:!integrationEnabled},async()=>{
  const name="lifecycle_"+randomUUID().replaceAll("-","")+"_test";
  const connection=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT),user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,multipleStatements:true,timezone:"Z"});
  try{
    await connection.query(`CREATE DATABASE \`${name}\``);await connection.query(`USE \`${name}\``);
    await applyMigrations(connection,{through:5});
    await connection.execute("INSERT INTO users (id,ten,email,matKhau,role) VALUES (1,'Legacy','legacy@example.test','unused','user')");
    await connection.execute("INSERT INTO GiamGia (maGiamGia,chietKhau,ngayBatDau,ngayKetThuc,moTa) VALUES (1,20,'2026-10-01','2026-10-12','Legacy')");
    await connection.execute("INSERT INTO DonHang (id,tongTien,maGiamGia) VALUES (1,1234,1)");
    await applyMigrations(connection,{through:6});await applyMigrations(connection,{through:6});
    const [[user]]=await connection.query("SELECT * FROM users");assert.equal(user.status,"ACTIVE");assert.equal(user.token_version,0);
    const [[voucher]]=await connection.query("SELECT * FROM GiamGia");assert.equal(voucher.code,"LEGACY-1");assert.equal(voucher.enabled,0);assert.equal(voucher.chietKhau,20);
    assert.equal(voucher.end_at.toISOString().slice(0,10),"2026-10-13");
    const [[order]]=await connection.query("SELECT * FROM DonHang");assert.equal(Number(order.tongTien),1234);assert.equal(Number(order.subtotal_before_discount),1234);assert.equal(order.maGiamGia,1);
    await rollbackLifecycleVoucherMigration(connection);
    const [[legacy]]=await connection.query("SELECT chietKhau FROM GiamGia");assert.equal(legacy.chietKhau,20);
    await applyMigrations(connection,{through:6});
    const [[updated]]=await connection.query("SELECT status,token_version FROM users");assert.equal(updated.token_version,0);
    await connection.execute("UPDATE users SET status='LOCKED' WHERE id=1");
    await assert.rejects(rollbackLifecycleVoucherMigration(connection),/Business lifecycle/);
  }finally{
    assert.match(name,/^lifecycle_[a-f0-9]{32}_test$/);
    await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);await connection.end();
  }
});
