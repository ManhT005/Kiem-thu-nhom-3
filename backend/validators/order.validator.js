import { body, param } from "express-validator";

export const createOrderValidation = [
  body("tenNguoiNhan")
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("tenNguoiNhan is required and must be at most 100 characters"),
  body("sdt")
    .trim()
    .matches(/^[0-9+().\-\s]{8,20}$/)
    .withMessage("sdt must be a valid phone number"),
  body("diaChiGiaoHang")
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage("diaChiGiaoHang is required and must be at most 255 characters"),
  body("maPTTT")
    .isInt({ min: 1 })
    .withMessage("maPTTT must be a positive integer"),
  body("ghiChu")
    .optional({ nullable: true })
    .isLength({ max: 500 })
    .withMessage("ghiChu must be at most 500 characters"),
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
];
export const orderIdValidation = [
  param("id").isInt({ min: 1 }).withMessage("id must be a positive integer"),
];
