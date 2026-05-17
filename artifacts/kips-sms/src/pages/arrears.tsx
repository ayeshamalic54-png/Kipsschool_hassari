import { useListFees, useListStudents } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ClipboardList, Printer, AlertTriangle } from "lucide-react";

interface StudentArrears {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  className: string;
  months: { month: string; amount: number; remaining: number; fine: number }[];
  totalArrears: number;
}

export default function Arrears() {
  const { data: fees, isLoading } = useListFees({});

  const today = new Date().toISOString().slice(0, 10);

  const overdueFees = (fees ?? []).filter(f =>
    (f.status === "unpaid" || f.status === "partial") && f.dueDate < today
  );

  const byStudent: Record<number, StudentArrears> = {};
  for (const f of overdueFees) {
    const sid = f.studentId;
    if (!byStudent[sid]) {
      byStudent[sid] = {
        studentId: sid,
        studentName: f.studentName ?? "—",
        admissionNumber: f.admissionNumber ?? "—",
        className: f.className ?? "—",
        months: [],
        totalArrears: 0,
      };
    }
    const remaining = f.remainingAmount ?? (f.amount - (f.paidAmount ?? 0));
    const fine = f.fine ?? 0;
    byStudent[sid].months.push({ month: f.month, amount: f.amount, remaining, fine });
    byStudent[sid].totalArrears += remaining + fine;
  }

  const arrears = Object.values(byStudent).sort((a, b) => b.totalArrears - a.totalArrears);
  const grandTotal = arrears.reduce((s, a) => s + a.totalArrears, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-orange-600" /> Fee Arrears
          </h1>
          <p className="text-gray-500 text-sm mt-1">Overdue unpaid/partial fees grouped by student</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
      ) : arrears.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <AlertTriangle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No arrears found</p>
            <p className="text-gray-400 text-sm mt-1">All fees are up to date</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3 no-print">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-700 font-medium">{arrears.length} students have overdue fees — Total Arrears: PKR {grandTotal.toLocaleString()}</span>
          </div>

          <div className="space-y-4">
            {arrears.map(s => (
              <Card key={s.studentId} className="overflow-hidden border-l-4" style={{ borderLeftColor: "#e07b1a" }}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{s.studentName}</h3>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono text-purple-600">{s.admissionNumber}</span>
                        <span>{s.className}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Arrears</p>
                      <p className="text-xl font-bold text-red-600">PKR {s.totalArrears.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-gray-500 border-b">
                          <th className="text-left py-1.5 pr-4">Month</th>
                          <th className="text-right pr-4">Fee</th>
                          <th className="text-right pr-4">Remaining</th>
                          <th className="text-right pr-4">Fine</th>
                          <th className="text-right">Total Due</th>
                        </tr>
                      </thead>
                      <tbody>
                        {s.months.map(m => (
                          <tr key={m.month} className="border-b last:border-0">
                            <td className="py-1.5 pr-4 font-medium text-gray-700">{m.month}</td>
                            <td className="py-1.5 pr-4 text-right text-gray-600">PKR {m.amount.toLocaleString()}</td>
                            <td className="py-1.5 pr-4 text-right text-red-600">PKR {m.remaining.toLocaleString()}</td>
                            <td className="py-1.5 pr-4 text-right text-orange-600">{m.fine > 0 ? `PKR ${m.fine.toLocaleString()}` : "—"}</td>
                            <td className="py-1.5 text-right font-semibold text-red-700">PKR {(m.remaining + m.fine).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="border-t pt-4 flex justify-end">
            <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-3 text-right">
              <p className="text-sm text-gray-500">Grand Total Arrears</p>
              <p className="text-2xl font-bold text-red-700">PKR {grandTotal.toLocaleString()}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
