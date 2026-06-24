import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable,
  staffTable,
  classesTable,
  feesTable,
  accountEntriesTable,
  salariesTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as any).user;
    if (reqUser.role === "student") { res.status(403).json({ error: "Forbidden" }); return; }

    const now           = new Date();
    const today         = now.toISOString().slice(0, 10);
    const currentMonth  = now.toISOString().slice(0, 7);
    const currentYear   = now.toISOString().slice(0, 4);
    const sevenDaysAgo  = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    // ── Counts ────────────────────────────────────────────────────────────────
    const [{ totalStudents }] = await db
      .select({ totalStudents: sql<number>`count(*)` })
      .from(studentsTable);

    const [{ activeStudents }] = await db
      .select({ activeStudents: sql<number>`count(*)` })
      .from(studentsTable)
      .where(eq(studentsTable.status, "active"));

    const [{ recentAdmissions }] = await db
      .select({ recentAdmissions: sql<number>`count(*)` })
      .from(studentsTable)
      .where(sql`${studentsTable.createdAt} >= ${thirtyDaysAgo}`);

    const [{ defaulterCount }] = await db
      .select({ defaulterCount: sql<number>`count(distinct ${feesTable.studentId})` })
      .from(feesTable)
      .where(sql`${feesTable.status} in ('unpaid','partial')`);

    const [{ totalTeachers }] = await db
      .select({ totalTeachers: sql<number>`count(*)` })
      .from(staffTable)
      .where(and(eq(staffTable.role, "teacher"), eq(staffTable.status, "active")));

    const [{ totalClasses }] = await db
      .select({ totalClasses: sql<number>`count(*)` })
      .from(classesTable);

    // ── Pending fees ──────────────────────────────────────────────────────────
    const unpaidFees = await db
      .select({ amount: feesTable.amount, paidAmount: feesTable.paidAmount })
      .from(feesTable)
      .where(sql`${feesTable.status} in ('unpaid','partial')`);
    const pendingFees = unpaidFees.reduce(
      (s, f) => s + Math.max(0, Number(f.amount ?? 0) - Number(f.paidAmount ?? 0)),
      0,
    );

    // ── Load all data once for period calculations ────────────────────────────
    const allPaidFees = await db
      .select({ paidAmount: feesTable.paidAmount, paidDate: feesTable.paidDate })
      .from(feesTable)
      .where(sql`${feesTable.paidDate} is not null`);

    const allEntries = await db
      .select({
        type:   accountEntriesTable.type,
        amount: accountEntriesTable.amount,
        date:   accountEntriesTable.date,
      })
      .from(accountEntriesTable);

    const allPaidSalaries = await db
      .select({ amount: salariesTable.amount, month: salariesTable.month })
      .from(salariesTable)
      .where(eq(salariesTable.status, "paid"));

    // ── Period calculator ─────────────────────────────────────────────────────
    const calcPeriod = (
      feeDateFilter:   (d: string) => boolean,
      entryDateFilter: (d: string) => boolean,
      salaryFilter:    (m: string) => boolean,
    ) => {
      const feeIncome = allPaidFees
        .filter(f => f.paidDate && feeDateFilter(f.paidDate))
        .reduce((s, f) => s + Number(f.paidAmount ?? 0), 0);

      const otherIncome = allEntries
        .filter(e => e.type === "income" && entryDateFilter(e.date))
        .reduce((s, e) => s + Number(e.amount), 0);

      const otherExpenses = allEntries
        .filter(e => e.type === "expense" && entryDateFilter(e.date))
        .reduce((s, e) => s + Number(e.amount), 0);

      const salaryExpenses = allPaidSalaries
        .filter(s => s.month && salaryFilter(s.month))
        .reduce((s, sal) => s + Number(sal.amount ?? 0), 0);

      const totalIncome   = feeIncome + otherIncome;
      const totalExpenses = otherExpenses + salaryExpenses;
      return {
        feeIncome, otherIncome, otherExpenses, salaryExpenses,
        totalIncome, totalExpenses, netProfit: totalIncome - totalExpenses,
      };
    };

    const periods = {
      today:   calcPeriod(
        d => d === today,
        d => d === today,
        () => false,
      ),
      weekly:  calcPeriod(
        d => d >= sevenDaysAgo,
        d => d >= sevenDaysAgo,
        () => false,
      ),
      monthly: calcPeriod(
        d => d.startsWith(currentMonth),
        d => d.startsWith(currentMonth),
        m => m.startsWith(currentMonth),
      ),
      yearly:  calcPeriod(
        d => d.startsWith(currentYear),
        d => d.startsWith(currentYear),
        m => m.startsWith(currentYear),
      ),
    };

    res.json({
      totalStudents:    Number(totalStudents),
      activeStudents:   Number(activeStudents),
      totalTeachers:    Number(totalTeachers),
      totalClasses:     Number(totalClasses),
      recentAdmissions: Number(recentAdmissions),
      defaulterCount:   Number(defaulterCount),
      pendingFees,
      // Legacy fields
      todayIncome:     periods.today.totalIncome,
      todayExpenses:   periods.today.totalExpenses,
      monthlyIncome:   periods.monthly.totalIncome,
      monthlyExpenses: periods.monthly.totalExpenses,
      netProfit:       periods.monthly.netProfit,
      // Detailed period breakdowns
      periods,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
