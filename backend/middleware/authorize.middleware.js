import { AppError } from "../utils/app-error.js";

export const authorizeRoles =
  (...roles) =>
  (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          403,
          "FORBIDDEN",
          "You do not have permission to perform this action",
        ),
      );
    }
    return next();
  };
