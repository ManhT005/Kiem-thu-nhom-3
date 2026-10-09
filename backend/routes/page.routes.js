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
  router.get("/products/:id(\\d+)", sendPage("productDetail"));
  router.get("/cart", sendPage("cart"));
  router.get("/checkout", sendPage("checkout"));
  router.get("/profile", sendPage("profile"));
  router.get("/orders", sendPage("profile"));
  router.get("/admin", sendPage("admin"));
  router.get("/staff", sendPage("staff"));
  router.get("/order-success", sendPage("orderSuccess"));

  router.get("/html/index.html", (_req, res) => res.redirect(301, "/"));
  router.get("/html/login.html", (_req, res) => res.redirect(301, "/login"));
  router.get("/html/register.html", (_req, res) =>
    res.redirect(301, "/register"),
  );
  router.get("/html/search.html", redirectQuery("/search"));
  router.get("/html/productDetail.html", (req, res) => {
    const productId = req.query.id;
    res.redirect(
      301,
      /^\d+$/.test(String(productId)) ? `/products/${productId}` : "/",
    );
  });
  router.get("/html/cart.html", (_req, res) => res.redirect(301, "/cart"));
  router.get("/html/checkout.html", (_req, res) =>
    res.redirect(301, "/checkout"),
  );
  router.get("/html/profile.html", (_req, res) => res.redirect(301, "/profile"));
  router.get("/html/orders.html", (_req, res) => res.redirect(301, "/orders"));
  router.get("/html/admin.html", (_req, res) => res.redirect(301, "/admin"));
  router.get("/html/staff.html", (_req, res) => res.redirect(301, "/staff"));
  router.get("/html/orderSuccess.html", (_req, res) =>
    res.redirect(301, "/order-success"),
  );
  router.get("/pages/search.html", redirectQuery("/search"));

  return router;
};