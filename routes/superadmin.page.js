// keep this somewhere (superadmin.page.js or any routes file you like)
const router = require("express").Router();
const authenticateToken = require("../middlewares/authMiddleware");

router.get("/superadmin/users", authenticateToken("SUPER_ADMIN"), (req, res) => {
  res.render("superadmin/users");
});

module.exports = router;
