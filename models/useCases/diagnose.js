const { QueryTypes } = require("sequelize");
const sequelize = require("../../configs/database");

/**
 * Find patients + diagnoses scoped by clinicId with pagination
 */
async function findAllPatientCount(params) {
  const {
    clinicId,
    from,
    to,
    searchPatientName,
    searchPatientAddress,
    searchPatientMobileNo,
    searchTreatment,
    searchDiagnose,
    birthdateFrom,
    birthdateTo,
    sort = "DESC",
    sortField = "createdAt",
    page = 1,
    limit = 10,
  } = params;

  const offset = (Number(page) - 1) * Number(limit);

  const replacements = {
    clinicId: Number(clinicId),
    searchPatientName: searchPatientName ? `%${searchPatientName}%` : null,
    searchPatientAddress: searchPatientAddress ? `%${searchPatientAddress}%` : null,
    searchPatientMobileNo: searchPatientMobileNo ? `%${String(searchPatientMobileNo).replace(/[-+ ]/g, "")}%` : null,
    searchTreatment: searchTreatment ? `%${searchTreatment}%` : null,
    searchDiagnose: searchDiagnose ? `%${searchDiagnose}%` : null,
    birthdateFrom: birthdateFrom || null,
    birthdateTo: birthdateTo || null,
    from: from || null,
    to: to || null,
    limit: Number(limit),
    offset,
  };

  const where = `
    p.clinicId = :clinicId
    AND (:searchPatientName IS NULL OR p.name LIKE :searchPatientName)
    AND (:searchPatientAddress IS NULL OR p.address LIKE :searchPatientAddress)
    AND (:searchPatientMobileNo IS NULL OR REPLACE(REPLACE(REPLACE(p.mobileNo,'-',''),'+',''),' ','') LIKE :searchPatientMobileNo)
    AND (
      (:birthdateFrom IS NULL AND :birthdateTo IS NULL)
      OR (YEAR(STR_TO_DATE(p.birthdate, '%Y-%m-%d')) BETWEEN :birthdateFrom AND :birthdateTo)
    )
    AND (:searchTreatment IS NULL OR d.treatment LIKE :searchTreatment)
    AND (:searchDiagnose IS NULL OR d.diagnosis LIKE :searchDiagnose)
    AND (:from IS NULL OR DATE(d.date) >= :from)
    AND (:to IS NULL OR DATE(d.date) <= :to)
  `;

  const rows = await sequelize.query(`
    SELECT
      p.id AS patientId,
      p.name AS name,
      p.birthdate AS birthdate,
      p.address AS address,
      p.createdAt AS patientCreatedAt,
      p.mobileNo AS mobileNumber,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'id', d.id,
          'date', d.date,
          'diagnosis', d.diagnosis,
          'treatment', d.treatment,
          'createdAt', d.createdAt,
          'labReports', (
            SELECT JSON_ARRAYAGG(
              JSON_OBJECT('id', l.id, 'key', l.key, 'fileName', l.fileName, 'createdAt', l.createdAt)
            )
            FROM labReports l
            WHERE l.diagnoseId = d.id
          )
        )
      ) AS diagnoses
    FROM patients p
    LEFT JOIN diagnoses d ON d.patientId = p.id
    WHERE ${where}
    GROUP BY p.id
    ORDER BY p.${sortField} ${sort}
    LIMIT :limit OFFSET :offset
  `, { replacements, type: QueryTypes.SELECT });

  const countRows = await sequelize.query(`
    SELECT COUNT(DISTINCT p.id) AS cnt
    FROM patients p
    LEFT JOIN diagnoses d ON d.patientId = p.id
    WHERE ${where}
  `, { replacements, type: QueryTypes.SELECT });

  const totalCount = countRows?.[0]?.cnt || 0;
  return {
    paginatedResults: rows,
    currentPage: Number(page),
    currentLimit: Number(limit),
    totalCount,
  };
}

module.exports = { findAllPatientCount };
