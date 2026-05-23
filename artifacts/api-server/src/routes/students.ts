import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, classesTable, usersTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth, hashPassword } from "../lib/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

// ── Multer setup ─────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve("/home/runner/workspace/uploads");
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => { ensureUploadsDir(); cb(null, UPLOADS_DIR); },
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `student-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only jpg, jpeg, png, webp allowed"));
  },
});

// ── Admission number: KPS-YEAR-001 sequential ────────────────────────────────
async function generateAdmissionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  // Count all students (regardless of year) to get next sequential number
  const [row] = await db
    .select({ total: sql<number>`cast(count(*) as int)` })
    .from(studentsTable);
  const next = (Number(row?.total ?? 0) + 1);
  return `KPS-${year}-${String(next).padStart(3, "0")}`;
}

// GET /api/students
router.get("/", requireAuth, async (req, res) => {
  try {
    const { classId, status, search } = req.query;
    const query = db.select({
      id:               studentsTable.id,
      admissionNumber:  studentsTable.admissionNumber,
      name:             studentsTable.name,
      fatherName:       studentsTable.fatherName,
      motherName:       studentsTable.motherName,
      dateOfBirth:      studentsTable.dateOfBirth,
      gender:           studentsTable.gender,
      address:          studentsTable.address,
      phone:            studentsTable.phone,
      emergencyContact: studentsTable.emergencyContact,
      classId:          studentsTable.classId,
      className:        classesTable.name,
      section:          studentsTable.section,
      rollNumber:       studentsTable.rollNumber,
      feeAmount:        studentsTable.feeAmount,
      status:           studentsTable.status,
      imageUrl:         studentsTable.imageUrl,
      username:         studentsTable.username,
      createdAt:        studentsTable.createdAt,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id));

    const conditions = [];
    if (classId) conditions.push(eq(studentsTable.classId, Number(classId)));
    if (status)  conditions.push(eq(studentsTable.status, String(status)));
    if (search)  conditions.push(
      sql`(${studentsTable.name} ilike ${"%" + search + "%"} or ${studentsTable.admissionNumber} ilike ${"%" + search + "%"})`
    );

    const result = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    res.json(result.map(r => ({ ...r, feeAmount: r.feeAmount ? Number(r.feeAmount) : null })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/students
router.post("/", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const admissionNumber = await generateAdmissionNumber();
    // username: firstname.sequentialNum  e.g.  ali.001
    const seqPart = admissionNumber.split("-").pop() ?? String(Date.now());
    const firstName = (data.name as string).toLowerCase().replace(/\s+/g, ".").split(".")[0];
    const username  = `${firstName}.${seqPart}`;

    const [student] = await db
      .insert(studentsTable)
      .values({ ...data, admissionNumber, username, status: data.status || "active" })
      .returning();

    const hashedPassword = await hashPassword("kips123");
    await db
      .insert(usersTable)
      .values({ username, password: hashedPassword, role: "student", name: data.name, relatedId: student.id })
      .onConflictDoNothing();

    res.status(201).json({ ...student, feeAmount: student.feeAmount ? Number(student.feeAmount) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/students/:id/image
router.post("/:id/image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    if (!req.file) { res.status(400).json({ error: "No image file provided" }); return; }
    const imageUrl = `/api/students/uploads/${req.file.filename}`;
    const [updated] = await db.update(studentsTable).set({ imageUrl }).where(eq(studentsTable.id, Number(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Student not found" }); return; }
    res.json({ imageUrl });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// GET /api/students/uploads/:filename
router.get("/uploads/:filename", (req, res) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filepath);
});

// GET /api/students/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const [student] = await db.select({
      id:               studentsTable.id,
      admissionNumber:  studentsTable.admissionNumber,
      name:             studentsTable.name,
      fatherName:       studentsTable.fatherName,
      motherName:       studentsTable.motherName,
      dateOfBirth:      studentsTable.dateOfBirth,
      gender:           studentsTable.gender,
      address:          studentsTable.address,
      phone:            studentsTable.phone,
      emergencyContact: studentsTable.emergencyContact,
      classId:          studentsTable.classId,
      className:        classesTable.name,
      section:          studentsTable.section,
      rollNumber:       studentsTable.rollNumber,
      feeAmount:        studentsTable.feeAmount,
      status:           studentsTable.status,
      imageUrl:         studentsTable.imageUrl,
      username:         studentsTable.username,
      createdAt:        studentsTable.createdAt,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.id, Number(req.params.id)));

    if (!student) { res.status(404).json({ error: "Student not found" }); return; }
    res.json({ ...student, feeAmount: student.feeAmount ? Number(student.feeAmount) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/students/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(studentsTable).set({ ...req.body, updatedAt: new Date() }).where(eq(studentsTable.id, Number(req.params.id))).returning();
    if (!updated) { res.status(404).json({ error: "Student not found" }); return; }
    res.json({ ...updated, feeAmount: updated.feeAmount ? Number(updated.feeAmount) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/students/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(studentsTable).where(eq(studentsTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
