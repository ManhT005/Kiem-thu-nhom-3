import { error } from "../utils/api-response.js";
import { AppError } from "../utils/app-error.js";

export const errorHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof AppError) {
    return error(res, {
      status: err.status,
      code: err.code,
      message: err.message,
      errors: err.details,
    });
  }

  if (err.code === "ER_DUP_ENTRY") {
    return error(res, {
      status: 409,
      code: "CONFLICT",
      message: "Resource already exists",
    });
  }

  if (
    err.name === "MulterError" ||
    err.message?.includes("file") ||
    err.message?.includes("ảnh")
  ) {
    return error(res, {
      status: 400,
      code: "VALIDATION_ERROR",
      message: err.message,
    });
  }

  console.error(err);
  return error(res, {
    status: 500,
    code: "INTERNAL_ERROR",
    message: "Internal server error",
  });
};
