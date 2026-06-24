import { useState } from "react";
import { useGetDashboardStats, useListFees, useListAttendance } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import {
  Users, GraduationCap, TrendingUp, TrendingDown, DollarSign,
  AlertTriangle, UserPlus, BookOpen, CalendarDays, Banknote,
  ReceiptText, Clock, CheckCircle, XCircle, CreditCard, FileText,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";

type Period = "today" | "weekly" | "monthly" | "yearly";

const fmt = (v: number | undefined, isCurrency?: boolean) => {
  if (v === undefined || v === null) return "—";
  return isCurrency ? `PKR ${v.toLocaleString()}` : v.toLocaleString();
};

const getCleanMonth = (m: string) => {
  const match = m.match(/\d{4}-\d{2}/);
  return match ? match[0] : m;
};

// ── Student Dashboard ────────────────────────────────────────────────────────
function StudentDashboard({ name }: { name: string }) {
  const { data: fees,       isLoading: feesLoading } = useListFees({});
  const { data: attendance, isLoading: attLoading  } = useListAttendance({ type: "student" });

  const today = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Calculate unique months and categorize them
  const uniqueMonths = Array.from(new Set((fees ?? []).map(f => getCleanMonth(f.month))));
  let paidMonthsCount = 0;
  let pendingMonthsCount = 0;

  uniqueMonths.forEach(m => {
    const monthFees = (fees ?? []).filter(f => getCleanMonth(f.month) === m);
    const allPaid = monthFees.every(f => f.status === "paid");
    if (allPaid) {
      paidMonthsCount++;
    } else {
      pendingMonthsCount++;
    }
  });

  const unpaidFees  = (fees ?? []).filter(f => f.status === "unpaid");
  const partialFees = (fees ?? []).filter(f => f.status === "partial");
  const totalDue    = [...unpaidFees, ...partialFees].reduce((s, f) => s + (f.remainingAmount ?? 0), 0);

  const allAtt  = attendance ?? [];
  const present = allAtt.filter(a => a.status === "present").length;
  const absent  = allAtt.filter(a => a.status === "absent").length;
  const late    = allAtt.filter(a => a.status === "late").length;

  return (
    <div className="space-y-7">
      <motion.div
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl bg-gradient-to-r from-[#1a2a5e] to-[#2e4a9e] p-6 text-white shadow"
      >
        <p className="text-white/60 text-xs uppercase tracking-widest mb-1 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" />{today}
        </p>
        <h1 className="text-2xl font-bold">Welcome, {name}</h1>
        <p className="text-white/70 text-sm mt-1">KIPS School Hassari — Student Portal</p>
      </motion.div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> My Fee Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Fees",  value: uniqueMonths.length,                   icon: FileText,      gradient: "from-blue-500 to-cyan-500",       isCurrency: false, suffix: " Months" },
            { label: "Paid",        value: paidMonthsCount,                        icon: CheckCircle,   gradient: "from-emerald-500 to-green-500",   isCurrency: false, suffix: " Months" },
            { label: "Pending",     value: pendingMonthsCount,                     icon: XCircle,       gradient: "from-red-500 to-rose-600",         isCurrency: false, suffix: " Months" },
            { label: "Amount Due",  value: totalDue,                               icon: AlertTriangle, gradient: "from-orange-500 to-amber-500",     isCurrency: true,  suffix: "" },
          ].map(card => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                        {feesLoading
                          ? <Skeleton className="h-6 w-20 mt-1 bg-white/30" />
                          : <p className="text-white text-2xl font-bold mt-1">
                              {card.isCurrency ? `PKR ${(card.value as number).toLocaleString()}` : `${card.value}${card.suffix}`}
                            </p>
                        }
                      </div>
                      <div className="bg-white/20 rounded-xl p-2">
                        <card.icon className="w-6 h-6 text-white" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> My Attendance
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Present", value: present, icon: CheckCircle, gradient: "from-emerald-500 to-teal-500"  },
            { label: "Absent",  value: absent,  icon: XCircle,     gradient: "from-red-500 to-rose-600"      },
            { label: "Late",    value: late,    icon: Clock,        gradient: "from-amber-400 to-orange-500"  },
          ].map(card => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                        {attLoading
                          ? <Skeleton className="h-6 w-16 mt-1 bg-white/30" />
                          : <p className="text-white text-2xl font-bold mt-1">{card.value} Days</p>
                        }
                      </div>
                      <div className="bg-white/20 rounded-xl p-2"><card.icon className="w-6 h-6 text-white" /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {!feesLoading && (fees?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-blue-600" /> My Fee Records
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Month","Amount","Paid","Remaining","Status","Due Date"].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 font-semibold text-gray-600 text-xs">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {fees?.map(f => (
                    <tr key={f.id} className="border-t hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-medium text-gray-800">{f.month}</td>
                      <td className="py-2.5 px-4">PKR {f.amount.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-emerald-600">PKR {(f.paidAmount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-red-600">PKR {(f.remainingAmount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          f.status === "paid"    ? "bg-emerald-100 text-emerald-700" :
                          f.status === "partial" ? "bg-amber-100 text-amber-700" :
                                                   "bg-red-100 text-red-700"}`}>
                          {f.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-gray-500">{f.dueDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: allFees, isLoading: feesLoading } = useListFees({});
  const [period, setPeriod] = useState<Period>("monthly");

  const todayStr     = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const currentYear  = new Date().toISOString().slice(0, 4);
  const todayLabel   = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const monthLabel   = new Date().toLocaleDateString("en-PK", { month: "long", year: "numeric" });

  // ── Today receipts (from fee records) ──
  const todayPaidFees     = (allFees ?? []).filter(f => f.paidDate?.startsWith(todayStr));
  const todayFeeAmount    = todayPaidFees.reduce((s, f) => s + (f.paidAmount ?? 0), 0);
  const todayReceiptCount = todayPaidFees.length;

  // ── Pending fees ──
  const pendingFees = (allFees ?? [])
    .filter(f => f.status === "unpaid" || f.status === "partial")
    .reduce((s, f) => s + (f.remainingAmount ?? 0), 0);

  // ── Period data from backend ──
  type PeriodData = {
    feeIncome: number; otherIncome: number; otherExpenses: number;
    salaryExpenses: number; totalIncome: number; totalExpenses: number; netProfit: number;
  };
  const emptyPeriod: PeriodData = {
    feeIncome: 0, otherIncome: 0, otherExpenses: 0,
    salaryExpenses: 0, totalIncome: 0, totalExpenses: 0, netProfit: 0,
  };
  const periods = (stats as { periods?: Record<Period, PeriodData> } | undefined)?.periods;
  const pd = periods?.[period] ?? emptyPeriod;

  // Supplement today feeIncome from live fee records (more accurate)
  const livePd: PeriodData = period === "today"
    ? { ...pd, feeIncome: Math.max(pd.feeIncome, todayFeeAmount), totalIncome: Math.max(pd.feeIncome, todayFeeAmount) + pd.otherIncome }
    : period === "monthly"
    ? (() => {
        const liveFeeIncome = Math.max(
          pd.feeIncome,
          (allFees ?? []).filter(f => f.paidDate?.startsWith(currentMonth)).reduce((s, f) => s + (f.paidAmount ?? 0), 0),
        );
        return { ...pd, feeIncome: liveFeeIncome, totalIncome: liveFeeIncome + pd.otherIncome, netProfit: liveFeeIncome + pd.otherIncome - pd.totalExpenses };
      })()
    : pd;

  const periodLabels: Record<Period, string> = {
    today:   "Today",
    weekly:  "This Week",
    monthly: monthLabel,
    yearly:  `Year ${currentYear}`,
  };

  const periodBtns: { key: Period; label: string }[] = [
    { key: "today",   label: "Today"    },
    { key: "weekly",  label: "Weekly"   },
    { key: "monthly", label: "Monthly"  },
    { key: "yearly",  label: "Yearly"   },
  ];

  const loading = isLoading || feesLoading;

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-1.5">
          <CalendarDays className="w-3.5 h-3.5" /> {todayLabel}
        </p>
      </div>

      {/* School Overview */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> School Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Students",  value: stats?.totalStudents,   icon: GraduationCap, gradient: "from-pink-500 to-rose-500"      },
            { label: "Total Teachers",  value: stats?.totalTeachers,   icon: Users,         gradient: "from-blue-500 to-cyan-500"      },
            { label: "Total Classes",   value: stats?.totalClasses,    icon: BookOpen,      gradient: "from-indigo-500 to-purple-500"  },
            { label: "Fee Defaulters",  value: stats?.defaulterCount,  icon: AlertTriangle, gradient: "from-amber-400 to-orange-500"   },
          ].map(card => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                        {loading
                          ? <Skeleton className="h-7 w-20 mt-1 bg-white/30" />
                          : <p className="text-white text-2xl font-bold mt-1">{fmt(card.value as number)}</p>
                        }
                      </div>
                      <div className="bg-white/20 rounded-xl p-2"><card.icon className="w-6 h-6 text-white" /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Today Quick Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Today's Activity
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Fees Collected",   value: todayFeeAmount,    icon: ReceiptText, gradient: "from-emerald-500 to-teal-500",  isCurrency: true  },
            { label: "Pending Fees",     value: pendingFees,       icon: AlertTriangle, gradient: "from-amber-500 to-orange-500", isCurrency: true },
            { label: "Other Expenses",   value: (periods?.today?.otherExpenses ?? 0), icon: TrendingDown, gradient: "from-red-500 to-rose-600", isCurrency: true },
            { label: "Receipts Today",   value: todayReceiptCount, icon: FileText,    gradient: "from-violet-500 to-purple-600", isCurrency: false },
          ].map(card => (
            <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                        {loading
                          ? <Skeleton className="h-6 w-20 mt-1 bg-white/30" />
                          : <p className="text-white text-xl font-bold mt-1">
                              {card.isCurrency ? `PKR ${(card.value ?? 0).toLocaleString()}` : (card.value ?? 0).toLocaleString()}
                            </p>
                        }
                      </div>
                      <div className="bg-white/20 rounded-xl p-2"><card.icon className="w-5 h-5 text-white" /></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Financial Summary with Period Selector */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Financial Summary
          </h2>
          {/* Period selector */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
            {periodBtns.map(btn => (
              <button
                key={btn.key}
                onClick={() => setPeriod(btn.key)}
                className={`px-4 py-1.5 text-xs font-semibold transition-all ${
                  period === btn.key
                    ? "bg-[#1a2a5e] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Financial Cards: Income row + Expenses row */}
        <div className="space-y-3">
          {/* Income row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Fee Income",    value: livePd.feeIncome,   icon: CreditCard,  gradient: "from-blue-600 to-cyan-500"      },
              { label: "Other Income",  value: livePd.otherIncome, icon: TrendingUp,  gradient: "from-teal-500 to-emerald-400"   },
              { label: "Total Income",  value: livePd.totalIncome, icon: Banknote,    gradient: "from-emerald-600 to-green-500"  },
            ].map(card => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="overflow-hidden border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                          {loading
                            ? <Skeleton className="h-6 w-20 mt-1 bg-white/30" />
                            : <p className="text-white text-xl font-bold mt-1">PKR {card.value.toLocaleString()}</p>
                          }
                        </div>
                        <div className="bg-white/20 rounded-xl p-2"><card.icon className="w-5 h-5 text-white" /></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Expenses row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Salary Expenses", value: livePd.salaryExpenses, icon: Users,        gradient: "from-orange-500 to-amber-400"  },
              { label: "Other Expenses",  value: livePd.otherExpenses,  icon: TrendingDown, gradient: "from-red-400 to-rose-500"      },
              { label: "Total Expenses",  value: livePd.totalExpenses,  icon: AlertTriangle, gradient: "from-red-600 to-rose-600"     },
            ].map(card => (
              <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <Card className="overflow-hidden border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                          {loading
                            ? <Skeleton className="h-6 w-20 mt-1 bg-white/30" />
                            : <p className="text-white text-xl font-bold mt-1">PKR {card.value.toLocaleString()}</p>
                          }
                        </div>
                        <div className="bg-white/20 rounded-xl p-2"><card.icon className="w-5 h-5 text-white" /></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Net Profit banner */}
          {!loading && (
            <div className={`rounded-xl p-5 flex items-center justify-between shadow-sm ${
              livePd.netProfit >= 0
                ? "bg-gradient-to-r from-violet-600 to-purple-600"
                : "bg-gradient-to-r from-gray-700 to-gray-800"
            }`}>
              <div>
                <p className="text-white/70 text-xs font-semibold uppercase tracking-wide mb-1">Net Profit — {periodLabels[period]}</p>
                <p className="text-white/60 text-xs">
                  Fee Income PKR {livePd.feeIncome.toLocaleString()}
                  {" + "}Other PKR {livePd.otherIncome.toLocaleString()}
                  {" − "}Salaries PKR {livePd.salaryExpenses.toLocaleString()}
                  {" − "}Other Exp PKR {livePd.otherExpenses.toLocaleString()}
                </p>
              </div>
              <p className="text-white text-3xl font-black">
                PKR {livePd.netProfit.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Pending Fees + Recent Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="border border-amber-200 bg-amber-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Pending Fees</p>
              {loading
                ? <Skeleton className="h-7 w-28 mt-1" />
                : <p className="text-2xl font-black text-amber-800">PKR {pendingFees.toLocaleString()}</p>
              }
              <p className="text-xs text-amber-600 mt-0.5">{stats?.defaulterCount ?? "—"} defaulters</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-teal-200 bg-teal-50">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500 flex items-center justify-center shrink-0">
              <UserPlus className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-teal-700 uppercase tracking-wide">New Admissions</p>
              {loading
                ? <Skeleton className="h-7 w-16 mt-1" />
                : <p className="text-2xl font-black text-teal-800">{stats?.recentAdmissions ?? "—"}</p>
              }
              <p className="text-xs text-teal-600 mt-0.5">In the last 30 days</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const user = useAuthStore(s => s.user);
  if (user?.role === "student") return <StudentDashboard name={user.name ?? "Student"} />;
  return <AdminDashboard />;
}