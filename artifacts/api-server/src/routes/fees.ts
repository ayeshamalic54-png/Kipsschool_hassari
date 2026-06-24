import { Router } from "express";
import { db } from "@workspace/db";
import { feesTable, studentsTable, classesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();

async function enrichFee(fee: Record<string, unknown>) {
  const studentId = Number(fee.studentId);
  const [student] = await db
    .select({
      name: studentsTable.name,
      admissionNumber: studentsTable.admissionNumber,
      classId: studentsTable.classId,
      fatherName: studentsTable.fatherName,
      status: studentsTable.status,
    })
    .from(studentsTable)
    .where(eq(studentsTable.id, studentId));
  if (!student) return null;
  let className = null;
  if (student.classId) {
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
    studentName: student.name,
    admissionNumber: student.admissionNumber,
    fatherName: student.fatherName ?? null,
    // FIX: include classId so frontend class filter works correctly
    classId: student.classId ?? null,
    className,
    studentStatus: student.status,
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

    const query = db
      .select({
        id: feesTable.id,
        studentId: feesTable.studentId,
        amount: feesTable.amount,
        paidAmount: feesTable.paidAmount,
        month: feesTable.month,
        dueDate: feesTable.dueDate,
        paidDate: feesTable.paidDate,
        status: feesTable.status,
        fine: feesTable.fine,
        discount: feesTable.discount,
        notes: feesTable.notes,
        tuitionFee: feesTable.tuitionFee,
        examFee: feesTable.examFee,
        annualFee: feesTable.annualFee,
        transportFee: feesTable.transportFee,
        arrears: feesTable.arrears,
        studentName: studentsTable.name,
        admissionNumber: studentsTable.admissionNumber,
        fatherName: studentsTable.fatherName,
        classId: studentsTable.classId,
        studentStatus: studentsTable.status,
        className: classesTable.name,
      })
      .from(feesTable)
      .leftJoin(studentsTable, eq(feesTable.studentId, studentsTable.id))
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id));

    const fees = conditions.length > 0
      ? await query.where(and(...conditions))
      : await query;

    const result = fees.map(f => {
      if (!f.studentName) return null; // skip orphans
      const amount = Number(f.amount ?? 0);
      const paidAmount = Number(f.paidAmount ?? 0);
      const fine = Number(f.fine ?? 0);
      const discount = Number(f.discount ?? 0);
      const tuitionFee = Number(f.tuitionFee ?? 0);
      const examFee = Number(f.examFee ?? 0);
      const annualFee = Number(f.annualFee ?? 0);
      const transportFee = Number(f.transportFee ?? 0);
      const arrears = Number(f.arrears ?? 0);
      return {
        ...f,
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
      };
    }).filter(Boolean);

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

// PUT /api/fees/:id  — Admin: edit fee record (amount, month, dueDate, fine, notes)
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
    const { status } = req.query; // 'active' or 'inactive'
    const targetStatus = status === "inactive" ? ["inactive", "left"] : ["active"];

    const defaulters = await db
      .select({
        id: feesTable.id,
        studentId: feesTable.studentId,
        month: feesTable.month,
        amount: feesTable.amount,
        paidAmount: feesTable.paidAmount,
        fine: feesTable.fine,
        discount: feesTable.discount,
        dueDate: feesTable.dueDate,
        notes: feesTable.notes,
        studentName: studentsTable.name,
        admissionNumber: studentsTable.admissionNumber,
        fatherName: studentsTable.fatherName,
        classId: studentsTable.classId,
        studentStatus: studentsTable.status,
        phone: studentsTable.phone,
        className: classesTable.name,
      })
      .from(feesTable)
      .innerJoin(studentsTable, eq(feesTable.studentId, studentsTable.id))
      .leftJoin(classesTable, eq(studentsTable.classId, classesTable.id))
      .where(
        and(
          eq(feesTable.status, "unpaid"),
          inArray(studentsTable.status, targetStatus)
        )
      );

    const result = defaulters.map(f => {
      const amount = Number(f.amount ?? 0);
      const paidAmount = Number(f.paidAmount ?? 0);
      const fine = Number(f.fine ?? 0);
      const discount = Number(f.discount ?? 0);
      return {
        ...f,
        amount,
        paidAmount,
        fine,
        discount,
        remainingAmount: Math.max(0, amount + fine - discount - paidAmount),
        phone: f.phone ?? null,
      };
    });

    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
