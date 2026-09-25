import { body, param } from "express-validator";

export const inventoryValidation = [
  param("maSP")
    .isInt({ min: 1 })
    .withMessage("maSP must be a positive integer"),
  body("inventory")
    .isArray({ min: 1 })
    .withMessage("inventory must be a non-empty array"),
  body("inventory.*.maSize")
    .isInt({ min: 1 })
    .withMessage("maSize must be a positive integer"),
  body("inventory.*.soLuong")
    .isInt({ min: 0 })
    .withMessage("soLuong must be a non-negative integer"),
];
