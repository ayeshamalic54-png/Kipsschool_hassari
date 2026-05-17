import { useGetFeeDefaulters } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, AlertTriangle } from "lucide-react";

export default function FeeDefaulters() {
  const { data: defaulters, isLoading } = useGetFeeDefaulters();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-red-500" /> Fee Defaulters
          </h1>
          <p className="text-gray-500 text-sm mt-1">Students with unpaid fees</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} data-testid="button-print-defaulters">
          <Printer className="w-4 h-4 mr-1" /> Print Report
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : !defaulters?.length ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg font-medium text-emerald-600">No defaulters!</p>
              <p className="text-sm mt-1">All fees are cleared</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-red-50">
                  <tr>
                    {["#", "Student Name", "Adm#", "Class", "Month", "Amount Due", "Fine", "Due Date"].map(h => (
                      <th key={h} className="text-left py-3 px-3 font-semibold text-red-700">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {defaulters?.map((fee, i) => (
                    <tr key={fee.id} className="border-b hover:bg-red-50/50" data-testid={`row-defaulter-${fee.id}`}>
                      <td className="py-3 px-3 text-gray-500">{i + 1}</td>
                      <td className="py-3 px-3 font-medium text-gray-900">{fee.studentName || "—"}</td>
                      <td className="py-3 px-3 text-xs font-mono text-purple-600">{fee.admissionNumber || "—"}</td>
                      <td className="py-3 px-3 text-gray-600">{fee.className || "—"}</td>
                      <td className="py-3 px-3 text-gray-600">{fee.month}</td>
                      <td className="py-3 px-3 font-bold text-red-600">PKR {fee.amount.toLocaleString()}</td>
                      <td className="py-3 px-3 text-orange-600">{(fee.fine ?? 0) > 0 ? `PKR ${(fee.fine ?? 0).toLocaleString()}` : "—"}</td>
                      <td className="py-3 px-3 text-gray-500">{fee.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 font-bold text-gray-700">Total Pending</td>
                    <td className="py-3 px-3 font-bold text-red-600">
                      PKR {defaulters?.reduce((sum, f) => sum + (f.amount ?? 0), 0).toLocaleString()}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
