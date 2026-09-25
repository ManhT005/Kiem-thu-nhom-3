import { body } from "express-validator";

const positiveInteger = (field) =>
  body(field)
    .isInt({ min: 1 })
    .withMessage(`${field} must be a positive integer`);

export const addCartValidation = [
  positiveInteger("maSP"),
  positiveInteger("maSize"),
  body("soLuong")
    .optional()
    .isInt({ min: 1 })
    .withMessage("soLuong must be at least 1"),
];
export const updateCartValidation = [
  positiveInteger("maSP"),
  positiveInteger("maSize"),
  body("soLuong").isInt({ min: 1 }).withMessage("soLuong must be at least 1"),
];
export const removeCartValidation = [
  positiveInteger("maSP"),
  positiveInteger("maSize"),
];
