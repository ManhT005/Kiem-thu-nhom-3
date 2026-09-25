export const success = (
  res,
  { status = 200, code = "SUCCESS", message = "Success", data = null } = {},
) => res.status(status).json({ success: true, code, message, data });

export const error = (
  res,
  {
    status = 500,
    code = "INTERNAL_ERROR",
    message = "Internal server error",
    errors = undefined,
  } = {},
) => {
  const body = { success: false, code, message };
  if (errors !== undefined) body.errors = errors;
  return res.status(status).json(body);
};
