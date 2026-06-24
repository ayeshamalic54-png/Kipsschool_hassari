import { Router } from "express";
import { db } from "@workspace/db";
import { feesTable, studentsTable, classesTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: { id: number; role: string } };

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
  return {
    ...fee,
    amount,
    paidAmount,
    fine,
    discount,
    remainingAmount: Math.max(0, amount + fine - discount - paidAmount),
    studentName: student?.name ?? null,
    admissionNumber: student?.admissionNumber ?? null,
    fatherName: student?.fatherName ?? null,
    classId: student?.classId ?? null,
    className,
  };
}

/**
 * GET /api/arrears
 * Returns all overdue (unpaid or partial) fee records where dueDate < today.
 * Grouped info is computed on the frontend; this just returns the raw records.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const today = new Date().toISOString().split("T")[0];

    // Get all unpaid/partial fees
    const fees = await db
      .select()
      .from(feesTable)
      .where(
        and(
          lt(feesTable.dueDate, today),
        )
      );

    // Filter unpaid or partial in memory (status enum may vary)
    const overdue = fees.filter(
      f => f.status === "unpaid" || f.status === "partial"
    );

    const result = await Promise.all(
      overdue.map(f => enrichFee(f as unknown as Record<string, unknown>))
    );

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * POST /api/arrears
 * Manually add an arrear (creates a fee record marked as unpaid with a past due date).
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { studentId, amount, fine, month, dueDate, notes } = req.body;
    if (!studentId || !amount || !month || !dueDate) {
      res.status(400).json({ error: "studentId, amount, month and dueDate are required" });
      return;
    }

    const [fee] = await db
      .insert(feesTable)
      .values({
        studentId: Number(studentId),
        amount:    String(amount),
        fine:      String(fine ?? 0),
        month:     String(month),
        dueDate:   String(dueDate),
        paidAmount: "0",
        status:    "unpaid",
        notes:     notes ?? null,
      } as never)
      .returning();

    const enriched = await enrichFee(fee as unknown as Record<string, unknown>);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * PUT /api/arrears/:id
 * Edit an existing arrear record.
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const feeId = Number(req.params.id);
    const [existing] = await db.select().from(feesTable).where(eq(feesTable.id, feeId));
    if (!existing) { res.status(404).json({ error: "Arrear not found" }); return; }

    const { amount, fine, month, dueDate, notes } = req.body;

    const [updated] = await db
      .update(feesTable)
      .set({
        amount:  amount  !== undefined ? String(amount)  : existing.amount,
        fine:    fine    !== undefined ? String(fine)    : existing.fine,
        month:   month   !== undefined ? String(month)   : existing.month,
        dueDate: dueDate !== undefined ? String(dueDate) : existing.dueDate,
        notes:   notes   !== undefined ? notes           : existing.notes,
      })
      .where(eq(feesTable.id, feeId))
      .returning();

    const enriched = await enrichFee(updated as unknown as Record<string, unknown>);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

/**
 * DELETE /api/arrears/:id
 * Delete an arrear record.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const feeId = Number(req.params.id);
    const [existing] = await db.select().from(feesTable).where(eq(feesTable.id, feeId));
    if (!existing) { res.status(404).json({ error: "Arrear not found" }); return; }

    await db.delete(feesTable).where(eq(feesTable.id, feeId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
