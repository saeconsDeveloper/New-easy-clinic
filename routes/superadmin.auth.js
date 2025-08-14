// routes/superadmin.auth.js
"use strict";
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const router = express.Router();

// login page
router.get("/superadmin/login", (req, res) => {
  // use views/superadmin/login.ejs (see step 3)
  res.render("superadmin/login", { error: null });
});

// handle login (env: SUPERADMIN_USER + SUPERADMIN_PASS_HASH or SUPERADMIN_PASS)
router.post("/superadmin/login", async (req, res) => {
  const { username, password } = req.body;

  const U = process.env.SUPERADMIN_USER || "admin";
  const HASH = process.env.SUPERADMIN_PASS_HASH || "";
  const PLAIN = process.env.SUPERADMIN_PASS || "admin@123";

  if (username !== U) return res.status(401).render("superadmin/login", { error: "Invalid credentials" });

  let ok = false;
  if (HASH) ok = await bcrypt.compare(password, HASH);
  else if (PLAIN) ok = password === PLAIN;
  else return res.status(500).render("superadmin/login", { error: "Server not configured" });

  if (!ok) return res.status(401).render("superadmin/login", { error: "Invalid credentials" });

  const token = jwt.sign(
    { email: `${U}@local`, role: "SUPER_ADMIN", type: "SUPER_ADMIN" },
    process.env.JWT_SECRET || "yourSecretKey",
    { expiresIn: "1d" }
  );

  res.cookie("DMCToken", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  res.redirect("/superadmin/users");
});

// logout
router.get("/superadmin/logout", (req, res) => {
  res.clearCookie("DMCToken");
  res.redirect("/superadmin/login");
});

module.exports = router;
