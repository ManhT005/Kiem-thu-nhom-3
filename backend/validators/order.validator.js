import { body, param, query } from "express-validator";
import { ORDER_STATUS_VALUES } from "../domain/order-status.js";

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

export const orderStatusValidation = [
  body("trangThai")
    .isIn(ORDER_STATUS_VALUES)
    .withMessage("trangThai must be a known order status"),
  body("lyDo")
    .optional({ nullable: true })
    .isLength({ max: 500 })
    .withMessage("lyDo must be at most 500 characters"),
];

export const orderFilterValidation = [
  query("trangThai")
    .optional()
    .isIn(ORDER_STATUS_VALUES)
    .withMessage("trangThai must be a known order status"),
  query("fromDate")
    .optional()
    .isISO8601({ strict: true })
    .withMessage("fromDate must be an ISO date"),
  query("toDate")
    .optional()
    .isISO8601({ strict: true })
    .withMessage("toDate must be an ISO date"),
  query("toDate").custom((toDate, { req }) => {
    if (!toDate || !req.query.fromDate) return true;
    return Date.parse(req.query.fromDate) <= Date.parse(toDate);
  }).withMessage("toDate must not be before fromDate"),
  query("minTotal")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("minTotal must be non-negative"),
  query("maxTotal")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("maxTotal must be non-negative"),
  query("maxTotal").custom((maxTotal, { req }) => {
    if (maxTotal === undefined || req.query.minTotal === undefined) return true;
    return Number(maxTotal) >= Number(req.query.minTotal);
  }).withMessage("maxTotal must be at least minTotal"),
  query("keyword")
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage("keyword must be at most 100 characters"),
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("page must be a positive integer"),
  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("limit must be between 1 and 100"),
];
