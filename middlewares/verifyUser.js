exports.verifyUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        status: false,
        message: "userId not provided",
        data: {},
        responseCode: "001",
      });
    }

    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: false,
        message: "Token ID missing",
        data: {},
        responseCode: "001",
      });
    }

    if (req.user.id != userId) {
      return res.status(403).json({
        status: false,
        message: "Token ID does not match request ID",
        data: {},
        responseCode: "001",
      });
    }

    next();
  } catch (err) {
    console.error("Error in verifyUser middleware:", err);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      data: {},
      responseCode: "001",
    });
  }
};
