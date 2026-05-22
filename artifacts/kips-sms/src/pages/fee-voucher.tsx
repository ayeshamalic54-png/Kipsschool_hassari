import { useState } from "react";
import { useListStudents, useListClasses, useListFees } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptText, Printer, Pencil, Check } from "lucide-react";

interface VoucherEdit {
  feeOverride: string;
  fine: string;
  discount: string;
  note: string;
}

export default function FeeVoucher() {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [month, setMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(); d.setDate(10); return d.toISOString().slice(0, 10);
  });
  const [generated, setGenerated] = useState(false);
  const [edits, setEdits] = useState<Record<number, VoucherEdit>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<VoucherEdit>({ feeOverride: "", fine: "", discount: "", note: "" });

  const { data: classes } = useListClasses();
  const { data: allStudents } = useListStudents({});

  // Fetch existing fee records for the selected month to use as base fee amounts
  const { data: feeRecords } = useListFees(
    month ? { month } : {}
  );

  const classStudents = allStudents?.filter(s => String(s.classId) === selectedClass && s.status === "active") ?? [];
  const selectedClassName = classes?.find(c => String(c.id) === selectedClass)?.name ?? "";

  const voucherDate = new Date().toLocaleDateString("en-PK", { dateStyle: "long" });
  const monthLabel = month ? new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" }) : "";

  const getEdit = (id: number) => edits[id] ?? { feeOverride: "", fine: "", discount: "", note: "" };

  // Get base fee for a student: first check feesTable record for the month, then fall back to student.feeAmount
  const getBaseFee = (studentId: number, studentFeeAmount: number | null) => {
    const feeRecord = feeRecords?.find(f => Number((f as unknown as Record<string, unknown>).studentId) === studentId);
    if (feeRecord && feeRecord.amount) return Number(feeRecord.amount);
    return Number(studentFeeAmount ?? 0);
  };

  const openEdit = (id: number, baseFee: number) => {
    const e = getEdit(id);
    setDraft({ feeOverride: e.feeOverride || String(baseFee), fine: e.fine, discount: e.discount, note: e.note });
    setEditingId(id);
  };

  const saveEdit = (id: number) => {
    setEdits(prev => ({ ...prev, [id]: { ...draft } }));
    setEditingId(null);
  };

  const calcTotal = (id: number, baseFee: number) => {
    const e = getEdit(id);
    const fee = Number(e.feeOverride || baseFee);
    const fine = Number(e.fine || 0);
    const disc = Number(e.discount || 0);
    return Math.max(0, fee + fine - disc);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-teal-600" /> Fee Voucher — By Class
          </h1>
          <p className="text-gray-500 text-sm mt-1">Generate and edit fee vouchers before printing</p>
        </div>
      </div>

      {/* Controls */}
      <Card className="no-print">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Select Class</label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setGenerated(false); setEdits({}); }}>
                <SelectTrigger><SelectValue placeholder="Choose class..." /></SelectTrigger>
                <SelectContent>
                  {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Month</label>
              <Input type="month" value={month} onChange={e => { setMonth(e.target.value); setGenerated(false); }} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>
          <div className="mt-4 flex gap-2 items-center flex-wrap">
            <Button
              disabled={!selectedClass || !month}
              onClick={() => setGenerated(true)}
              style={{ background: "linear-gradient(135deg, #1a2a5e, #2d4a9a)", color: "#fff" }}
            >
              Generate Vouchers ({classStudents.length} students)
            </Button>
            {generated && classStudents.length > 0 && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Print All
              </Button>
            )}
            {month && feeRecords && feeRecords.length > 0 && (
              <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-3 py-1">
                {feeRecords.length} fee record(s) loaded for {monthLabel}
              </span>
            )}
            {month && feeRecords && feeRecords.length === 0 && (
              <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-3 py-1">
                No fee records for {monthLabel} — using per-student fee amounts
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && classStudents.length === 0 && (
        <p className="text-center text-gray-500 py-12">No active students found in this class.</p>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Voucher Amounts</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fee Amount (PKR)</label>
              <Input
                type="number"
                placeholder="Monthly fee"
                value={draft.feeOverride}
                onChange={e => setDraft(d => ({ ...d, feeOverride: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fine / Late Charges (PKR)</label>
              <Input
                type="number"
                placeholder="0"
                value={draft.fine}
                onChange={e => setDraft(d => ({ ...d, fine: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Discount / Concession (PKR)</label>
              <Input
                type="number"
                placeholder="0"
                value={draft.discount}
                onChange={e => setDraft(d => ({ ...d, discount: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
              <Input
                placeholder="e.g. Sibling discount"
                value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))}
              />
            </div>
            <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-gray-700">Total Due:</span>
              <span className="text-lg font-bold text-gray-900">
                PKR {Math.max(0, (Number(draft.feeOverride) || 0) + (Number(draft.fine) || 0) - (Number(draft.discount) || 0)).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={() => editingId !== null && saveEdit(editingId)}>
                <Check className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vouchers */}
      {generated && classStudents.length > 0 && (
        <div className="space-y-0" id="vouchers">
          {classStudents.map((student, idx) => {
            const baseFee = getBaseFee(student.id, student.feeAmount ?? null);
            const e = getEdit(student.id);
            const fee = Number(e.feeOverride || baseFee);
            const fine = Number(e.fine || 0);
            const disc = Number(e.discount || 0);
            const total = calcTotal(student.id, baseFee);
            const hasEdits = e.feeOverride || e.fine || e.discount || e.note;

            // Check if fee came from fee records
            const hasFeeRecord = feeRecords?.some(f => Number((f as unknown as Record<string, unknown>).studentId) === student.id);

            return (
              <div
                key={student.id}
                className="border rounded-xl p-6 mb-6 bg-white relative print:rounded-none print:border-0 print:border-b print:mb-0"
                style={{ pageBreakInside: "avoid" }}
              >
                {/* Edit button — hidden in print */}
                <button
                  className="absolute top-4 right-4 no-print flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 transition-colors font-medium border border-blue-200"
                  onClick={() => openEdit(student.id, baseFee)}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {hasEdits ? "Edited" : "Edit"}
                </button>

                <div className="flex items-start justify-between border-b pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <img src="/kips-logo.jpeg" alt="KIPS" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: "#e07b1a" }} />
                    <div>
                      <h2 className="font-bold text-lg" style={{ color: "#1a2a5e" }}>KIPS School Hassari</h2>
                      <p className="text-xs text-gray-500">Bright Future | School Fee Voucher</p>
                      <p className="text-xs text-gray-400">Date: {voucherDate}</p>
                    </div>
                  </div>
                  <div className="text-right pr-16 no-print sm:pr-20">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Voucher No.</p>
                    <p className="font-mono font-bold text-gray-800">
                      {month.replace("-", "")}-{String(student.admissionNumber).split("-").pop()}-{String(idx + 1).padStart(3, "0")}
                    </p>
                  </div>
                  <div className="text-right hidden print:block">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Voucher No.</p>
                    <p className="font-mono font-bold text-gray-800">
                      {month.replace("-", "")}-{String(student.admissionNumber).split("-").pop()}-{String(idx + 1).padStart(3, "0")}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-5">
                  <div className="space-y-1.5">
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Student Name:</span><span className="font-semibold text-gray-900">{student.name}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Admission No.:</span><span className="font-mono text-purple-700 font-medium">{student.admissionNumber}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Father Name:</span><span className="text-gray-800">{student.fatherName ?? "—"}</span></div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Class:</span><span className="font-semibold text-gray-900">{selectedClassName}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Section:</span><span className="text-gray-800">{student.section ?? "—"}</span></div>
                    <div className="flex gap-2"><span className="text-gray-500 w-28 shrink-0">Month:</span><span className="font-semibold text-gray-900">{monthLabel}</span></div>
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
                      <td className="py-2 px-3">
                        Monthly Tuition Fee
                        {hasFeeRecord && !hasEdits && (
                          <span className="ml-2 text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 no-print">from records</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold">{fee.toLocaleString()}</td>
                    </tr>
                    {fine > 0 && (
                      <tr className="border-b">
                        <td className="py-2 px-3 text-red-600">Fine / Late Charges</td>
                        <td className="py-2 px-3 text-right text-red-600 font-semibold">+{fine.toLocaleString()}</td>
                      </tr>
                    )}
                    {disc > 0 && (
                      <tr className="border-b">
                        <td className="py-2 px-3 text-emerald-700">{e.note || "Discount / Concession"}</td>
                        <td className="py-2 px-3 text-right text-emerald-700 font-semibold">-{disc.toLocaleString()}</td>
                      </tr>
                    )}
                    {e.note && disc === 0 && (
                      <tr className="border-b bg-gray-50">
                        <td className="py-2 px-3 text-gray-500 italic text-xs" colSpan={2}>Note: {e.note}</td>
                      </tr>
                    )}
                    <tr className="bg-gray-50">
                      <td className="py-2 px-3 font-bold">Total Due</td>
                      <td className="py-2 px-3 text-right font-bold text-red-600">{total.toLocaleString()}</td>
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
            );
          })}
        </div>
      )}
    </div>
  );
}
