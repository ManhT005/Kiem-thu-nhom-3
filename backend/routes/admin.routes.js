import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { success } from "../utils/api-response.js";
import { changeUserLifecycle, listUsers } from "../services/user-lifecycle.service.js";
import { saveVoucher, setVoucherStatus, listVouchers } from "../services/voucher.service.js";

const router = express.Router();
router.use(verifyToken, authorizeRoles("admin"));
const endpoint = (work,status=200) => async (req,res,next) => {
  try { return success(res,{ status, data: await work(req) }); } catch(error) { return next(error); }
};
router.get("/users",endpoint((req)=>listUsers(req.query)));
for (const [path,operation] of [["lock","LOCK"],["unlock","UNLOCK"],["role","ROLE"]]) {
  router.put("/users/:id/"+path,endpoint((req)=>changeUserLifecycle({
    userId:req.params.id, actorId:req.user.id, actorVersion:req.user.token_version,
    operation, role:req.body.role, reason:req.body.reason,
  })));
}
router.get("/vouchers",endpoint((req)=>listVouchers(req.query)));
router.post("/vouchers",endpoint((req)=>saveVoucher(req.body,req.user.id),201));
router.put("/vouchers/:id",endpoint((req)=>saveVoucher(req.body,req.user.id,req.params.id)));
router.patch("/vouchers/:id/status",endpoint((req)=>setVoucherStatus(req.params.id,req.body.enabled,req.user.id)));
export default router;
