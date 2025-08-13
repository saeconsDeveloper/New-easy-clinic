"use strict";

const asyncHandler = require("../../middlewares/async");
const ExcelJS = require("exceljs");
const puppeteer = require("puppeteer");

const patient = require("../../models/entities/patient");
const diagnose = require("../../models/entities/diagnose");
const labReport = require("../../models/entities/labReport");

const { findAllPatientCount } = require("../../models/useCases/diagnose");
const { createLabReport, findOneReport, deleteReport: ucDeleteReport } = require("../../models/useCases/labReport") || {};
const { deletePatient: ucDeletePatient } = require("../../models/useCases/patients") || {};

const { getTemporaryUrl, uploadFileToS3 } = require("../../utils/s3");
const sequelize = require("../../configs/database");
const ErrorResponse = require("../../utils/errorResponse");

// Auth-related (for checkPassword)
const jwt = require("jsonwebtoken");
const Clinic = require("../../models/entities/clinic");
const bcrypt = require("bcryptjs");

// Helpers
const slug = (s = "") =>
  String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* =========================
   Excel -> JSON extraction
   ========================= */
exports.excelUpload = asyncHandler(async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const sheet = workbook.worksheets[0];
    const patientDetails = {};
    const diagnosisRecords = [];

    let startRow = 1;
    const rowCount = sheet.rowCount;

    // Identify Patient Details (Name, Birthdate, Address)
    for (let i = 1; i <= rowCount; i++) {
      const row = sheet.getRow(i);
      const firstCell = String(row.getCell(1).value || "").toLowerCase().trim();

      // Name
      if (["name", "name:", "Name", "Name:", "Name :"].includes(firstCell)) {
        for (let col = 2; col <= 4; col++) {
          const cellValue = String(row.getCell(col).value || "").trim();
          if (!["name", "name:", "Name", "Name:", "Name :"].includes(cellValue) && cellValue) {
            patientDetails.name = cellValue;
            break;
          }
        }
        continue;
      }

      // Birthdate
      if (
        ["birthdate", "birthdate:", "Birthdate", "Birthdate:", "Birthdate :", "Date of Birth", "Date of Birth:"].includes(
          firstCell
        )
      ) {
        for (let col = 2; col <= 4; col++) {
          const cellValue = String(row.getCell(col).value || "").trim();
          if (
            !["birthdate", "birthdate:", "Birthdate", "Birthdate:", "Birthdate :"].includes(cellValue) &&
            cellValue
          ) {
            const rawBirthdate = cellValue ?? null;
            if (rawBirthdate) {
              const yearMatch = String(rawBirthdate).match(/\b\d{4}\b/);
              patientDetails.birthdate = yearMatch ? parseInt(yearMatch[0]) : null;
            } else {
              patientDetails.birthdate = null;
            }
            break;
          }
        }
        continue;
      }

      // Address
      if (["adress", "adress:", "Adress", "Adress:", "Adress :"].includes(firstCell)) {
        for (let col = 2; col <= 4; col++) {
          const cellValue = String(row.getCell(col).value || "").trim();
          if (!["adress", "adress:", "Adress", "Adress:", "Adress :"].includes(cellValue) && cellValue) {
            patientDetails.address = cellValue;
            break;
          }
        }
        startRow = i + 2;
        continue;
      }
    }

    // Step 2: Extract Diagnosis & Treatment Details
    for (let i = startRow; i <= rowCount; i++) {
      const row = sheet.getRow(i);
      const firstCell = row.getCell(1).value || "";

      const looksLikeDate =
        firstCell instanceof Date || (String(firstCell).split("/").length - 1) >= 2;

      if (looksLikeDate) {
        let date;

        if (firstCell instanceof Date && !isNaN(firstCell)) {
          date = firstCell.toISOString();
        } else {
          const parts = String(firstCell).split("/").filter((p) => p.trim() !== "");
          if (parts?.length === 2 || parts?.length === 3) {
            let [day, monthInput, yearRaw] = parts.map((p) => p.trim());
            const year = `20${yearRaw ? yearRaw.slice(-2) : "00"}` || "2000";

            day = day ? day.padStart(2, "0") : "01";
            const monthMap = {
              january: ["jan", "january", "01", "1", "janv", "janvier"],
              february: ["feb", "february", "02", "2", "fev", "fevr", "fevrier"],
              march: ["mar", "march", "03", "3", "mars"],
              april: ["apr", "april", "04", "4", "avril", "avr"],
              may: ["may", "05", "5", "mai"],
              june: ["jun", "june", "06", "6", "juin"],
              july: ["jul", "july", "07", "7", "juil", "juillet"],
              august: ["aug", "august", "08", "8", "aout"],
              september: ["sep", "sept", "september", "09", "9", "septembre"],
              october: ["oct", "october", "10", "octobre"],
              november: ["nov", "november", "11", "novembre"],
              december: ["dec", "december", "12", "decembre"],
            };
            let month = "01";
            for (const [key, values] of Object.entries(monthMap)) {
              if (values.map((v) => v.toLowerCase()).includes(String(monthInput).toLowerCase())) {
                const monthNumber = Object.keys(monthMap).indexOf(key) + 1;
                month = String(monthNumber).padStart(2, "0");
                break;
              }
            }
            if (year && month && day) {
              date = new Date(`${year}-${month}-${day}`).toISOString();
            }

            let diagnosis = "";
            let treatment = "";
            const diagnoseSet = new Set();
            const treatmentSet = new Set();

            for (let col = 2; col <= 6; col++) {
              const value = String(row.getCell(col).value || "").trim();
              if (value) diagnoseSet.add(value);
            }
            for (const x of diagnoseSet) diagnosis += x + " ";
            diagnosis += "\n";
            diagnoseSet.clear();

            for (let col = 7; col <= 9; col++) {
              const value = String(row.getCell(col).value || "").trim();
              if (value) treatmentSet.add(value);
            }
            for (const x of treatmentSet) treatment += x + " ";
            treatment += "\n";
            treatmentSet.clear();

            let j = i + 1;
            while (j <= rowCount) {
              const nextRow = sheet.getRow(j);
              const nextFirst = nextRow.getCell(1).value || "";

              const nextLooksLikeDate =
                nextFirst instanceof Date || (String(nextFirst).split("/").length - 1) >= 2;
              if (nextLooksLikeDate) break;

              for (let col = 2; col <= 6; col++) {
                const value = String(nextRow.getCell(col).value || "").trim();
                if (value) diagnoseSet.add(value);
              }
              for (const x of diagnoseSet) diagnosis += x + " ";
              diagnosis += "\n";
              diagnoseSet.clear();

              for (let col = 7; col <= 9; col++) {
                const value = String(nextRow.getCell(col).value || "").trim();
                if (value) treatmentSet.add(value);
              }
              for (const x of treatmentSet) treatment += x + " ";
              treatment += "\n";
              treatmentSet.clear();

              j++;
            }

            diagnosisRecords.push({
              date,
              diagnosis: diagnosis.trim(),
              treatment: treatment.trim(),
            });

            i = j - 1;
          }
        }
      }
    }

    res.json({
      success: true,
      patientDetails,
      diagnosisRecords,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to process Excel file",
    });
  }
});

/* =========================
   Patients list (with paging) – scoped by clinic
   ========================= */
exports.findAllPatients = asyncHandler(async (req, res, next) => {
  let {
    from,
    to,
    searchPatientName,
    searchPatientAddress,
    searchPatientMobileNo,
    searchTreatment,
    searchDiagnose,
    birthdateFrom,
    birthdateTo,
    page,
    limit,
  } = req.query;

  const sort = req.query.sort && req.query.sort === "ASC" ? "ASC" : "DESC";
  let sortField = req.query.sortField || "createdAt";

  const params = {
    from,
    to,
    searchPatientName,
    searchPatientAddress,
    searchPatientMobileNo,
    searchTreatment,
    searchDiagnose,
    birthdateFrom,
    birthdateTo,
    sort,
    sortField,
    page,
    limit,
    clinicId: req.user?.clinicId,   // <-- scope by clinic
  };

  const transactionsData = await findAllPatientCount(params);
  if (!transactionsData) {
    return next(new ErrorResponse(`Something went wrong while getting all client from DB`, 500));
  } else {
    const { paginatedResults, currentPage, currentLimit, totalCount } = transactionsData;
    return res.status(200).json({
      status: true,
      data: {
        data: paginatedResults,
        pagination: {
          total: totalCount,
          page: currentPage,
          limit: currentLimit,
          totalPages: Math.ceil(totalCount / currentLimit),
        },
      },
      message: "Client fetched successfully",
      responseCode: "000",
    });
  }
});

/* =========================
   Save (create patient + diagnoses) – sets clinicId
   ========================= */
exports.saveAllPatients = asyncHandler(async (req, res) => {
  const { patientDetails, diagnosisRecords } = req.body;
  let transaction;
  try {
    transaction = await sequelize.transaction();

    const Patient = await patient.create(
      {
        clinicId: req.user?.clinicId, // <-- IMPORTANT
        name: patientDetails.name == "" ? null : patientDetails.name,
        birthdate: patientDetails.birthdate == "" ? null : patientDetails.birthdate,
        address: patientDetails.address == "" ? null : patientDetails.address,
        mobileNo: patientDetails.mobileNo == "" || patientDetails.mobileNo == null ? null : patientDetails.mobileNo,
      },
      { transaction }
    );

    for (const record of diagnosisRecords) {
      await diagnose.create(
        {
          patientId: Patient.id,
          date: record.date,
          diagnosis: record.diagnosis,
          treatment: record.treatment,
        },
        { transaction }
      );
    }

    await transaction.commit();
    res.status(200).json({ message: "Data saved successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to save data" });
  }
});

/* =========================
   Edit (update patient + diagnoses)
   ========================= */
exports.saveEditPatients = asyncHandler(async (req, res) => {
  const { patientDetails, diagnosisRecords } = req.body;
  let transaction;
  try {
    transaction = await sequelize.transaction();

    await patient.update(
      {
        name: patientDetails.name == "" ? null : patientDetails.name,
        birthdate: patientDetails.birthdate == "" ? null : patientDetails.birthdate,
        address: patientDetails.address == "" ? null : patientDetails.address,
        mobileNo:
          patientDetails.mobileNo == "" || patientDetails.mobileNo == null ? null : patientDetails.mobileNo,
      },
      { where: { id: patientDetails.id }, transaction }
    );

    for (const record of diagnosisRecords) {
      await diagnose.update(
        {
          patientId: patientDetails.id,
          date: record.date,
          diagnosis: record.diagnosis,
          treatment: record.treatment,
        },
        { where: { id: record.id }, transaction }
      );
    }

    await transaction.commit();
    res.status(200).json({ message: "Data saved successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to save data" });
  }
});

/* =========================
   Lab Report upload / delete
   ========================= */
exports.uploadReport = asyncHandler(async (req, res, next) => {
  const { patientId, diagnoseId } = req.body;
  const files = req.files;

  if (!files || files.length === 0) {
    return next(new ErrorResponse(`At least one file is required`, 400));
  }

  // If you have your useCase createLabReport, use it. Otherwise raw upload & create:
  const uploadedDetails = [];
  for (const f of files) {
    const filePath = `labReports/${patientId}`;
    const { key, fileName } = await uploadFileToS3(f, filePath);
    const r = await labReport.create({ diagnoseId, key, fileName });
    const presigned = await getTemporaryUrl(key);
    uploadedDetails.push({ id: r.id, fileName, url: presigned?.url || null });
  }

  return res.status(200).json({
    status: true,
    message: "Report created successfully",
    data: { data: uploadedDetails },
    responseCode: "000",
  });
});

exports.deleteReport = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const r = await labReport.findByPk(id);
  if (!r) return next(new ErrorResponse("Report not found", 404));
  // delete from S3 if you want; here only DB delete
  await r.destroy();
  return res.status(200).json({ status: true, data: {}, message: "Report deleted successfully", responseCode: "000" });
});

/* =========================
   Delete diagnose / patient
   ========================= */
exports.deleteDiagnose = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const row = await diagnose.findByPk(id);
  if (!row) return next(new ErrorResponse("Diagnose not found", 404));
  await row.destroy();
  return res.status(200).json({ status: true, data: {}, message: "Diagnose deleted successfully", responseCode: "000" });
});

exports.deletePatient = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const row = await patient.findByPk(id);
  if (!row) return next(new ErrorResponse("Patient not found", 404));
  await row.destroy();
  return res.status(200).json({ status: true, data: {}, message: "Patient deleted successfully", responseCode: "000" });
});

/* =========================
   Add diagnoses (+ optional files)
   ========================= */
exports.saveAddDiagonsis = asyncHandler(async (req, res) => {
  const files = req.files || [];
  const body = req.body;

  const fileMap = {};
  files.forEach((file) => {
    const match = file.fieldname.match(/diagnoses\[(\d+)\]\[files\]/);
    if (match) {
      const index = parseInt(match[1], 10);
      if (!fileMap[index]) fileMap[index] = [];
      fileMap[index].push(file);
    }
  });

  const results = [];

  if (!body.diagnoses || !Array.isArray(body.diagnoses)) {
    return res.status(400).json({
      success: false,
      message: "No diagnoses data provided or invalid format",
    });
  }

  for (const [index, diagnosisData] of body.diagnoses.entries()) {
    const { date, diagnosis, treatment, patientId } = diagnosisData;

    if (!date || !patientId) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields for diagnosis at index ${index}`,
      });
    }

    const diagnosisRecord = await diagnose.create({
      patientId,
      date,
      diagnosis,
      treatment,
    });

    const uploadedFiles = [];
    if (fileMap[index]) {
      for (const file of fileMap[index]) {
        const filePath = `labReports/${patientId}`;
        const { key, fileName } = await uploadFileToS3(file, filePath);
        const LabReport = await labReport.create({
          diagnoseId: diagnosisRecord.id,
          key,
          fileName,
        });
        uploadedFiles.push(LabReport.dataValues);
      }
    }

    results.push({
      ...diagnosisRecord.dataValues,
      files: uploadedFiles,
    });
  }

  res.status(200).json({
    success: true,
    data: results,
  });
});

/* =========================
   Add new patient only – sets clinicId
   ========================= */
exports.addNewPatient = asyncHandler(async (req, res) => {
  const { patientDetails } = req.body;
  let transaction;
  try {
    transaction = await sequelize.transaction();

    await patient.create(
      {
        clinicId: req.user?.clinicId, // <-- IMPORTANT
        name: patientDetails.name == "" ? null : patientDetails.name,
        birthdate: patientDetails.birthdate == "" ? null : patientDetails.birthdate,
        address: patientDetails.address == "" ? null : patientDetails.address,
        mobileNo:
          patientDetails.mobileNo == "" || patientDetails.mobileNo == null ? null : patientDetails.mobileNo,
      },
      { transaction }
    );

    await transaction.commit();
    res.status(200).json({ message: "Data saved successfully" });
  } catch (err) {
    if (transaction) await transaction.rollback();
    console.error(err);
    res.status(500).json({ error: "Failed to save data" });
  }
});

// =========================
//    Login by clinic code + role password
//    ========================= 
// controllers/admin/dashboard.js
exports.checkPassword = async (req, res) => {
  // derive role from form or query; default VIEWER
  const rawRole = (req.body.role || req.query.role || 'VIEWER').toUpperCase();
  const backToLogin = (msg, status = 401) =>
    res.status(status).render('login', { error: msg, role: rawRole });

  try {
    const { clinicCode, password } = req.body;
    const clinic = await Clinic.findOne({ where: { code: slug(clinicCode) } });
    if (!clinic) return backToLogin('Clinic not found');

    const isAdmin = rawRole === 'ADMIN';
    const hash = isAdmin ? clinic.adminPasswordHash : clinic.viewerPasswordHash;
    if (!hash) return backToLogin('Account not set up yet');

    const ok = await bcrypt.compare(password, hash);
    if (!ok) return backToLogin('Invalid password');

    const token = jwt.sign(
      { clinicId: clinic.id, clinicRole: isAdmin ? 'ADMIN' : 'VIEWER', type: isAdmin ? 'upload' : 'view' },
      process.env.JWT_SECRET || 'yourSecretKey',
      { expiresIn: '1d' }
    );

    res.cookie('DMCToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    return res.redirect(isAdmin ? '/upload' : '/view');
  } catch (e) {
    console.error(e);
    return backToLogin('Something went wrong', 500);
  }
};


/* =========================
   Export PDF via Puppeteer (unchanged format)
   ========================= */
exports.exportPDF = asyncHandler(async (req, res) => {
  try {
    let {
      from,
      to,
      searchPatientName,
      searchPatientAddress,
      searchPatientMobileNo,
      searchTreatment,
      searchDiagnose,
      birthdateFrom,
      birthdateTo,
      page,
      limit,
    } = req.query;

    const sort = req.query.sort && req.query.sort === "ASC" ? "ASC" : "DESC";
    const sortField = req.query.sortField || "createdAt";

    const params = {
      from,
      to,
      searchPatientName,
      searchPatientAddress,
      searchPatientMobileNo,
      searchTreatment,
      searchDiagnose,
      birthdateFrom,
      birthdateTo,
      sort,
      sortField,
      page,
      limit,
      clinicId: req.user?.clinicId, // scope
    };

    const transactionsData = await findAllPatientCount(params);
    const { paginatedResults } = transactionsData;

    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const webPage = await browser.newPage();

    const html = "<html><body><pre>" + JSON.stringify(paginatedResults, null, 2) + "</pre></body></html>";
    await webPage.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await webPage.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: false,
      margin: { top: "40px", bottom: "40px" },
    });

    await browser.close();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
    res.send(pdfBuffer);
  } catch (err) {
    console.error("Error generating PDF:", err);
    res.status(500).send("Failed to generate PDF");
  }
});
