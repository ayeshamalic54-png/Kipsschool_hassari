// ============================================================
// FILE PATH: artifacts/api-server/src/routes/exams.ts
// TASK 6: Student sirf apni class ke exams dekhta hai
// TASK 9: Bulk result entry endpoint added
// ============================================================
import { Router } from "express";
import { db } from "@workspace/db";
import { examsTable, examResultsTable, studentsTable, classesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: { id: number; username: string; role: string; name: string } };

const router = Router();

// ─── Grade calculator ─────────────────────────────────────────────────────────
function calcGrade(marks: number, total: number): string {
  const pct = (marks / total) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

// ─── GET /api/exams  (TASK 6: student gets only their class exams) ─────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;

    let exams;

    if (reqUser.role === "student") {
      // Find student's classId first
      const [student] = await db
        .select({ id: studentsTable.id, classId: studentsTable.classId })
        .from(studentsTable)
        .where(eq(studentsTable.username, reqUser.username));

      if (!student?.classId) { res.json([]); return; }

      exams = await db
        .select()
        .from(examsTable)
        .where(eq(examsTable.classId, student.classId));
    } else {
      const { classId } = req.query;
      if (classId) {
        exams = await db
          .select()
          .from(examsTable)
          .where(eq(examsTable.classId, Number(classId)));
      } else {
        exams = await db.select().from(examsTable);
      }
    }

    // Enrich with class name and result count
    const enriched = await Promise.all(exams.map(async exam => {
      let className = null;
      if (exam.classId) {
        const [cls] = await db
          .select({ name: classesTable.name })
          .from(classesTable)
          .where(eq(classesTable.id, exam.classId));
        className = cls?.name ?? null;
      }
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(examResultsTable)
        .where(eq(examResultsTable.examId, exam.id));
      return { ...exam, className, resultCount: Number(count ?? 0) };
    }));

    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/exams ──────────────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const [exam] = await db.insert(examsTable).values(req.body).returning();
    res.status(201).json({ ...exam, className: null, resultCount: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── DELETE /api/exams/:id ────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const examId = Number(req.params.id);
    await db.delete(examResultsTable).where(eq(examResultsTable.examId, examId));
    await db.delete(examsTable).where(eq(examsTable.id, examId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /api/exams/:id/results  (TASK 6: student sees only their result) ─────
router.get("/:id/results", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    const examId  = Number(req.params.id);

    if (reqUser.role === "student") {
      // Find this student's row
      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.username, reqUser.username));

      if (!student) { res.json([]); return; }

      const results = await db
        .select({
          id:            examResultsTable.id,
          examId:        examResultsTable.examId,
          studentId:     examResultsTable.studentId,
          studentName:   studentsTable.name,
          marksObtained: examResultsTable.marksObtained,
          grade:         examResultsTable.grade,
          position:      examResultsTable.position,
          remarks:       examResultsTable.remarks,
        })
        .from(examResultsTable)
        .leftJoin(studentsTable, eq(examResultsTable.studentId, studentsTable.id))
        .where(
          and(
            eq(examResultsTable.examId, examId),
            eq(examResultsTable.studentId, student.id)
          )
        );

      res.json(results.map(r => ({ ...r, marksObtained: Number(r.marksObtained) })));
      return;
    }

    // Admin / teacher — all results for this exam
    const results = await db
      .select({
        id:            examResultsTable.id,
        examId:        examResultsTable.examId,
        studentId:     examResultsTable.studentId,
        studentName:   studentsTable.name,
        marksObtained: examResultsTable.marksObtained,
        grade:         examResultsTable.grade,
        position:      examResultsTable.position,
        remarks:       examResultsTable.remarks,
      })
      .from(examResultsTable)
      .leftJoin(studentsTable, eq(examResultsTable.studentId, studentsTable.id))
      .where(eq(examResultsTable.examId, examId));

    res.json(results.map(r => ({ ...r, marksObtained: Number(r.marksObtained) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/exams/:id/results  (single result) ────────────────────────────
router.post("/:id/results", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const examId = Number(req.params.id);
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
    if (!exam) { res.status(404).json({ error: "Exam not found" }); return; }

    const { studentId, marksObtained, grade, remarks } = req.body;
    const marks      = Number(marksObtained);
    const finalGrade = grade ?? calcGrade(marks, Number(exam.totalMarks));

    // Upsert: update if exists, insert if not
    const [existing] = await db
      .select()
      .from(examResultsTable)
      .where(
        and(
          eq(examResultsTable.examId, examId),
          eq(examResultsTable.studentId, Number(studentId))
        )
      );

    let result;
    if (existing) {
      [result] = await db
        .update(examResultsTable)
        .set({ marksObtained: String(marks), grade: finalGrade, remarks: remarks ?? null })
        .where(eq(examResultsTable.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(examResultsTable)
        .values({
          examId,
          studentId:     Number(studentId),
          marksObtained: String(marks),
          grade:         finalGrade,
          remarks:       remarks ?? null,
        })
        .returning();
    }

    res.status(201).json({ ...result, marksObtained: Number(result.marksObtained) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /api/exams/:id/results/bulk  (TASK 9: bulk result entry) ─────────────
//
// Body: { entries: [{ studentId, marksObtained, remarks? }] }
// Upserts each entry (updates if result already exists, inserts otherwise).
//
router.post("/:id/results/bulk", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const examId = Number(req.params.id);
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
    if (!exam) { res.status(404).json({ error: "Exam not found" }); return; }

    type Entry = { studentId: number; marksObtained: number; remarks?: string | null };
    const { entries } = req.body as { entries: Entry[] };

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: "entries array is required" });
      return;
    }

    let saved = 0;

    for (const entry of entries) {
      // Skip if marks not provided or invalid
      if (
        entry.marksObtained === null ||
        entry.marksObtained === undefined ||
        isNaN(Number(entry.marksObtained))
      ) continue;

      const marks = Number(entry.marksObtained);
      const grade = calcGrade(marks, Number(exam.totalMarks));

      const [existing] = await db
        .select()
        .from(examResultsTable)
        .where(
          and(
            eq(examResultsTable.examId, examId),
            eq(examResultsTable.studentId, Number(entry.studentId))
          )
        );

      if (existing) {
        await db
          .update(examResultsTable)
          .set({ marksObtained: String(marks), grade, remarks: entry.remarks ?? null })
          .where(eq(examResultsTable.id, existing.id));
      } else {
        await db
          .insert(examResultsTable)
          .values({
            examId,
            studentId:     Number(entry.studentId),
            marksObtained: String(marks),
            grade,
            remarks:       entry.remarks ?? null,
          });
      }
      saved++;
    }

    res.status(201).json({ saved, message: `${saved} results saved successfully` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Bulk result save failed" });
  }
});

// ─── DELETE /api/exams/:id/results/:resultId ──────────────────────────────────
router.delete("/:id/results/:resultId", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    await db
      .delete(examResultsTable)
      .where(eq(examResultsTable.id, Number(req.params.resultId)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
