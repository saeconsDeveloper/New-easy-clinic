const asyncHandler = require("../../middlewares/async");
const { uploadFileToS3, deleteFromS3 } = require("../../utils/s3");
const labReport = require("../entities/labReport");

exports.createLabReport = asyncHandler(async (files, patientId, diagnoseId) => {
  const uploadedFiles = [];
  const uploadedDetails = [];
  for (const file of files) {
    const filePath = `labReports/${patientId}`;
    const { key, fileName } = await uploadFileToS3(file, filePath);
    uploadedFiles.push({ key, fileName });
  }


//  return uploadedFiles
    for (const uploaded of uploadedFiles) {

    const details = await labReport.create({
      ...uploaded,
      diagnoseId
    })
    uploadedDetails.push(details.dataValues)
  }
return uploadedDetails

});

module.exports.findOneReport = asyncHandler(async (params) => {
  return await labReport.findOne({
    where: {
      id: params.id,
    },
  });
});

module.exports.deleteReport = asyncHandler(async (params, key) => {
  let result = await deleteFromS3(key);
  if (result) {
    return await labReport.destroy({
      where: {
        id: params.id,
      },
    });
  } else {
    return 0;
  }
});