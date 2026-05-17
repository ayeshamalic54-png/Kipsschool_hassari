import { Router } from "express";
import { db } from "@workspace/db";
import { studentsTable, staffTable, feesTable, accountEntriesTable, classesTable } from "@workspace/db";
import { eq, sql, and, like } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router = Router();

// GET /api/dashboard/stats
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const today = now.toISOString().slice(0, 10);

    const [activeStudents] = await db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(eq(studentsTable.status, "active"));
    const [totalStudents] = await db.select({ count: sql<number>`count(*)` }).from(studentsTable);
    const [teacherCount] = await db.select({ count: sql<number>`count(*)` }).from(staffTable).where(and(eq(staffTable.status, "active"), eq(staffTable.role, "teacher")));
    const [classCount] = await db.select({ count: sql<number>`count(*)` }).from(classesTable);

    // Monthly figures
    const [incomeRow] = await db.select({ amount: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(eq(accountEntriesTable.type, "income"), like(accountEntriesTable.date, `${currentMonth}%`)));
    const [expenseRow] = await db.select({ amount: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(eq(accountEntriesTable.type, "expense"), like(accountEntriesTable.date, `${currentMonth}%`)));

    // Today's figures
    const [todayIncomeRow] = await db.select({ amount: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(eq(accountEntriesTable.type, "income"), eq(accountEntriesTable.date, today)));
    const [todayExpenseRow] = await db.select({ amount: sql<number>`coalesce(sum(amount), 0)` }).from(accountEntriesTable).where(and(eq(accountEntriesTable.type, "expense"), eq(accountEntriesTable.date, today)));
    const [todayFeesPaid] = await db.select({ count: sql<number>`count(*)` }).from(feesTable).where(eq(feesTable.paidDate, today));
    const [todayFeeAmount] = await db.select({ amount: sql<number>`coalesce(sum(paid_amount), 0)` }).from(feesTable).where(eq(feesTable.paidDate, today));

    const [unpaidFees] = await db.select({ total: sql<number>`coalesce(sum(amount - paid_amount), 0)` }).from(feesTable).where(sql`status != 'paid'`);
    const [defaulters] = await db.select({ count: sql<number>`count(distinct student_id)` }).from(feesTable).where(eq(feesTable.status, "unpaid"));

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const [recentAdmissions] = await db.select({ count: sql<number>`count(*)` }).from(studentsTable).where(sql`created_at >= ${thirtyDaysAgo.toISOString()}`);

    const monthlyIncome = Number(incomeRow?.amount ?? 0);
    const monthlyExpenses = Number(expenseRow?.amount ?? 0);

    res.json({
      totalStudents: Number(totalStudents.count),
      activeStudents: Number(activeStudents.count),
      totalTeachers: Number(teacherCount.count),
      totalClasses: Number(classCount.count),
      monthlyIncome,
      monthlyExpenses,
      netProfit: monthlyIncome - monthlyExpenses,
      pendingFees: Number(unpaidFees?.total ?? 0),
      defaulterCount: Number(defaulters?.count ?? 0),
      recentAdmissions: Number(recentAdmissions?.count ?? 0),
      todayIncome: Number(todayIncomeRow?.amount ?? 0),
      todayExpenses: Number(todayExpenseRow?.amount ?? 0),
      todayFeesPaidCount: Number(todayFeesPaid?.count ?? 0),
      todayFeeAmount: Number(todayFeeAmount?.amount ?? 0),
      currentMonth,
      today,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
