import { body, param } from "express-validator";

export const createOrderValidation = [
  body("items")
    .isArray({ min: 1 })
    .withMessage("items must contain at least one item"),
  body("items.*.maSP")
    .isInt({ min: 1 })
    .withMessage("maSP must be a positive integer"),
  body("items.*.maSize")
    .isInt({ min: 1 })
    .withMessage("maSize must be a positive integer"),
  body("items.*.soLuongMua")
    .isInt({ min: 1 })
    .withMessage("soLuongMua must be at least 1"),
  body("items.*.gia")
    .isInt({ min: 0 })
    .withMessage("gia must be a non-negative integer"),
];
export const orderIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
];
