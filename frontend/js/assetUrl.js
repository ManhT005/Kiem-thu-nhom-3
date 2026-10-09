window.safeAssetUrl = (filename) => {
  if (
    typeof filename !== "string" ||
    !/^[a-z0-9_-]+\.(?:jpe?g|png|gif|webp)$/i.test(filename)
  ) {
    return "/Asset/user.jpg";
  }
  return `/Asset/${encodeURIComponent(filename)}`;
};
