import { Router } from "express";
import { db } from "@workspace/db";
import { classesTable, studentsTable, staffTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/classes
router.get("/", requireAuth, async (req, res) => {
  try {
    const classes = await db.select().from(classesTable);
    const result = await Promise.all(classes.map(async (cls) => {
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.classId, cls.id));
      let teacherName = null;
      if (cls.teacherId) {
        const [teacher] = await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, cls.teacherId));
        teacherName = teacher?.name ?? null;
      }
      return { ...cls, studentCount: Number(countResult?.count ?? 0), teacherName };
    }));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/classes
router.post("/", requireAuth, async (req, res) => {
  try {
    const [cls] = await db.insert(classesTable).values(req.body).returning();
    res.status(201).json({ ...cls, studentCount: 0, teacherName: null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
