require("dotenv").config();
const express = require("express");
const errorHandler = require("./middlewares/error");
const morgan = require("morgan");
const path = require("path");
const cookieParser = require("cookie-parser");
const authenticateToken = require("./middlewares/authMiddleware");
const { checkPassword } = require("./controllers/admin/dashboard");
const app = express();

const PORT = process.env.PORT || 10000;

// ---- Load models FIRST (so controllers that import them are safe) ----
require("./models/entities/clinic");
// If your other models don’t auto-load in controllers, add them here too:
// require("./models/entities/patient");
// require("./models/entities/diagnose");
// require("./models/entities/labReport");

// ---- Now load controllers that may require models ----

// View engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Core middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan(":method :url :status :response-time ms"));
app.use(express.static(path.join(__dirname, "public")));

// If you actually need CORS, uncomment:
// const cors = require("cors");
// app.use(cors({ origin: true, credentials: true }));

// ---- Routes (mount after parsers/cookies) ----
app.use(require("./routes/superadmin.auth"));          // superadmin login via .env
app.use("/api/v1", require("./routes/API/v1"));
app.use("/api/v1/superadmin", require("./routes/superadmin.api"));
app.use(require("./routes/superadmin.page"));

// Pages
app.get("/", (req, res) => res.render("index"));

// Single, role-aware login page (keep THIS one)
app.get("/login", (req, res) => {
  const role = (req.query.role || "VIEWER").toUpperCase();
  res.render("login", { error: null, role });
});


// Auth-protected pages
app.get("/view",   authenticateToken("view"),   (req, res) => res.render("view"));
app.get("/upload", authenticateToken("upload"), (req, res) => res.render("upload"));

// Login submit
app.post("/login", checkPassword);



// Other pages
app.get("/privacy-policy", (req, res) => res.render("privacyPolicy"));
app.get("/logout", (req, res) => { res.clearCookie("DMCToken"); res.redirect("/login"); });

// Errors
app.use(errorHandler);
app.use((err, req, res, next) => {
  return res.status(err.status || 500).json({
    status: err.status || 500,
    message: "Internal Server Error",
    data: {},
    responseCode: "001",
  });
});

// Server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
