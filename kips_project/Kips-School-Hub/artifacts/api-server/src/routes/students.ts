import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, classesTable, usersTable } from "@workspace/db";
import { eq, sql, and, like, ilike } from "drizzle-orm";
import { requireAuth, hashPassword } from "../lib/auth";

const router = Router();

function generateAdmissionNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `KIPS-${year}-${random}`;
}

// GET /api/students
router.get("/", requireAuth, async (req, res) => {
  try {
    const { classId, status, search } = req.query;
    let query = db
      .select({
        id: studentsTable.id,
        admissionNumber: studentsTable.admissionNumber,
        name: studentsTable.name,
        fatherName: studentsTable.fatherName,
        motherName: studentsTable.motherName,
        dateOfBirth: studentsTable.dateOfBirth,
        gender: studentsTable.gender,
        address: studentsTable.address,
        phone: studentsTable.phone,
        emergencyContact: studentsTable.emergencyContact,
        classId: studentsTable.classId,
        className: classesTable.name,
        section: studentsTable.section,
        rollNumber: studentsTable.rollNumber,
        feeAmount: studentsTable.feeAmount,
        status: studentsTable.status,
        imageUrl: studentsTable.imageUrl,
        username: studentsTable.username,
        createdAt: studentsTable.createdAt,
      })
      .from(studentsTable)
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id));

    const conditions = [];
    if (classId) conditions.push(eq(studentsTable.classId, Number(classId)));
    if (status) conditions.push(eq(studentsTable.status, String(status)));
    if (search) conditions.push(
      sql`(${studentsTable.name} ilike ${'%' + search + '%'} or ${studentsTable.admissionNumber} ilike ${'%' + search + '%'})`
    );

    const result = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

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
    const admissionNumber = generateAdmissionNumber();
    const username = data.name.toLowerCase().replace(/\s+/g, ".") + "." + admissionNumber.split("-").pop();

    const [student] = await db.insert(studentsTable).values({
      ...data,
      admissionNumber,
      username,
      status: data.status || "active",
    }).returning();

    // Create login account
    const hashedPassword = await hashPassword("kips123");
    await db.insert(usersTable).values({
      username,
      password: hashedPassword,
      role: "student",
      name: data.name,
      relatedId: student.id,
    }).onConflictDoNothing();

    res.status(201).json({ ...student, feeAmount: student.feeAmount ? Number(student.feeAmount) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/students/:id
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const [student] = await db
      .select({
        id: studentsTable.id,
        admissionNumber: studentsTable.admissionNumber,
        name: studentsTable.name,
        fatherName: studentsTable.fatherName,
        motherName: studentsTable.motherName,
        dateOfBirth: studentsTable.dateOfBirth,
        gender: studentsTable.gender,
        address: studentsTable.address,
        phone: studentsTable.phone,
        emergencyContact: studentsTable.emergencyContact,
        classId: studentsTable.classId,
        className: classesTable.name,
        section: studentsTable.section,
        rollNumber: studentsTable.rollNumber,
        feeAmount: studentsTable.feeAmount,
        status: studentsTable.status,
        imageUrl: studentsTable.imageUrl,
        username: studentsTable.username,
        createdAt: studentsTable.createdAt,
      })
      .from(studentsTable)
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(eq(studentsTable.id, Number(req.params.id)));

    if (!student) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
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
    if (!updated) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
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
