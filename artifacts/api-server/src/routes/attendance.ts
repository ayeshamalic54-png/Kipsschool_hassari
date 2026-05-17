import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, studentsTable, staffTable, classesTable, salariesTable } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
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

// GET /api/attendance/summary?month=2026-05&type=staff&staffId=3
// Returns absent/late/present/leave counts for a person in a month
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { month, type, staffId, studentId } = req.query;
    if (!month || !type) { res.status(400).json({ error: "month and type required" }); return; }

    const conditions = [
      like(attendanceTable.date, `${month}-%`),
      eq(attendanceTable.type, String(type) as "staff" | "student"),
    ];
    if (staffId) conditions.push(eq(attendanceTable.staffId, Number(staffId)));
    if (studentId) conditions.push(eq(attendanceTable.studentId, Number(studentId)));

    const records = await db.select().from(attendanceTable).where(and(...conditions));
    const summary = {
      month: String(month),
      total: records.length,
      present: records.filter(r => r.status === "present").length,
      absent: records.filter(r => r.status === "absent").length,
      late: records.filter(r => r.status === "late").length,
      leave: records.filter(r => r.status === "leave").length,
    };
    res.json(summary);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/attendance/monthly-deductions?month=2026-05&type=staff
// Returns all staff/students with their monthly attendance + deduction calculation
router.get("/monthly-deductions", requireAuth, async (req, res) => {
  try {
    const { month, type } = req.query;
    if (!month || !type) { res.status(400).json({ error: "month and type required" }); return; }

    const records = await db.select().from(attendanceTable).where(
      and(like(attendanceTable.date, `${month}-%`), eq(attendanceTable.type, String(type) as "staff" | "student"))
    );

    if (type === "staff") {
      const staffList = await db.select().from(staffTable);
      // Also get salary records for the month to get basic salary
      const salaryRecords = await db.select().from(salariesTable).where(
        like(salariesTable.month, `${month}%`)
      );

      const result = staffList.map(s => {
        const staffRecs = records.filter(r => r.staffId === s.id);
        const absent = staffRecs.filter(r => r.status === "absent").length;
        const late = staffRecs.filter(r => r.status === "late").length;
        const present = staffRecs.filter(r => r.status === "present").length;
        const leave = staffRecs.filter(r => r.status === "leave").length;
        const salary = salaryRecords.find(sal => sal.staffId === s.id);
        const basicSalary = salary ? Number(salary.amount) : Number(s.salary ?? 0);
        const perDay = Math.round(basicSalary / 26);
        const absentDed = absent * perDay;
        const lateDed = late * Math.round(perDay / 2);
        const totalDeduction = absentDed + lateDed;
        const netSalary = basicSalary - totalDeduction;
        return { id: s.id, name: s.name, role: s.role, basicSalary, perDay, absent, late, present, leave, absentDed, lateDed, totalDeduction, netSalary, salaryId: salary?.id ?? null, salaryStatus: salary?.status ?? null };
      }).filter(s => s.basicSalary > 0 || s.absent + s.late + s.present + s.leave > 0);

      res.json(result);
    } else {
      const studentList = await db.select({
        id: studentsTable.id, name: studentsTable.name, feeAmount: studentsTable.feeAmount,
        classId: studentsTable.classId,
      }).from(studentsTable).where(eq(studentsTable.status, "active"));

      const classIds = [...new Set(studentList.map(s => s.classId))];
      const classes = classIds.length > 0 ? await db.select().from(classesTable) : [];

      const result = studentList.map(s => {
        const cls = classes.find(c => c.id === s.classId);
        const stuRecs = records.filter(r => r.studentId === s.id);
        const absent = stuRecs.filter(r => r.status === "absent").length;
        const late = stuRecs.filter(r => r.status === "late").length;
        const present = stuRecs.filter(r => r.status === "present").length;
        const leave = stuRecs.filter(r => r.status === "leave").length;
        const feeAmount = Number(s.feeAmount ?? 0);
        const perDay = Math.round(feeAmount / 26);
        const absentDed = absent * perDay;
        const lateDed = late * Math.round(perDay / 2);
        const totalDeduction = absentDed + lateDed;
        const netFee = feeAmount - totalDeduction;
        return { id: s.id, name: s.name, className: cls?.name ?? "—", feeAmount, perDay, absent, late, present, leave, absentDed, lateDed, totalDeduction, netFee };
      });

      res.json(result);
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

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
