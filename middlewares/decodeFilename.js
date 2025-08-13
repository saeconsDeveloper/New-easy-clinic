const decodeFilename = (req, res, next) => {
    if (req.file) {
      try {
        req.file.originalname = Buffer.from(req.file.originalname, "latin1").toString("utf8");
      } catch (err) {
        console.error("Error decoding file name:", err);
        next(err);
      }
    }
    next();
  };
  
  module.exports = decodeFilename;