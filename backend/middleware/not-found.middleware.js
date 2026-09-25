import { error } from "../utils/api-response.js";

export const notFound = (_req, res) =>
  error(res, {
    status: 404,
    code: "NOT_FOUND",
    message: "API endpoint not found",
  });
