const ErrorResponse = require("../utils/errorResponse");

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log to console for development
    console.log(err);

    // Bad ObjectId
    if (err.name === 'CastError') {
        const message = `Resource not found.`;
        error = new ErrorResponse(message, 404);
    }

    // Duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value entered';
        error = new ErrorResponse(message, 400);
    }

    // Validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map((val) => val.message);
        error = new ErrorResponse(message, 400);
    }

      // Custom validation failure (e.g., Joi validation errors)
      if (err.isJoi) { // Joi validation error handling
        const message = err.details.map((detail) => detail.message).join(', ');
        error = new ErrorResponse(message, 400);
    }

    if (err.message === 'INVALID AUTHORIZATION') {
        const message = `Something went wrong. Please try again after sometime.`;
        error = new ErrorResponse(message, 200);
    }

    // Set the status code based on the error or use a default value
    const statusCode = error.status_code || err.code || 500;

    res.status(statusCode).json({
        status: false,
        message: error.message || 'Server Error',
        data: {},
        responseCode: '001',
    });
};

module.exports = errorHandler;
