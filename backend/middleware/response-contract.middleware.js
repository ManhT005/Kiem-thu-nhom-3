const codeByStatus = {
  400: "VALIDATION_ERROR",
  401: "UNAUTHENTICATED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
};

export const responseContract = (_req, res, next) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      typeof body.success === "boolean"
    ) {
      return originalJson(body);
    }

    if (res.statusCode >= 400) {
      const message = body?.message || "Request failed";
      return originalJson({
        success: false,
        code: codeByStatus[res.statusCode] || "INTERNAL_ERROR",
        message,
        errors: body?.errors,
      });
    }

    if (body && typeof body === "object" && !Array.isArray(body)) {
      return originalJson({
        ...body,
        success: true,
        code: res.statusCode === 201 ? "CREATED" : "SUCCESS",
        message: body.message || "Operation completed",
        data: body,
      });
    }

    return originalJson(body);
  };

  next();
};
