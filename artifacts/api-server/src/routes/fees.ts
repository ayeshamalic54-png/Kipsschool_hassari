import { Router } from "express";
import { db } from "@workspace/db";
import { feesTable, studentsTable, classesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

async function enrichFee(fee: Record<string, unknown>) {
  const studentId = Number(fee.studentId);
  const [student] = await db
    .select({ name: studentsTable.name, admissionNumber: studentsTable.admissionNumber, classId: studentsTable.classId })
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
    className,
  };
}

// GET /api/fees
router.get("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    const { studentId, status, month } = req.query;
    const conditions = [];

    if (reqUser.role === "student") {
      const [student] = await db
        .select({ id: studentsTable.id })
        .from(studentsTable)
        .where(eq(studentsTable.username, String(reqUser.username)));
      if (!student) { res.json([]); return; }
      conditions.push(eq(feesTable.studentId, student.id));
    } else if (studentId) {
      conditions.push(eq(feesTable.studentId, Number(studentId)));
    }

    if (status) conditions.push(eq(feesTable.status, String(status) as "paid" | "unpaid" | "partial"));
    if (month) conditions.push(eq(feesTable.month, String(month)));

    const query = db.select().from(feesTable);
    const fees = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;
    const result = await Promise.all(fees.map(f => enrichFee(f as unknown as Record<string, unknown>)));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fees
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const [fee] = await db
      .insert(feesTable)
      .values({ ...req.body, paidAmount: req.body.paidAmount ?? "0", status: req.body.status ?? "unpaid" })
      .returning();
    const enriched = await enrichFee(fee as unknown as Record<string, unknown>);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/fees/:id  ← Admin: edit fee record (amount, month, dueDate, fine, notes)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const feeId = Number(req.params.id);
    const [existing] = await db.select().from(feesTable).where(eq(feesTable.id, feeId));
    if (!existing) { res.status(404).json({ error: "Fee not found" }); return; }
    const { amount, month, dueDate, fine, notes } = req.body;
    const [updated] = await db
      .update(feesTable)
      .set({
        amount:  amount  !== undefined ? String(amount)  : existing.amount,
        month:   month   !== undefined ? String(month)   : existing.month,
        dueDate: dueDate !== undefined ? String(dueDate) : existing.dueDate,
        fine:    fine    !== undefined ? String(fine)    : existing.fine,
        notes:   notes   !== undefined ? String(notes)   : existing.notes,
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

// DELETE /api/fees/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const feeId = Number(req.params.id);
    const [existing] = await db.select().from(feesTable).where(eq(feesTable.id, feeId));
    if (!existing) { res.status(404).json({ error: "Fee not found" }); return; }
    await db.delete(feesTable).where(eq(feesTable.id, feeId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fees/:id/pay
router.post("/:id/pay", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }
    const { paidAmount, discount } = req.body;
    const [existing] = await db.select().from(feesTable).where(eq(feesTable.id, Number(req.params.id)));
    if (!existing) { res.status(404).json({ error: "Fee not found" }); return; }
    const discountAmount = Math.max(0, Number(discount ?? 0));
    const totalAmount = Math.max(0, Number(existing.amount) + Number(existing.fine ?? 0) - discountAmount);
    const newPaid = Math.min(Number(paidAmount), totalAmount);
    const status = newPaid >= totalAmount ? "paid" : newPaid > 0 ? "partial" : "unpaid";
    const [updated] = await db
      .update(feesTable)
      .set({
        paidAmount: String(newPaid),
        discount:   String(discountAmount),
        status,
        paidDate: status === "paid" ? new Date().toISOString().split("T")[0] : null,
      })
      .where(eq(feesTable.id, Number(req.params.id)))
      .returning();
    const enriched = await enrichFee(updated as unknown as Record<string, unknown>);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fees/defaulters
router.get("/defaulters", requireAuth, async (req, res) => {
  try {
    const fees = await db.select().from(feesTable).where(eq(feesTable.status, "unpaid"));
    const result = await Promise.all(fees.map(f => enrichFee(f as unknown as Record<string, unknown>)));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
