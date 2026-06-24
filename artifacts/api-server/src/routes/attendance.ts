import { Router } from "express";
import { db } from "@workspace/db";
import { attendanceTable, studentsTable, staffTable, classesTable, salariesTable, settingsTable } from "@workspace/db";
import { eq, and, like, sql, gte, lte } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

async function enrichAttendance(att: Record<string, unknown>) {
  let personName = null;
  let className = null;
  if (att.studentId) {
    const [s] = await db
      .select({ name: studentsTable.name, classId: studentsTable.classId })
      .from(studentsTable)
      .where(eq(studentsTable.id, Number(att.studentId)));
    personName = s?.name ?? null;
    if (s?.classId) {
      const [cls] = await db
        .select({ name: classesTable.name })
        .from(classesTable)
        .where(eq(classesTable.id, s.classId));
      className = cls?.name ?? null;
    }
  } else if (att.staffId) {
    const [s] = await db
      .select({ name: staffTable.name })
      .from(staffTable)
      .where(eq(staffTable.id, Number(att.staffId)));
    personName = s?.name ?? null;
  }
  return { ...att, personName, className };
}

// GET /api/attendance/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { month, type, staffId, studentId } = req.query;
    if (!month || !type) { res.status(400).json({ error: "month and type required" }); return; }

    const conditions = [
      like(attendanceTable.date, `${month}-%`),
      eq(attendanceTable.type, String(type) as "staff" | "student"),
    ];
    if (staffId)   conditions.push(eq(attendanceTable.staffId,   Number(staffId)));
    if (studentId) conditions.push(eq(attendanceTable.studentId, Number(studentId)));

    const records = await db.select().from(attendanceTable).where(and(...conditions));
    const summary = {
      month:   String(month),
      total:   records.length,
      present: records.filter(r => r.status === "present").length,
      absent:  records.filter(r => r.status === "absent").length,
      late:    records.filter(r => r.status === "late").length,
      leave:   records.filter(r => r.status === "leave").length,
    };
    res.json(summary);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/attendance/monthly-deductions
router.get("/monthly-deductions", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const { month, type } = req.query;
    if (!month || !type) { res.status(400).json({ error: "month and type required" }); return; }

    const records = await db.select().from(attendanceTable).where(
      and(
        like(attendanceTable.date, `${month}-%`),
        eq(attendanceTable.type, String(type) as "staff" | "student")
      )
    );

    // Load configurable deduction criteria from settings table (single-row, id=1).
    // Fallback to sensible defaults if row is missing.
    const [settingsRow] = await db.select().from(settingsTable).where(eq(settingsTable.id, 1));
    const workingDays = settingsRow?.workingDaysPerMonth   ?? 26;
    const absentFrac  = Number(settingsRow?.absentPenaltyFraction ?? 1);
    const lateFrac    = Number(settingsRow?.latePenaltyFraction   ?? 0.5);
    const leaveFrac   = Number(settingsRow?.leavePenaltyFraction  ?? 0);

    if (type === "staff") {
      const staffList = await db.select().from(staffTable);
      const salaryRecords = await db.select().from(salariesTable).where(
        like(salariesTable.month, `${month}%`)
      );
      const result = staffList.map(s => {
        const staffRecs  = records.filter(r => r.staffId === s.id);
        const absent     = staffRecs.filter(r => r.status === "absent").length;
        const late       = staffRecs.filter(r => r.status === "late").length;
        const present    = staffRecs.filter(r => r.status === "present").length;
        const leave      = staffRecs.filter(r => r.status === "leave").length;
        const salary     = salaryRecords.find(sal => sal.staffId === s.id);
        const basicSalary = salary ? Number(salary.amount) : Number(s.salary ?? 0);
        const perDay     = Math.round(basicSalary / workingDays);
        const absentDed  = Math.round(absent * perDay * absentFrac);
        const lateDed    = Math.round(late   * perDay * lateFrac);
        const leaveDed   = Math.round(leave  * perDay * leaveFrac);
        const totalDeduction = absentDed + lateDed + leaveDed;
        const netSalary  = basicSalary - totalDeduction;
        return { id: s.id, name: s.name, role: s.role, basicSalary, perDay, absent, late, present, leave, absentDed, lateDed, leaveDed, totalDeduction, netSalary, salaryId: salary?.id ?? null, salaryStatus: salary?.status ?? null };
      }).filter(s => s.basicSalary > 0 || s.absent + s.late + s.present + s.leave > 0);
      res.json(result);
    } else {
      const studentList = await db
        .select({ id: studentsTable.id, name: studentsTable.name, feeAmount: studentsTable.feeAmount, classId: studentsTable.classId })
        .from(studentsTable)
        .where(eq(studentsTable.status, "active"));
      const classes = studentList.length > 0 ? await db.select().from(classesTable) : [];
      const result = studentList.map(s => {
        const cls        = classes.find(c => c.id === s.classId);
        const stuRecs    = records.filter(r => r.studentId === s.id);
        const absent     = stuRecs.filter(r => r.status === "absent").length;
        const late       = stuRecs.filter(r => r.status === "late").length;
        const present    = stuRecs.filter(r => r.status === "present").length;
        const leave      = stuRecs.filter(r => r.status === "leave").length;
        const feeAmount  = Number(s.feeAmount ?? 0);
        const perDay     = Math.round(feeAmount / workingDays);
        const absentDed  = Math.round(absent * perDay * absentFrac);
        const lateDed    = Math.round(late   * perDay * lateFrac);
        const leaveDed   = Math.round(leave  * perDay * leaveFrac);
        const totalDeduction = absentDed + lateDed + leaveDed;
        const netFee     = feeAmount - totalDeduction;
        return { id: s.id, name: s.name, className: cls?.name ?? "—", feeAmount, perDay, absent, late, present, leave, absentDed, lateDed, leaveDed, totalDeduction, netFee };
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
    const { date, dateFrom, dateTo, classId, type } = req.query;
    const conditions = [];

    if (reqUser.role === "student") {
      // Look up student by username from JWT (related_id is not in token)
      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.username, String(reqUser.username)));
      if (!student) { res.json([]); return; }
      conditions.push(eq(attendanceTable.studentId, student.id));
      conditions.push(eq(attendanceTable.type, "student"));
      if (dateFrom) conditions.push(gte(attendanceTable.date, String(dateFrom)));
      if (dateTo)   conditions.push(lte(attendanceTable.date, String(dateTo)));
    } else {
      // Date range takes precedence over single-date filter.
      if (dateFrom || dateTo) {
        if (dateFrom) conditions.push(gte(attendanceTable.date, String(dateFrom)));
        if (dateTo)   conditions.push(lte(attendanceTable.date, String(dateTo)));
      } else if (date) {
        conditions.push(eq(attendanceTable.date, String(date)));
      }
      if (type) conditions.push(eq(attendanceTable.type, String(type) as "student" | "staff"));
      if (classId) {
        const classStudents = await db
          .select({ id: studentsTable.id })
          .from(studentsTable)
          .where(eq(studentsTable.classId, Number(classId)));
        const ids = classStudents.map(s => s.id);
        if (ids.length > 0) {
          conditions.push(sql`${attendanceTable.studentId} = ANY(ARRAY[${sql.join(ids.map(id => sql`${id}`), sql`, `)}])`);
        } else {
          // Class has no students — return zero records instead of falling
          // through to an unfiltered result.
          res.json([]);
          return;
        }
      }
    }

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

// POST /api/attendance/bulk
// Saves attendance for many people at once. For each record, if an attendance
// row already exists for the same (date, studentId|staffId, type), update its
// status; otherwise insert a new row.
router.post("/bulk", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    if (records.length === 0) { res.json({ saved: 0 }); return; }

    let saved = 0;
    for (const r of records) {
      const date   = String(r.date ?? "");
      const type   = r.type === "staff" ? "staff" : "student";
      const status = ["present", "absent", "late", "leave"].includes(r.status) ? r.status : "present";
      const studentId = type === "student" && r.studentId != null ? Number(r.studentId) : null;
      const staffId   = type === "staff"   && r.staffId   != null ? Number(r.staffId)   : null;
      if (!date || (studentId === null && staffId === null)) continue;

      const conditions = [
        eq(attendanceTable.date, date),
        eq(attendanceTable.type, type as "student" | "staff"),
      ];
      if (studentId !== null) conditions.push(eq(attendanceTable.studentId, studentId));
      if (staffId   !== null) conditions.push(eq(attendanceTable.staffId,   staffId));

      const [existing] = await db
        .select({ id: attendanceTable.id })
        .from(attendanceTable)
        .where(and(...conditions));

      if (existing) {
        await db.update(attendanceTable)
          .set({ status })
          .where(eq(attendanceTable.id, existing.id));
      } else {
        await db.insert(attendanceTable).values({
          date,
          type: type as "student" | "staff",
          status,
          studentId,
          staffId,
        });
      }
      saved++;
    }
    res.json({ saved });
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

// PUT /api/attendance/:id
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const id = Number(req.params.id);
    const [att] = await db
      .update(attendanceTable)
      .set({ status: req.body.status })
      .where(eq(attendanceTable.id, id))
      .returning();
    if (!att) { res.status(404).json({ error: "Not found" }); return; }
    const enriched = await enrichAttendance(att as unknown as Record<string, unknown>);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/attendance/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const id = Number(req.params.id);
    await db.delete(attendanceTable).where(eq(attendanceTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;