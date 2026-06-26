import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, classesTable, usersTable, feeStructuresTable, feesTable, attendanceTable, examResultsTable, certificatesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { requireAuth, hashPassword } from "../lib/auth";
import multer from "multer";
import path from "path";
import fs from "fs";
import type { Request } from "express";
import { compressImageIfBase64 } from "../lib/image";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

// ── Multer setup ─────────────────────────────────────────────────────────────
const UPLOADS_DIR = path.resolve("/home/runner/workspace/uploads");
function ensureUploadsDir() {
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => { ensureUploadsDir(); cb(null, UPLOADS_DIR); },
  filename:    (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `student-${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowed = [".jpg", ".jpeg", ".png", ".webp"];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error("Only jpg, jpeg, png, webp allowed") as any);
  },
});

// ── Admission number: KIPS-YEAR-XXXX sequential ────────────────────────────────
async function generateAdmissionNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const students = await db
    .select({ admissionNumber: studentsTable.admissionNumber })
    .from(studentsTable);
  
  let maxNum = 3000;
  const pattern = new RegExp(`^KIPS-${year}-(\\d+)$`, 'i');
  for (const s of students) {
    if (s.admissionNumber) {
      const match = s.admissionNumber.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        // Only consider sequence numbers under 4000 to keep the 3000-based series sequential and tight
        if (num > maxNum && num < 4000) {
          maxNum = num;
        }
      }
    }
  }
  return `KIPS-${year}-${maxNum + 1}`;
}

// GET /api/students
router.get("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as any).user;
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
      hasImage:         sql<boolean>`coalesce(${studentsTable.imageUrl} is not null and ${studentsTable.imageUrl} != '', false)`,
      username:         studentsTable.username,
      createdAt:        studentsTable.createdAt,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id));

    const conditions = [];
    if (reqUser.role === "student") {
      conditions.push(eq(studentsTable.username, reqUser.username));
    } else {
      if (classId) conditions.push(eq(studentsTable.classId, Number(classId)));
      if (status)  conditions.push(eq(studentsTable.status, String(status)));
      if (search)  conditions.push(
        sql`(${studentsTable.name} ilike ${"%" + search + "%"} or ${studentsTable.admissionNumber} ilike ${"%" + search + "%"})`
      );
    }

    const result = conditions.length > 0 ? await query.where(and(...conditions)) : await query;
    res.json(result.map(r => ({
      ...r,
      feeAmount: r.feeAmount ? Number(r.feeAmount) : null,
      imageUrl: r.hasImage ? `/api/students/${r.id}/image` : null
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/students
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as any).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const data = req.body;
    if (data && data.imageUrl) {
      data.imageUrl = await compressImageIfBase64(data.imageUrl);
    }
    const admissionNumber = await generateAdmissionNumber();
    // username is exactly the admission number (e.g. KIPS-2026-3004)
    const username = admissionNumber;

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
router.post("/:id/image", requireAuth, upload.single("image"), async (req: any, res) => {
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

// POST /api/students/promote  ← Promote students from one class to next
router.post("/promote", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const { fromClassId, toClassId, studentIds, promoteWithArrears } = req.body;

    if (!fromClassId || !toClassId || !Array.isArray(studentIds) || studentIds.length === 0) {
      res.status(400).json({ error: "fromClassId, toClassId and studentIds are required" });
      return;
    }

    // Get the target class fee structure if available
    const [feeStruct] = await db.select().from(feeStructuresTable).where(eq(feeStructuresTable.classId, Number(toClassId)));

    let promoted = 0;
    for (const sid of studentIds) {
      const id = Number(sid);
      const updates: Record<string, unknown> = { classId: Number(toClassId), updatedAt: new Date() };
      if (feeStruct?.monthlyFee) {
        updates.feeAmount = String(feeStruct.monthlyFee);
      }
      await db.update(studentsTable).set(updates).where(eq(studentsTable.id, id));
      promoted++;
    }

    const [toClass] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, Number(toClassId)));
    const [fromClass] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, Number(fromClassId)));

    res.json({
      promoted,
      fromClass: fromClass?.name ?? String(fromClassId),
      toClass: toClass?.name ?? String(toClassId),
      feeUpdated: !!feeStruct,
      newFeeAmount: feeStruct?.monthlyFee ? Number(feeStruct.monthlyFee) : null,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/students/uploads/:filename
router.get("/uploads/:filename", (req, res) => {
  const filepath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filepath)) { res.status(404).json({ error: "Not found" }); return; }
  res.sendFile(filepath);
});

// GET /api/students/:id/image
router.get("/:id/image", async (req, res) => {
  try {
    const [student] = await db
      .select({ imageUrl: studentsTable.imageUrl })
      .from(studentsTable)
      .where(eq(studentsTable.id, Number(req.params.id)));

    if (!student || !student.imageUrl) {
      res.status(404).send("Not found");
      return;
    }

    const img = student.imageUrl;
    if (img.startsWith("data:")) {
      const parts = img.split(",");
      if (parts.length >= 2) {
        const matches = parts[0].match(/^data:([A-Za-z-+\/]+);base64$/i);
        if (matches) {
          const contentType = matches[1];
          // Strip any whitespace/newlines that might cause decoding or matching issues
          const base64Data = parts.slice(1).join(",").replace(/\s/g, "");
          const buffer = Buffer.from(base64Data, "base64");
          res.set("Content-Type", contentType);
          res.set("Cache-Control", "public, max-age=86400"); // Cache for 1 day
          res.send(buffer);
          return;
        }
      }
    }

    // Fallback: if it's a file path
    if (img.startsWith("/api/students/uploads/")) {
      const filename = img.split("/").pop();
      const filepath = path.join(UPLOADS_DIR, filename!);
      if (fs.existsSync(filepath)) {
        res.sendFile(filepath);
        return;
      }
    }

    res.status(404).send("Not found");
  } catch (err) {
    req.log.error(err);
    res.status(500).send("Internal server error");
  }
});

// GET /api/students/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as any).user;
    if (reqUser.role === "student") {
      const [studentByUsername] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.username, reqUser.username));
      if (!studentByUsername || studentByUsername.id !== Number(req.params.id)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }

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
      hasImage:         sql<boolean>`coalesce(${studentsTable.imageUrl} is not null and ${studentsTable.imageUrl} != '', false)`,
      username:         studentsTable.username,
      createdAt:        studentsTable.createdAt,
    })
    .from(studentsTable)
    .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
    .where(eq(studentsTable.id, Number(req.params.id)));

    if (!student) { res.status(404).json({ error: "Student not found" }); return; }
    res.json({
      ...student,
      feeAmount: student.feeAmount ? Number(student.feeAmount) : null,
      imageUrl: student.hasImage ? `/api/students/${student.id}/image` : null
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/students/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as any).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const updates = { ...req.body };
    if (updates.imageUrl) {
      updates.imageUrl = await compressImageIfBase64(updates.imageUrl);
    }
    const [updated] = await db.update(studentsTable).set({ ...updates, updatedAt: new Date() }).where(eq(studentsTable.id, Number(req.params.id))).returning();
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
    const reqUser = (req as any).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const studentId = Number(req.params.id);

    // Cascade delete related records
    await db.delete(feesTable).where(eq(feesTable.studentId, studentId));
    await db.delete(attendanceTable).where(eq(attendanceTable.studentId, studentId));
    await db.delete(examResultsTable).where(eq(examResultsTable.studentId, studentId));
    await db.delete(certificatesTable).where(eq(certificatesTable.studentId, studentId));
    await db.delete(usersTable).where(
      and(
        eq(usersTable.relatedId, studentId),
        eq(usersTable.role, "student")
      )
    );

    // Delete student core record
    await db.delete(studentsTable).where(eq(studentsTable.id, studentId));

    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
