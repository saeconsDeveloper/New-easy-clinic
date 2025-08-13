const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || "yourSecretKey";

/**
 * authenticateToken(allowedTypes?)
 * - allowedTypes: "upload" | "view" or array of both; compares against payload.type
 * - reads token from cookie DMCToken or Authorization: Bearer
 */
function authenticateToken(allowedTypes) {
  return function (req, res, next) {
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const token = req.cookies?.DMCToken || bearer;
    if (!token) return res.redirect("/login");

    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return res.redirect("/login");

      if (allowedTypes) {
        const types = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
        if (!types.includes(payload.type)) return res.redirect("/login");
      }

      // no-cache for authenticated pages
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      req.user = payload; // { clinicId, clinicRole, type }
      next();
    });
  };
}

module.exports = authenticateToken;
