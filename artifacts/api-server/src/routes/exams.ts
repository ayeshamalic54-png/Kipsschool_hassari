import { Router } from "express";
import { db } from "@workspace/db";
import { examsTable, examResultsTable, classesTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/exams
router.get("/", requireAuth, async (req, res) => {
  try {
    const exams = await db
      .select({
        id: examsTable.id,
        name: examsTable.name,
        classId: examsTable.classId,
        className: classesTable.name,
        subject: examsTable.subject,
        examDate: examsTable.examDate,
        totalMarks: examsTable.totalMarks,
        passingMarks: examsTable.passingMarks,
        createdAt: examsTable.createdAt,
      })
      .from(examsTable)
      .leftJoin(classesTable, eq(examsTable.classId, classesTable.id));
    res.json(exams.map(e => ({ ...e, totalMarks: Number(e.totalMarks), passingMarks: Number(e.passingMarks) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/exams
router.post("/", requireAuth, async (req, res) => {
  try {
    const [exam] = await db.insert(examsTable).values(req.body).returning();
    res.status(201).json({ ...exam, totalMarks: Number(exam.totalMarks), passingMarks: Number(exam.passingMarks) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/exams/:id/results
router.get("/:id/results", requireAuth, async (req, res) => {
  try {
    const results = await db
      .select({
        id: examResultsTable.id,
        examId: examResultsTable.examId,
        studentId: examResultsTable.studentId,
        studentName: studentsTable.name,
        marksObtained: examResultsTable.marksObtained,
        grade: examResultsTable.grade,
        position: examResultsTable.position,
        remarks: examResultsTable.remarks,
        createdAt: examResultsTable.createdAt,
      })
      .from(examResultsTable)
      .leftJoin(studentsTable, eq(examResultsTable.studentId, studentsTable.id))
      .where(eq(examResultsTable.examId, Number(req.params.id)));
    res.json(results.map(r => ({ ...r, marksObtained: Number(r.marksObtained) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/exams/:id/results
router.post("/:id/results", requireAuth, async (req, res) => {
  try {
    const [result] = await db.insert(examResultsTable).values({ ...req.body, examId: Number(req.params.id) }).returning();
    res.status(201).json({ ...result, marksObtained: Number(result.marksObtained) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
