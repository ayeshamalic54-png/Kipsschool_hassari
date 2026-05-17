import { Router } from "express";
import { db } from "@workspace/db";
import { salariesTable, staffTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

async function enrichSalary(sal: Record<string, unknown>) {
  const [staff] = await db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, Number(sal.staffId)));
  return { ...sal, amount: Number(sal.amount ?? 0), staffName: staff?.name ?? null };
}

// GET /api/salaries
router.get("/", requireAuth, async (req, res) => {
  try {
    const { staffId, month, status } = req.query;
    const conditions = [];
    if (staffId) conditions.push(eq(salariesTable.staffId, Number(staffId)));
    if (month) conditions.push(eq(salariesTable.month, String(month)));
    if (status) conditions.push(eq(salariesTable.status, String(status)));

    const sals = conditions.length > 0
      ? await db.select().from(salariesTable).where(and(...conditions))
      : await db.select().from(salariesTable);

    const result = await Promise.all(sals.map(s => enrichSalary(s as unknown as Record<string, unknown>)));
    res.json(result);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/salaries
router.post("/", requireAuth, async (req, res) => {
  try {
    const [sal] = await db.insert(salariesTable).values({ ...req.body, status: "unpaid" }).returning();
    const enriched = await enrichSalary(sal as unknown as Record<string, unknown>);
    res.status(201).json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/salaries/:id/pay
router.post("/:id/pay", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(salariesTable).set({
      status: "paid",
      paidDate: new Date().toISOString().split("T")[0],
    }).where(eq(salariesTable.id, Number(req.params.id))).returning();
    if (!updated) {
      res.status(404).json({ error: "Salary record not found" });
      return;
    }
    const enriched = await enrichSalary(updated as unknown as Record<string, unknown>);
    res.json(enriched);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
