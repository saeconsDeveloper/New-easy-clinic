const asyncHandler = require("../../middlewares/async");
const patient = require("../entities/patient");

  module.exports.deletePatient = asyncHandler(async (params) => {
    return await patient.destroy({
      where: {
        id: params.id,
      },
    });
});