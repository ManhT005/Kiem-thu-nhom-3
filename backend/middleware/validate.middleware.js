import { validationResult } from "express-validator";
import { AppError } from "../utils/app-error.js";

export const validate = (req, _res, next) => {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return next(
      new AppError(
        400,
        "VALIDATION_ERROR",
        "Invalid request data",
        result.array().map(({ path, msg }) => ({ field: path, message: msg })),
      ),
    );
  }
  return next();
};
