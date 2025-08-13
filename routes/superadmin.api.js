// routes/superadmin.api.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const Clinic = require("../models/entities/clinic");
const authenticateToken = require("../middlewares/authMiddleware");

router.use(authenticateToken("SUPER_ADMIN"));

const slug = s => String(s || "").toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

async function uniqueCodeFor(name) {
  const base = slug(name);
  let code = base;
  let n = 1;
  // ensure unique `code`
  // (SELECT COUNT(*) is fine too; this simple loop is OK for small N)
  while (await Clinic.findOne({ where: { code } })) {
    code = `${base}-${++n}`;
  }
  return code;
}

/* LIST */
router.get("/clinics", async (_req, res) => {
  const rows = await Clinic.findAll({ order: [["createdAt", "DESC"]] });
  res.json({
    data: rows.map(c => ({
      id: c.id, name: c.name, code: c.code, isActive: c.isActive,
      hasAdminPassword: !!c.adminPasswordHash,
      hasViewerPassword: !!c.viewerPasswordHash,
      createdAt: c.createdAt
    }))
  });
});

/* CREATE */
router.post("/clinics", async (req, res) => {
  try {
    const { name, adminPassword, viewerPassword } = req.body;
    if (!name) return res.status(400).json({ message: "name required" });

    const code = await uniqueCodeFor(name);
    const patch = { name, code, isActive: true };

    if (adminPassword) {
      if (adminPassword.length < 8) return res.status(400).json({ message: "Admin password min 8" });
      patch.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    }
    if (viewerPassword) {
      if (viewerPassword.length < 8) return res.status(400).json({ message: "Viewer password min 8" });
      patch.viewerPasswordHash = await bcrypt.hash(viewerPassword, 12);
    }

    const clinic = await Clinic.create(patch);
    return res.status(201).json({
      data: {
        id: clinic.id, name: clinic.name, code: clinic.code,
        hasAdminPassword: !!clinic.adminPasswordHash,
        hasViewerPassword: !!clinic.viewerPasswordHash,
        isActive: clinic.isActive
      }
    });
  } catch (err) {
    console.error("[POST /clinics] error:", err);
    // common MySQL errors
    if (String(err?.original?.code).includes("ER_DUP_ENTRY")) {
      return res.status(409).json({ message: "Duplicate clinic code" });
    }
    if (String(err?.original?.sqlMessage || "").includes("Unknown column")) {
      return res.status(500).json({ message: "DB schema missing columns. Run ALTER TABLE for password columns." });
    }
    return res.status(500).json({ message: "Failed to create clinic" });
  }
});

/* UPDATE */
router.patch("/clinics/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const { name, isActive, adminPassword, viewerPassword } = req.body;
    const clinic = await Clinic.findByPk(id);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    const patch = {};
    if (typeof name === "string" && name.trim()) {
      patch.name = name.trim();
      patch.code = await uniqueCodeFor(name.trim()); // regen code from new name
    }
    if (typeof isActive === "boolean") patch.isActive = isActive;

    if (adminPassword) {
      if (adminPassword.length < 8) return res.status(400).json({ message: "Admin password min 8" });
      patch.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
    }
    if (viewerPassword) {
      if (viewerPassword.length < 8) return res.status(400).json({ message: "Viewer password min 8" });
      patch.viewerPasswordHash = await bcrypt.hash(viewerPassword, 12);
    }

    await clinic.update(patch);
    return res.json({
      data: {
        id: clinic.id, name: clinic.name, code: clinic.code, isActive: clinic.isActive,
        hasAdminPassword: !!clinic.adminPasswordHash,
        hasViewerPassword: !!clinic.viewerPasswordHash
      }
    });
  } catch (err) {
    console.error("[PATCH /clinics/:id] error:", err);
    return res.status(500).json({ message: "Failed to update clinic" });
  }
});

/* DELETE */
router.delete("/clinics/:id", async (req, res) => {
  try {
    const id = +req.params.id;
    const clinic = await Clinic.findByPk(id);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });
    await clinic.destroy();
    return res.status(204).send();
  } catch (err) {
    console.error("[DELETE /clinics/:id] error:", err);
    return res.status(500).json({ message: "Failed to delete clinic" });
  }
});

module.exports = router;
