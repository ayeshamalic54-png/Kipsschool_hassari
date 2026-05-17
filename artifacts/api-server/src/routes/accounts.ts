import { Router } from "express";
import { db } from "@workspace/db";
import { accountEntriesTable } from "@workspace/db";
import { eq, and, like, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/accounts/income
router.get("/income", requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const conditions = [eq(accountEntriesTable.type, "income")];
    if (month) conditions.push(like(accountEntriesTable.date, `${month}%`));
    const entries = await db.select().from(accountEntriesTable).where(and(...conditions));
    res.json(entries.map(e => ({ ...e, amount: Number(e.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/accounts/income
router.post("/income", requireAuth, async (req, res) => {
  try {
    const [entry] = await db.insert(accountEntriesTable).values({ ...req.body, type: "income" }).returning();
    res.status(201).json({ ...entry, amount: Number(entry.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/accounts/expenses
router.get("/expenses", requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const conditions = [eq(accountEntriesTable.type, "expense")];
    if (month) conditions.push(like(accountEntriesTable.date, `${month}%`));
    const entries = await db.select().from(accountEntriesTable).where(and(...conditions));
    res.json(entries.map(e => ({ ...e, amount: Number(e.amount) })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/accounts/expenses
router.post("/expenses", requireAuth, async (req, res) => {
  try {
    const [entry] = await db.insert(accountEntriesTable).values({ ...req.body, type: "expense" }).returning();
    res.status(201).json({ ...entry, amount: Number(entry.amount) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/accounts/summary
router.get("/summary", requireAuth, async (req, res) => {
  try {
    const { month } = req.query;
    const incomeConditions = [eq(accountEntriesTable.type, "income")];
    const expenseConditions = [eq(accountEntriesTable.type, "expense")];
    if (month) {
      incomeConditions.push(like(accountEntriesTable.date, `${month}%`));
      expenseConditions.push(like(accountEntriesTable.date, `${month}%`));
    }

    const [income] = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(...incomeConditions));
    const [expense] = await db.select({ total: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(...expenseConditions));

    const totalIncome = Number(income?.total ?? 0);
    const totalExpenses = Number(expense?.total ?? 0);
    res.json({ totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses, month: month ?? null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
