import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, DollarSign, AlertTriangle, CalendarCheck, FileText, Wallet, TrendingDown, Award, FileBarChart } from "lucide-react";

const reports = [
  { title: "Student Report", description: "All student admissions and status", icon: Users, color: "from-blue-500 to-cyan-500", href: "/students" },
  { title: "Fee Report", description: "Complete fee collection report", icon: CreditCard, color: "from-emerald-500 to-green-500", href: "/fees" },
  { title: "Fee Defaulters", description: "List of students with unpaid fees", icon: AlertTriangle, color: "from-red-500 to-rose-500", href: "/fees/defaulters" },
  { title: "Attendance Report", description: "Daily/monthly attendance records", icon: CalendarCheck, color: "from-amber-400 to-orange-500", href: "/attendance" },
  { title: "Exam Results", description: "Exam and marks entry records", icon: FileText, color: "from-violet-500 to-fuchsia-500", href: "/exams" },
  { title: "Salary Report", description: "Staff salary payment records", icon: Wallet, color: "from-cyan-500 to-blue-600", href: "/salaries" },
  { title: "Income Report", description: "Monthly income breakdown", icon: DollarSign, color: "from-teal-500 to-emerald-500", href: "/accounts" },
  { title: "Expense Report", description: "Monthly expense breakdown", icon: TrendingDown, color: "from-rose-500 to-pink-500", href: "/accounts" },
  { title: "Certificate Records", description: "All issued certificates", icon: Award, color: "from-yellow-400 to-amber-500", href: "/certificates" },
];

export default function Reports() {
  const [, setLocation] = useLocation();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileBarChart className="w-6 h-6 text-slate-600" /> Reports
        </h1>
        <p className="text-gray-500 text-sm mt-1">Access all printable reports and documents</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Print Tip:</strong> Navigate to any report page and click the Print button, or use Ctrl+P / Cmd+P. All reports are optimized for printing with clean, professional layouts.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(report => (
          <Card
            key={report.title}
            className="hover:shadow-md transition-all cursor-pointer group"
            onClick={() => setLocation(report.href)}
            data-testid={`card-report-${report.title.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${report.color} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform`}>
                  <report.icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 group-hover:text-purple-700 transition-colors">{report.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">{report.description}</p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" variant="outline" className="text-xs group-hover:bg-purple-50 group-hover:border-purple-200 group-hover:text-purple-700 transition-colors">
                  View Report
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
