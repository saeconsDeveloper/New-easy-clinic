class ErrorResponse extends Error {
    constructor(message, statusCode) {
        super(message);
        this.status_code = statusCode
    }
}

module.exports = ErrorResponse