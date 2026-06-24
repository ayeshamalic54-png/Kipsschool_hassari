import { Router } from "express";
import { db } from "@workspace/db";
import { certificatesTable, studentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

router.use(requireAuth);
router.use((req, res, next) => {
  const user = (req as any).user;
  if (user?.role === "student") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
});

function generateCertNumber(type: string): string {
  const year = new Date().getFullYear();
  const prefix = type.toUpperCase().slice(0, 3);
  const num = Math.floor(1000 + Math.random() * 9000);
  return `KIPS-${prefix}-${year}-${num}`;
}

// GET /api/certificates
router.get("/", requireAuth, async (req, res) => {
  try {
    const { studentId, type } = req.query;
    const conditions = [];
    if (studentId) conditions.push(eq(certificatesTable.studentId, Number(studentId)));
    if (type) conditions.push(eq(certificatesTable.type, String(type)));

    const certs = conditions.length > 0
      ? await db.select().from(certificatesTable).where(and(...conditions))
      : await db.select().from(certificatesTable);

    const result = await Promise.all(certs.map(async (cert) => {
      const [student] = await db.select({ name: studentsTable.name }).from(studentsTable).where(eq(studentsTable.id, cert.studentId));
      return { ...cert, studentName: student?.name ?? null };
    }));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/certificates
router.post("/", requireAuth, async (req, res) => {
  try {
    const certificateNumber = generateCertNumber(req.body.type);
    const [cert] = await db.insert(certificatesTable).values({ ...req.body, certificateNumber }).returning();
    const [student] = await db.select({ name: studentsTable.name }).from(studentsTable).where(eq(studentsTable.id, cert.studentId));
    res.status(201).json({ ...cert, studentName: student?.name ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/certificates/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.delete(certificatesTable).where(eq(certificatesTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
