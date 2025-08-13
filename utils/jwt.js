const jwt = require("jsonwebtoken");

const JWT_SECRET = "yourSecretKey";

function generateToken(user) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "1d" });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { generateToken, verifyToken };
