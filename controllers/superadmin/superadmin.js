const router = require("express").Router();
const bcrypt = require("bcryptjs");
const Clinic = require("../../models/entities/clinic");
const authenticateToken  = require("../../middlewares/authMiddleware")

// SUPER ADMIN only for all routes here
router.use(authenticateToken("SUPER_ADMIN"));

const slug = s => String(s || "").toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/* --------- LIST clinics --------- */
router.get("/users", async (_req, res) => {
  const rows = await Clinic.findAll({ order: [["createdAt", "DESC"]] });
  const data = rows.map(c => ({
    id: c.id,
    name: c.name,
    code: c.code,
    isActive: c.isActive,
    hasAdminPassword: !!c.adminPasswordHash,
    hasViewerPassword: !!c.viewerPasswordHash,
    createdAt: c.createdAt,
  }));
  res.json({ data });
});

/* --------- CREATE clinic --------- */
router.post("/users", async (req, res) => {
  const { name, adminPassword, viewerPassword } = req.body;
  if (!name) return res.status(400).json({ message: "name required" });

  const patch = {
    name,
    code: slug(name),
    isActive: true,
  };
  if (adminPassword && adminPassword.length >= 8) {
    patch.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  }
  if (viewerPassword && viewerPassword.length >= 8) {
    patch.viewerPasswordHash = await bcrypt.hash(viewerPassword, 12);
  }

  const clinic = await Clinic.create(patch);
  res.status(201).json({
    data: {
      id: clinic.id,
      name: clinic.name,
      code: clinic.code,
      hasAdminPassword: !!clinic.adminPasswordHash,
      hasViewerPassword: !!clinic.viewerPasswordHash,
    }
  });
});

/* --------- UPDATE clinic (rename / (re)set passwords / toggle active) --------- */
router.patch("/users/:id", async (req, res) => {
  const id = +req.params.id;
  const { name, isActive, adminPassword, viewerPassword } = req.body;

  const clinic = await Clinic.findByPk(id);
  if (!clinic) return res.status(404).json({ message: "Clinic not found" });

  const patch = {};
  if (typeof name === "string" && name.trim()) {
    patch.name = name.trim();
    patch.code = slug(name);
  }
  if (typeof isActive === "boolean") patch.isActive = isActive;

  if (adminPassword) {
    if (adminPassword.length < 8) return res.status(400).json({ message: "Admin password min 8 chars" });
    patch.adminPasswordHash = await bcrypt.hash(adminPassword, 12);
  }
  if (viewerPassword) {
    if (viewerPassword.length < 8) return res.status(400).json({ message: "Viewer password min 8 chars" });
    patch.viewerPasswordHash = await bcrypt.hash(viewerPassword, 12);
  }

  await clinic.update(patch);
  res.json({
    data: {
      id: clinic.id,
      name: clinic.name,
      code: clinic.code,
      isActive: clinic.isActive,
      hasAdminPassword: !!clinic.adminPasswordHash,
      hasViewerPassword: !!clinic.viewerPasswordHash,
    }
  });
});

/* --------- DELETE clinic --------- */
router.delete("/users/:id", async (req, res) => {
  const id = +req.params.id;
  const clinic = await Clinic.findByPk(id);
  if (!clinic) return res.status(404).json({ message: "Clinic not found" });
  await clinic.destroy();
  res.status(204).send();
});

module.exports = router;
