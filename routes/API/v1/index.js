const authenticateToken = require("../../../middlewares/authMiddleware");

const router = (module.exports = require("express")());


router.use(authenticateToken());
router.use("/admin", require("./admin"));

