import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, studentsTable, staffTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

async function enrichAttendance(att: Record<string, unknown>) {
  let personName = null;
  let className = null;
  if (att.studentId) {
    const [s] = await db.select({ name: studentsTable.name, classId: studentsTable.classId }).from(studentsTable).where(eq(studentsTable.id, Number(att.studentId)));
    personName = s?.name ?? null;
    if (s?.classId) {
      const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, s.classId));
      className = cls?.name ?? null;
    }
  } else if (att.staffId) {
    const [s] = await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, Number(att.staffId)));
    personName = s?.name ?? null;
  }
  return { ...att, personName, className };
}

// GET /api/attendance
router.get("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    const { date, classId, type } = req.query;
    const conditions = [];

    // Students only see their own attendance
    if (reqUser.role === "student") {
      const [student] = await db.select({ id: studentsTable.id }).from(studentsTable).where(eq(studentsTable.username, String(reqUser.username)));
      if (!student) { res.json([]); return; }
      conditions.push(eq(attendanceTable.studentId, student.id));
    }

    if (date) conditions.push(eq(attendanceTable.date, String(date)));
    if (type) conditions.push(eq(attendanceTable.type, String(type) as "student" | "staff"));

    const records = conditions.length > 0
      ? await db.select().from(attendanceTable).where(and(...conditions))
      : await db.select().from(attendanceTable);

    const result = await Promise.all(records.map(r => enrichAttendance(r as unknown as Record<string, unknown>)));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/attendance
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const [att] = await db.insert(attendanceTable).values(req.body).returning();
    const enriched = await enrichAttendance(att as unknown as Record<string, unknown>);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
