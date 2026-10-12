import express from "express";
import path from "node:path";

export const createPageRouter = (frontendRoot) => {
  const router = express.Router();
  const page = (name) => path.join(frontendRoot, "html", `${name}.html`);
  const sendPage = (name) => (_req, res) => res.sendFile(page(name));
  const redirectQuery = (target) => (req, res) => {
    const queryIndex = req.originalUrl.indexOf("?");
    const query = queryIndex === -1 ? "" : req.originalUrl.slice(queryIndex);
    res.redirect(301, `${target}${query}`);
  };

  router.get("/", sendPage("index"));
  router.get("/login", sendPage("login"));
  router.get("/register", sendPage("register"));
  router.get("/search", sendPage("search"));
  router.get("/products/:id([1-9]\\d*)", sendPage("productDetail"));
  router.get("/cart", sendPage("cart"));
  router.get("/checkout", sendPage("checkout"));
  router.get("/profile", sendPage("profile"));
  router.get("/orders", sendPage("profile"));
  router.get("/admin", sendPage("admin"));
  router.get("/staff", sendPage("staff"));
  router.get("/inventory", sendPage("inventory"));
  router.get("/vouchers", sendPage("vouchers"));
  router.get("/order-success", sendPage("orderSuccess"));

  router.get("/html/index.html", redirectQuery("/"));
  router.get("/html/login.html", redirectQuery("/login"));
  router.get("/html/register.html", redirectQuery("/register"));
  router.get("/html/search.html", redirectQuery("/search"));
  router.get("/html/productDetail.html", (req, res) => {
    const query = new URLSearchParams(req.originalUrl.split("?")[1] || "");
    const productId = query.get("id");
    query.delete("id");
    const target = /^[1-9]\d*$/.test(productId || "") ? `/products/${productId}` : "/";
    res.redirect(301, `${target}${query.size ? `?${query}` : ""}`);
  });
  router.get("/html/cart.html", redirectQuery("/cart"));
  router.get("/html/checkout.html", redirectQuery("/checkout"));
  router.get("/html/profile.html", redirectQuery("/profile"));
  router.get("/html/orders.html", redirectQuery("/orders"));
  router.get("/html/admin.html", redirectQuery("/admin"));
  router.get("/html/staff.html", redirectQuery("/staff"));
  router.get("/html/orderSuccess.html", redirectQuery("/order-success"));
  router.get("/pages/search.html", redirectQuery("/search"));

  return router;
};
