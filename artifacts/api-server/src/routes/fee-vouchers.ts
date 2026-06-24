import { Router } from "express";
import { db } from "@workspace/db";
import { feesTable, studentsTable, classesTable, feeStructuresTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: { id: number; role: string } };

const router = Router();

async function enrichFee(fee: Record<string, unknown>) {
  const studentId = Number(fee.studentId);
  const [student] = await db
    .select({
      name: studentsTable.name,
      admissionNumber: studentsTable.admissionNumber,
      classId: studentsTable.classId,
      fatherName: studentsTable.fatherName,
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  let className = null;
  if (student?.classId) {
    const [cls] = await db
      .select({ name: classesTable.name })
      .from(classesTable)
      .where(eq(classesTable.id, student.classId));
    className = cls?.name ?? null;
  }
  const amount = Number(fee.amount ?? 0);
  const paidAmount = Number(fee.paidAmount ?? 0);
  const fine = Number(fee.fine ?? 0);
  const discount = Number(fee.discount ?? 0);
  const tuitionFee = Number(fee.tuitionFee ?? 0);
  const examFee = Number(fee.examFee ?? 0);
  const annualFee = Number(fee.annualFee ?? 0);
  const transportFee = Number(fee.transportFee ?? 0);
  const arrears = Number(fee.arrears ?? 0);
  return {
    ...fee,
    amount,
    paidAmount,
    fine,
    discount,
    tuitionFee,
    examFee,
    annualFee,
    transportFee,
    arrears,
    remainingAmount: Math.max(0, amount + fine - discount - paidAmount),
    studentName: student?.name ?? null,
    admissionNumber: student?.admissionNumber ?? null,
    fatherName: student?.fatherName ?? null,
    classId: student?.classId ?? null,
    className,
  };
}

/**
 * POST /api/fee-vouchers/generate
 *
 * Bulk-create fee records for all students in a class for a given month.
 * Skips students who already have a fee record for that month.
 *
 * Body:
 * {
 *   classId: number,
 *   month: string,          // "2026-06"
 *   dueDate: string,        // "2026-06-10"
 *   students: [
 *     {
 *       studentId: number,
 *       amount: number,      // total fee for this student
 *       fine: number,
 *       discount: number,
 *       arrears: number,     // per-student arrears added to total
 *       tuitionFee?: number,
 *       examFee?: number,
 *       annualFee?: number,
 *       transportFee?: number,
 *       note: string
 *     }
 *   ]
 * }
 */
router.post("/generate", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { classId, month, dueDate, students } = req.body as {
      classId: number;
      month: string;
      dueDate: string;
      students: Array<{
        studentId: number;
        amount: number;
        fine?: number;
        discount?: number;
        arrears?: number;
        tuitionFee?: number;
        examFee?: number;
        annualFee?: number;
        transportFee?: number;
        note?: string;
      }>;
    };

    if (!classId || !month || !dueDate || !Array.isArray(students) || students.length === 0) {
      res.status(400).json({ error: "classId, month, dueDate and students array are required" });
      return;
    }

    const created: unknown[] = [];
    const skipped: number[] = [];

    for (const s of students) {
      // Check if a fee record already exists for this student+month
      const [existing] = await db
        .select({ id: feesTable.id })
        .from(feesTable)
        .where(and(
          eq(feesTable.studentId, s.studentId),
          eq(feesTable.month, month),
        ));

      if (existing) {
        skipped.push(s.studentId);
        continue;
      }

      // Amount already includes arrears from the frontend calculation
      const totalAmount = Number(s.amount ?? 0);
      const fine       = Number(s.fine     ?? 0);
      const discount   = Number(s.discount ?? 0);

      const [fee] = await db
        .insert(feesTable)
        .values({
          studentId:  s.studentId,
          month,
          dueDate,
          amount:     String(totalAmount),
          fine:       String(fine),
          discount:   String(discount),
          paidAmount: "0",
          status:     "unpaid",
          notes:      s.note ?? null,
          tuitionFee:   String(s.tuitionFee   ?? 0),
          examFee:      String(s.examFee      ?? 0),
          annualFee:    String(s.annualFee    ?? 0),
          transportFee: String(s.transportFee ?? 0),
          arrears:      String(s.arrears      ?? 0),
        } as never)
        .returning();

      const enriched = await enrichFee(fee as unknown as Record<string, unknown>);
      created.push(enriched);
    }

    res.status(201).json({
      created: created.length,
      skipped: skipped.length,
      skippedStudentIds: skipped,
      records: created,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * GET /api/fee-vouchers/preview/:classId
 *
 * Returns fee structure + students for a class to build voucher preview.
 */
router.get("/preview/:classId", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as any).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const classId = Number(req.params.classId);
    const [structure] = await db
      .select()
      .from(feeStructuresTable)
      .where(eq(feeStructuresTable.classId, classId));

    const students = await db
      .select({
        id: studentsTable.id,
        name: studentsTable.name,
        admissionNumber: studentsTable.admissionNumber,
        fatherName: studentsTable.fatherName,
        section: studentsTable.section,
        classId: studentsTable.classId,
      })
      .from(studentsTable)
      .where(and(
        eq(studentsTable.classId, classId),
        eq(studentsTable.status, "active"),
      ));

    const toNum = (v: unknown) => Number(v ?? 0);

    res.json({
      structure: structure ? {
        ...structure,
        monthlyFee:   toNum(structure.monthlyFee),
        admissionFee: toNum(structure.admissionFee),
        examFee:      toNum(structure.examFee),
        libraryFee:   toNum(structure.libraryFee),
        transportFee: toNum(structure.transportFee),
        Arrears:      toNum((structure as Record<string, unknown>).Arrears ?? 0),
      } : null,
      students,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
