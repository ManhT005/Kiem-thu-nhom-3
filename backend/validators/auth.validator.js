import { body } from "express-validator";

export const registerValidation = [
  body("ten")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Name must be 2 to 100 characters"),
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Email is invalid")
    .isLength({ max: 100 }),
  body("matKhau")
    .isLength({ min: 8, max: 32 })
    .withMessage("Password must be 8 to 32 characters"),
];

export const loginValidation = [
  body("email").trim().isEmail().withMessage("Email is invalid"),
  body("password").isString().notEmpty().withMessage("Password is required"),
];
