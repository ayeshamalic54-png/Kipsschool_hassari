import { useGetDashboardStats, useListFees, useListAttendance } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { Users, GraduationCap, TrendingUp, TrendingDown, DollarSign, AlertTriangle, UserPlus, BookOpen, CalendarDays, Banknote, ReceiptText, Clock, CheckCircle, XCircle, CreditCard, FileText } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

const fmt = (v: number | undefined, isCurrency?: boolean) => {
  if (v === undefined) return "—";
  return isCurrency ? `PKR ${v.toLocaleString()}` : v.toLocaleString();
};

function StudentDashboard({ name }: { name: string }) {
  const { data: fees, isLoading: feesLoading } = useListFees({});
  const { data: attendance, isLoading: attLoading } = useListAttendance({});

  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const paidFees   = (fees ?? []).filter(f => f.status === "paid");
  const unpaidFees = (fees ?? []).filter(f => f.status === "unpaid");
  const partialFees= (fees ?? []).filter(f => f.status === "partial");
  const totalDue   = [...unpaidFees, ...partialFees].reduce((s, f) => s + (f.remainingAmount ?? 0), 0);
  const totalPaid  = paidFees.reduce((s, f) => s + (f.paidAmount ?? 0), 0);

  const monthAtt  = (attendance ?? []).filter(a => a.date?.startsWith(currentMonth));
  const allAtt    = attendance ?? [];
  const present   = allAtt.filter(a => a.status === "present").length;
  const absent    = allAtt.filter(a => a.status === "absent").length;
  const late      = allAtt.filter(a => a.status === "late").length;

  return (
    <div className="space-y-7">
      {/* Welcome banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-gradient-to-r from-[#1a2a5e] to-[#2e4a9e] p-6 text-white shadow">
        <p className="text-white/60 text-xs uppercase tracking-widest mb-1 flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5" />{today}</p>
        <h1 className="text-2xl font-bold">Welcome, {name}</h1>
        <p className="text-white/70 text-sm mt-1">KIPS School Hassari — Student Portal</p>
      </motion.div>

      {/* Fee Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CreditCard className="w-4 h-4" /> My Fee Summary
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Fees",  value: fees?.length ?? 0,                      icon: FileText,     gradient: "from-blue-500 to-cyan-500",      isCurrency: false, suffix: " months" },
            { label: "Paid",        value: paidFees.length,                         icon: CheckCircle,  gradient: "from-emerald-500 to-green-500",   isCurrency: false, suffix: " months" },
            { label: "Pending",     value: unpaidFees.length + partialFees.length,  icon: XCircle,      gradient: "from-red-500 to-rose-600",         isCurrency: false, suffix: " months" },
            { label: "Amount Due",  value: totalDue,                                icon: AlertTriangle,gradient: "from-orange-500 to-amber-500",     isCurrency: true,  suffix: "" },
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

      {/* Attendance Summary */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> My Attendance
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Present", value: present, icon: CheckCircle, gradient: "from-emerald-500 to-teal-500" },
            { label: "Absent",  value: absent,  icon: XCircle,     gradient: "from-red-500 to-rose-600" },
            { label: "Late",    value: late,    icon: Clock,        gradient: "from-amber-400 to-orange-500" },
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
                          : <p className="text-white text-2xl font-bold mt-1">{card.value} days</p>
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

      {/* Fee detail table */}
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
                    {["Month", "Amount", "Paid", "Remaining", "Status", "Due Date"].map(h => (
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
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${f.status === "paid" ? "bg-emerald-100 text-emerald-700" : f.status === "partial" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
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

const monthlyCards = [
  { key: "totalStudents",   label: "Total Students",   icon: GraduationCap, gradient: "from-pink-500 to-rose-500" },
  { key: "totalTeachers",   label: "Total Teachers",   icon: Users,         gradient: "from-blue-500 to-cyan-500" },
  { key: "monthlyIncome",   label: "Monthly Income",   icon: TrendingUp,    gradient: "from-emerald-500 to-green-500",   isCurrency: true },
  { key: "monthlyExpenses", label: "Monthly Expenses", icon: TrendingDown,  gradient: "from-orange-500 to-amber-500",    isCurrency: true },
  { key: "netProfit",       label: "Net Profit",       icon: DollarSign,    gradient: "from-violet-500 to-purple-600",   isCurrency: true },
  { key: "pendingFees",     label: "Pending Fees",     icon: AlertTriangle, gradient: "from-red-500 to-rose-600",        isCurrency: true },
  { key: "defaulterCount",  label: "Fee Defaulters",   icon: AlertTriangle, gradient: "from-amber-400 to-orange-500" },
  { key: "recentAdmissions",label: "New (30 days)",    icon: UserPlus,      gradient: "from-teal-400 to-emerald-500" },
];

function AdminDashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const today = new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const monthLabel = new Date().toLocaleDateString("en-PK", { month: "long", year: "numeric" });

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" /> {today}
          </p>
        </div>
      </div>

      {/* Today's Activity */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4" /> Today's Activity
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Today's Income",   key: "todayIncome",        icon: Banknote,     color: "border-l-emerald-500", isCurrency: true },
            { label: "Today's Expenses", key: "todayExpenses",      icon: TrendingDown, color: "border-l-red-500",     isCurrency: true },
            { label: "Fees Collected",   key: "todayFeeAmount",     icon: ReceiptText,  color: "border-l-blue-500",    isCurrency: true },
            { label: "Receipts Today",   key: "todayFeesPaidCount", icon: BookOpen,     color: "border-l-purple-500" },
          ].map(card => (
            <motion.div key={card.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
              <Card className={`border-l-4 ${card.color} shadow-sm`}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-500">{card.label}</p>
                    <card.icon className="w-4 h-4 text-gray-400" />
                  </div>
                  {isLoading
                    ? <Skeleton className="h-6 w-20 mt-1" />
                    : <p className="text-xl font-bold text-gray-900">{fmt(stats?.[card.key as keyof typeof stats] as number, card.isCurrency)}</p>
                  }
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Monthly Stats */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <CalendarDays className="w-4 h-4" /> {monthLabel} — Monthly Overview
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {monthlyCards.map((card, i) => {
            const value = stats ? stats[card.key as keyof typeof stats] as number : undefined;
            return (
              <motion.div key={card.key} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.04 }}>
                <Card className="overflow-hidden border-0 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                          {isLoading
                            ? <Skeleton className="h-7 w-24 mt-1 bg-white/30" />
                            : <p className="text-white text-2xl font-bold mt-1">{fmt(value, (card as { isCurrency?: boolean }).isCurrency)}</p>
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
            );
          })}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" /> School Overview
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Active Students",  value: stats?.activeStudents,  color: "bg-blue-500" },
                  { label: "Total Classes",    value: stats?.totalClasses,    color: "bg-purple-500" },
                  { label: "Total Teachers",   value: stats?.totalTeachers,   color: "bg-emerald-500" },
                  { label: "Fee Defaulters",   value: `${stats?.defaulterCount ?? "—"} students`, color: "bg-red-500" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 ${item.color} rounded-full`} />
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-600" /> Financial Summary — {monthLabel}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Monthly Income",   value: stats?.monthlyIncome,   color: "bg-emerald-500" },
                  { label: "Monthly Expenses", value: stats?.monthlyExpenses, color: "bg-red-500" },
                  { label: "Net Profit",       value: stats?.netProfit,       color: "bg-violet-500" },
                  { label: "Pending Fees",     value: stats?.pendingFees,     color: "bg-amber-500" },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-1.5 h-8 ${item.color} rounded-full`} />
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                    </div>
                    <span className="text-lg font-bold text-gray-900">PKR {(item.value ?? 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user);
  if (user?.role === "student") return <StudentDashboard name={user.name ?? "Student"} />;
  return <AdminDashboard />;
}
