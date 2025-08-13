const express = require("express");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });
const authenticateToken = require("../../../../middlewares/authMiddleware");
const ctrl = require("../../../../controllers/admin/dashboard");

const router = express.Router();

// List + export (both admin and viewer)
router.get("/", authenticateToken(["upload", "view"]), ctrl.findAllPatients);
router.get("/export", authenticateToken(["upload", "view"]), ctrl.exportPDF);

// Excel upload (reads + preview) -> admin only
router.post("/", authenticateToken("upload"), upload.single("file"), ctrl.excelUpload);

// Update patient & diagnoses (admin)
router.put("/", authenticateToken("upload"), ctrl.saveEditPatients);

// Add diagnose with optional files (admin)
router.post("/add-diagnose", authenticateToken("upload"), upload.any(), ctrl.saveAddDiagonsis);

// Upload/delete lab report files (admin)
router.post("/report", authenticateToken("upload"), upload.array("files"), ctrl.uploadReport);
router.delete("/report/:id", authenticateToken("upload"), ctrl.deleteReport);

// Delete diagnose/patient (admin)
router.delete("/diagnose/:id", authenticateToken("upload"), ctrl.deleteDiagnose);
router.delete("/patient/:id", authenticateToken("upload"), ctrl.deletePatient);

// Add new patient only (admin)
router.post("/add-patient", authenticateToken("upload"), ctrl.addNewPatient);

module.exports = router;
