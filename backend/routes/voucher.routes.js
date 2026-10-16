import express from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/authorize.middleware.js";
import { success } from "../utils/api-response.js";
import { previewVoucher } from "../services/voucher.service.js";
const router = express.Router();
router.post("/validate",verifyToken,authorizeRoles("user"),async(req,res,next)=>{
  try { return success(res,{data:await previewVoucher({...req.body,userId:req.user.id})}); }
  catch(error) { return next(error); }
});
export default router;
