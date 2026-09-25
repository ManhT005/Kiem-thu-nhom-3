import { body, param } from "express-validator";

export const idParamValidation = [
  param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
];
export const profileValidation = [
  body("username")
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Username must be 2 to 100 characters"),
  body("phone")
    .matches(/^(03|05|07|08|09)\d{8}$/)
    .withMessage("Phone number is invalid"),
];
export const addressValidation = [
  body("address")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("Address is required"),
];
export const roleValidation = [
  body("role").isIn(["user", "staff", "admin"]).withMessage("Role is invalid"),
];
