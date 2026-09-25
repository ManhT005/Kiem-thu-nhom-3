import express from "express";
import { login, register } from "../controllers/auth.controller.js";
import { validate } from "../middleware/validate.middleware.js";
import {
  loginValidation,
  registerValidation,
} from "../validators/auth.validator.js";

const router = express.Router();

router.post("/register", registerValidation, validate, register);
router.post("/login", loginValidation, validate, login);

export default router;
