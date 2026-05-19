import { useState } from "react";
import { useListStudents, useListClasses, useCreateFee, useListFees, getListFeesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptText, Printer, Save, CheckCircle2, Loader2, Trash2, Pencil } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

// ─── Fee Types ────────────────────────────────────────────────────────────────
const ALL_FEE_TYPES = [
  { key: "monthly",   label: "Monthly Tuition Fee" },
  { key: "admission", label: "Admission Fee"        },
  { key: "exam",      label: "Exam Fee"             },
  { key: "annual",    label: "Annual Charges"       },
  { key: "transport", label: "Transport Fee"        },
] as const;

type FeeKey = typeof ALL_FEE_TYPES[number]["key"];

function loadFeeStructure(): Record<number, Partial<Record<FeeKey, number>>> {
  try {
    const raw = localStorage.getItem("kips_fee_structure");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ─── Direct API helper (PUT / DELETE not in generated client) ────────────────
async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("kips_token");
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(await res.text().catch(() => "Request failed"));
  return res.status === 204 ? null : res.json();
}

const NAVY = "#1a2a5e";

// ════════════════════════════════════════════════════════════════════════════
export default function FeeVoucher() {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [month, setMonth]       = useState<string>(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate]   = useState<string>(() => {
    const d = new Date(); d.setDate(10);
    return d.toISOString().slice(0, 10);
  });
  const [selectedFeeTypes, setSelectedFeeTypes] = useState<Set<FeeKey>>(new Set(["monthly"]));
  const [generated, setGenerated]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [saveError, setSaveError]   = useState<string | null>(null);

  // Edit single voucher (fee record) state
  const [editTarget, setEditTarget]   = useState<{ id: number; amount: number; month: string; dueDate: string; fine: number } | null>(null);
  const [editAmount, setEditAmount]   = useState("");
  const [editMonth, setEditMonth]     = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editFine, setEditFine]       = useState("0");
  const [editSaving, setEditSaving]   = useState(false);

  // Delete state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting]                   = useState(false);

  const queryClient = useQueryClient();
  const createFee   = useCreateFee();
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === "admin";

  const { data: classes }     = useListClasses();
  const { data: allStudents } = useListStudents({});
  const { data: allFees }     = useListFees({});

  const feeStructure      = loadFeeStructure();
  const classId           = Number(selectedClass);
  const classFees         = feeStructure[classId] ?? {};
  const classStudents     = allStudents?.filter(s => String(s.classId) === selectedClass && s.status === "active") ?? [];
  const selectedClassName = classes?.find(c => String(c.id) === selectedClass)?.name ?? "";
  const availableFeeTypes = ALL_FEE_TYPES.filter(ft => (classFees[ft.key] ?? 0) > 0);
  const hasFeeStructure   = availableFeeTypes.length > 0;

  const calcTotal = () =>
    hasFeeStructure
      ? ALL_FEE_TYPES.reduce((s, ft) => selectedFeeTypes.has(ft.key) ? s + (classFees[ft.key] ?? 0) : s, 0)
      : 0;

  const voucherDate = new Date().toLocaleDateString("en-PK", { dateStyle: "long" });
  const monthLabel  = month ? new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" }) : "";

  // Fee records saved in DB for this class+month (for edit/delete)
  const savedFeeRecords = (allFees ?? []).filter(f => {
    const student = allStudents?.find(s => s.id === f.studentId);
    return f.month === month && student && String(student.classId) === selectedClass;
  });

  const toggleFeeType = (key: FeeKey) => {
    setSelectedFeeTypes(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Generate & Save to DB ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedClass || !month) return;
    setSaving(true); setSaveError(null); setSavedCount(0);
    let saved = 0;
    const errors: string[] = [];
    for (const student of classStudents) {
      const amount = hasFeeStructure && selectedFeeTypes.size > 0
        ? calcTotal() : Number(student.feeAmount ?? 0);
      if (amount <= 0) continue;
      try {
        await createFee.mutateAsync({ data: { studentId: student.id, amount, month, dueDate } });
        saved++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!msg.toLowerCase().includes("duplicate") && !msg.toLowerCase().includes("already")) {
          errors.push(`${student.name}: ${msg}`);
        } else { saved++; }
      }
    }
    setSavedCount(saved); setSaving(false); setGenerated(true);
    queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
    queryClient.invalidateQueries({ queryKey: ["/api/fees/defaulters"] });
    if (errors.length > 0) setSaveError(`${errors.length} error(s): ${errors.slice(0, 2).join("; ")}`);
  };

  // ── Edit single fee record ────────────────────────────────────────────────
  const openEdit = (feeId: number, amount: number, feeMonth: string, feeDueDate: string, fine: number) => {
    setEditTarget({ id: feeId, amount, month: feeMonth, dueDate: feeDueDate, fine });
    setEditAmount(String(amount));
    setEditMonth(feeMonth);
    setEditDueDate(feeDueDate);
    setEditFine(String(fine));
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/fees/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount:  Number(editAmount),
          month:   editMonth,
          dueDate: editDueDate,
          fine:    Number(editFine),
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      setEditTarget(null);
    } catch (e: unknown) {
      alert("Update failed: " + (e instanceof Error ? e.message : String(e)));
    } finally { setEditSaving(false); }
  };

  // ── Delete ALL vouchers for this class+month ──────────────────────────────
  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      for (const fee of savedFeeRecords) {
        await apiFetch(`/api/fees/${fee.id}`, { method: "DELETE" });
      }
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      setDeleteConfirmOpen(false);
      setGenerated(false);
      setSavedCount(0);
    } catch (e: unknown) {
      alert("Delete failed: " + (e instanceof Error ? e.message : String(e)));
    } finally { setDeleting(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-teal-600" /> Fee Voucher — By Class
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Select a class — fees will be saved to the database and vouchers will be ready to print
          </p>
        </div>
      </div>

      {/* Controls */}
      <Card className="no-print">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Select Class</label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setGenerated(false); setSavedCount(0); setSaveError(null); }}>
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

          {/* Fee Type Checkboxes */}
          {selectedClass && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Which fees to include in the voucher:</p>
              {hasFeeStructure ? (
                <div className="flex flex-wrap gap-4">
                  {availableFeeTypes.map(ft => (
                    <label key={ft.key} className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox checked={selectedFeeTypes.has(ft.key)} onCheckedChange={() => toggleFeeType(ft.key)} />
                      <span className="text-sm text-gray-700">
                        {ft.label}
                        <span className="ml-1 text-xs font-semibold text-indigo-600">
                          PKR {Number(classFees[ft.key] ?? 0).toLocaleString()}
                        </span>
                      </span>
                    </label>
                  ))}
                  {selectedFeeTypes.size > 0 && (
                    <span className="ml-auto text-sm font-bold text-gray-800">
                      Total: PKR {calcTotal().toLocaleString()}
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
                  ⚠️ No fee structure set for this class — please set fees on the <strong>Fee Structure</strong> page first.
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 items-center">
            <Button
              disabled={!selectedClass || !month || saving || classStudents.length === 0}
              onClick={handleGenerate}
              style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9a)`, color: "#fff" }}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving... ({savedCount}/{classStudents.length})</>
                : <><Save className="w-4 h-4 mr-2" /> Save & Generate ({classStudents.length} students)</>}
            </Button>

            {generated && classStudents.length > 0 && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Print All Vouchers
              </Button>
            )}

            {/* Admin: Delete all vouchers for this class+month */}
            {isAdmin && selectedClass && month && savedFeeRecords.length > 0 && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50 ml-auto"
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {savedFeeRecords.length} Vouchers ({monthLabel})
              </Button>
            )}
          </div>

          {/* Success / Error */}
          {generated && savedCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span><strong>{savedCount}</strong> students' fees saved to database.</span>
            </div>
          )}
          {saveError && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">⚠️ {saveError}</div>
          )}
        </CardContent>
      </Card>

      {generated && classStudents.length === 0 && (
        <p className="text-center text-gray-500 py-12">No active students found in this class.</p>
      )}

      {/* Vouchers */}
      {generated && classStudents.length > 0 && (
        <div id="vouchers">
          {classStudents.map((student, idx) => {
            // Find saved DB record for this student+month (for edit button)
            const savedRecord = savedFeeRecords.find(f => f.studentId === student.id);

            const feeRows: { label: string; amount: number }[] = [];
            if (hasFeeStructure && selectedFeeTypes.size > 0) {
              ALL_FEE_TYPES.forEach(ft => {
                if (selectedFeeTypes.has(ft.key) && (classFees[ft.key] ?? 0) > 0)
                  feeRows.push({ label: ft.label, amount: classFees[ft.key]! });
              });
            } else {
              feeRows.push({ label: "Monthly Tuition Fee", amount: Number(student.feeAmount ?? 0) });
            }
            const total = feeRows.reduce((s, r) => s + r.amount, 0);

            return (
              <div key={student.id} className="border rounded-xl p-6 mb-6 bg-white print:rounded-none print:border-0 print:border-b print:mb-0"
                style={{ pageBreakInside: "avoid" }}>

                {/* Admin action bar (hidden on print) */}
                {isAdmin && savedRecord && (
                  <div className="flex items-center justify-between mb-3 pb-3 border-b no-print">
                    <span className="text-xs text-gray-400 font-mono">Fee ID: #{savedRecord.id} — Status: <span className={savedRecord.status === "paid" ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>{savedRecord.status}</span></span>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs text-blue-600 border-blue-200 hover:bg-blue-50 gap-1"
                        onClick={() => openEdit(savedRecord.id, savedRecord.amount, savedRecord.month, savedRecord.dueDate, savedRecord.fine ?? 0)}>
                        <Pencil className="w-3 h-3" /> Edit
                      </Button>
                    </div>
                  </div>
                )}

                {/* Voucher Header */}
                <div className="flex items-start justify-between border-b pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <img src="/kips-logo.jpeg" alt="KIPS" className="w-14 h-14 rounded-full object-cover border-2" style={{ borderColor: "#e07b1a" }} />
                    <div>
                      <h2 className="font-bold text-lg" style={{ color: NAVY }}>KIPS School Hassari</h2>
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

                {/* Student Info */}
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

                {/* Fee Table */}
                <table className="w-full text-sm border rounded-lg overflow-hidden mb-4">
                  <thead style={{ background: NAVY, color: "#fff" }}>
                    <tr>
                      <th className="text-left py-2 px-3">Description</th>
                      <th className="text-right py-2 px-3">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feeRows.map((row, i) => (
                      <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="py-2 px-3 border-b">{row.label}</td>
                        <td className="py-2 px-3 border-b text-right font-semibold">{row.amount.toLocaleString()}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f0f4ff" }}>
                      <td className="py-2.5 px-3 font-bold" style={{ color: NAVY }}>Total Due</td>
                      <td className="py-2.5 px-3 text-right font-bold text-red-600 text-base">{total.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>

                {/* Footer */}
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

      {/* ── Edit Fee Dialog ── */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-4 h-4 text-blue-600" /> Fee Record Edit Karein
            </DialogTitle>
          </DialogHeader>
          {editTarget && (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Amount (PKR)</label>
                <Input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Month</label>
                <Input type="month" value={editMonth} onChange={e => setEditMonth(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Due Date</label>
                <Input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Fine (PKR)</label>
                <Input type="number" value={editFine} onChange={e => setEditFine(e.target.value)} />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button className="flex-1" disabled={editSaving} style={{ background: NAVY, color: "#fff" }} onClick={handleEditSave}>
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete All Confirm Dialog ── */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" /> Vouchers Delete Karein?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Class:</span><span className="font-semibold">{selectedClassName}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Month:</span><span className="font-semibold">{monthLabel}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Records:</span><span className="font-semibold text-red-600">{savedFeeRecords.length} vouchers</span></div>
            </div>
            <p className="text-sm text-gray-500">Yeh <strong>{savedFeeRecords.length}</strong> fee records hamesha ke liye delete ho jaynge.</p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
              <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" disabled={deleting} onClick={handleDeleteAll}>
                {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Haan, Delete
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
