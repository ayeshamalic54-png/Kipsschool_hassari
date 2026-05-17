import { useState } from "react";
import { useListStudents, useListClasses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ReceiptText, Printer } from "lucide-react";

export default function FeeVoucher() {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(10);
    return d.toISOString().slice(0, 10);
  });
  const [generated, setGenerated] = useState(false);

  const { data: classes } = useListClasses();
  const { data: allStudents } = useListStudents({});

  const classStudents = allStudents?.filter(s => String(s.classId) === selectedClass && s.status === "active") ?? [];
  const selectedClassName = classes?.find(c => String(c.id) === selectedClass)?.name ?? "";

  const voucherDate = new Date().toLocaleDateString("en-PK", { dateStyle: "long" });
  const monthLabel = month ? new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" }) : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-teal-600" /> Fee Voucher — By Class
          </h1>
          <p className="text-gray-500 text-sm mt-1">Generate printable fee vouchers for all students in a class</p>
        </div>
      </div>

      <Card className="no-print">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Select Class</label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger><SelectValue placeholder="Choose class..." /></SelectTrigger>
                <SelectContent>
                  {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Month</label>
              <Input type="month" value={month} onChange={e => setMonth(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button
              disabled={!selectedClass || !month}
              onClick={() => setGenerated(true)}
              style={{ background: "linear-gradient(135deg, #1a2a5e, #2d4a9a)", color: "#fff" }}
            >
              Generate Vouchers ({classStudents.length} students)
            </Button>
            {generated && classStudents.length > 0 && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Print All Vouchers
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && classStudents.length === 0 && (
        <p className="text-center text-gray-500 py-12">No active students found in this class.</p>
      )}

      {generated && classStudents.length > 0 && (
        <div className="space-y-0" id="vouchers">
          {classStudents.map((student, idx) => (
            <div
              key={student.id}
              className="border rounded-xl p-6 mb-6 bg-white print:rounded-none print:border-0 print:border-b print:mb-0"
              style={{ pageBreakInside: "avoid" }}
            >
              <div className="flex items-start justify-between border-b pb-4 mb-4">
                <div className="flex items-center gap-3">
                  <img src="/kips-logo.jpeg" alt="KIPS" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: "#e07b1a" }} />
                  <div>
                    <h2 className="font-bold text-lg" style={{ color: "#1a2a5e" }}>KIPS School Hassari</h2>
                    <p className="text-xs text-gray-500">Bright Future | School Fee Voucher</p>
                    <p className="text-xs text-gray-400">Date: {voucherDate}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Voucher No.</p>
                  <p className="font-mono font-bold text-gray-800">
                    {month.replace("-", "")}-{String(student.admissionNumber).split("-").pop()}-{String(idx + 1).padStart(3, "0")}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                <div>
                  <div className="space-y-1.5">
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Student Name:</span><span className="font-semibold text-gray-900">{student.name}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Admission No.:</span><span className="font-mono text-purple-700 font-medium">{student.admissionNumber}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Father Name:</span><span className="text-gray-800">{student.fatherName ?? "—"}</span></div>
                  </div>
                </div>
                <div>
                  <div className="space-y-1.5">
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Class:</span><span className="font-semibold text-gray-900">{selectedClassName}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Section:</span><span className="text-gray-800">{student.section ?? "—"}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Month:</span><span className="font-semibold text-gray-900">{monthLabel}</span></div>
                  </div>
                </div>
              </div>

              <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                <thead style={{ background: "#1a2a5e", color: "#fff" }}>
                  <tr>
                    <th className="text-left py-2 px-3">Description</th>
                    <th className="text-right py-2 px-3">Amount (PKR)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 px-3">Monthly Tuition Fee</td>
                    <td className="py-2 px-3 text-right font-semibold">{Number(student.feeAmount ?? 0).toLocaleString()}</td>
                  </tr>
                  <tr className="bg-gray-50">
                    <td className="py-2 px-3 font-bold">Total Due</td>
                    <td className="py-2 px-3 text-right font-bold text-red-600">{Number(student.feeAmount ?? 0).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex items-center justify-between text-xs text-gray-500 border-t pt-3">
                <span>Due Date: <strong className="text-gray-700">{dueDate}</strong></span>
                <span>Pay before due date to avoid fine</span>
                <span>Cashier Signature: ________________</span>
              </div>

              {idx < classStudents.length - 1 && (
                <div className="border-t border-dashed mt-4 pt-1 text-center text-[10px] text-gray-300 print:block hidden">✂ cut here</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
