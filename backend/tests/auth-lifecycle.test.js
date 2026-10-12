import test from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { createAuthenticate } from "../middleware/authenticate.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { SECRET_KEY } from "../config/config.js";
import { changeUserLifecycle } from "../services/user-lifecycle.service.js";
const current={id:7,status:"ACTIVE",role:"user",token_version:0};
async function authenticate(claims,user=current,optional=false){
  const req={headers:claims?{authorization:"Bearer "+jwt.sign(claims,SECRET_KEY)}:{}};
  const middleware=createAuthenticate({optional,loadUser:async()=>user});
  return new Promise(resolve=>middleware(req,{},error=>resolve({req,error})));
}
test("authentication ignores advisory JWT roles and authorizes the current persisted role",async()=>{
  const result=await authenticate({id:7,role:"admin",token_version:0});
  assert.equal(result.error,undefined);assert.equal(result.req.user.role,"user");
  let error;authorizeRoles("admin")(result.req,{},value=>{error=value;});
  assert.equal(error.code,"FORBIDDEN");
});
test("locked, deleted, revoked and unversioned users cannot use protected endpoints",async()=>{
  const claims={id:7,role:"user",token_version:0};
  assert.equal((await authenticate(claims,{...current,status:"LOCKED",token_version:1})).error.code,"ACCOUNT_LOCKED");
  assert.equal((await authenticate(claims,{...current,token_version:2})).error.code,"TOKEN_REVOKED");
  assert.equal((await authenticate(claims,null)).error.code,"TOKEN_REVOKED");
  assert.equal((await authenticate({id:7,role:"user"})).error.code,"TOKEN_REVOKED");
  assert.equal((await authenticate(null)).error.code,"UNAUTHENTICATED");
  assert.equal((await authenticate(null,current,true)).error,undefined);
});
test("user lifecycle validates reasons and guards self-management/last-admin/version overflow",async()=>{
  const actor={id:2,status:"ACTIVE",role:"admin",token_version:0};
  let user={id:1,status:"ACTIVE",role:"admin",token_version:0};
  const dependencies={transaction:async work=>work({}),repository:{
    lockAdmins:async()=>[{id:1}],lockUser:async(_connection,id)=>id===2?actor:user,
    update:async()=>{assert.fail("Guarded transition must not write");},audit:async()=>{},
  }};
  await assert.rejects(changeUserLifecycle({userId:1,actorId:2,operation:"LOCK",reason:"QA"},dependencies),{code:"LAST_ACTIVE_ADMIN"});
  await assert.rejects(changeUserLifecycle({userId:2,actorId:2,operation:"LOCK",reason:"QA"},dependencies),{code:"SELF_MANAGEMENT_FORBIDDEN"});
  await assert.rejects(changeUserLifecycle({userId:1,actorId:2,operation:"LOCK",reason:""},dependencies),{code:"VALIDATION_ERROR"});
  user={...user,role:"user",token_version:4294967295};
  await assert.rejects(changeUserLifecycle({userId:1,actorId:2,operation:"LOCK",reason:"QA"},dependencies),{code:"TOKEN_VERSION_OVERFLOW"});
});
