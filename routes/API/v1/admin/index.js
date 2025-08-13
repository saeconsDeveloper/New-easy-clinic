const express = require("express");
const router = express.Router({ mergeParams: true });

router.use("/dashboard", require("./dashboard"));

module.exports = router;
