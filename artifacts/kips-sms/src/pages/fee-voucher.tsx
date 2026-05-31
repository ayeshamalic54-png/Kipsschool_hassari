import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useListStudents, useListClasses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptText, Printer, Pencil, Check, GraduationCap } from "lucide-react";

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 6mm 8mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    body { margin: 0; padding: 0; background: white; }
    #kips-voucher-print { display: block !important; }
    .voucher-pair { page-break-inside: avoid; page-break-after: always; }
    .voucher-pair:last-child { page-break-after: avoid; }
    .voucher-copy {
      border: 1.5px solid #374151; border-radius: 0;
      padding: 8mm 10mm; box-sizing: border-box;
      font-family: Arial, sans-serif; font-size: 9.5pt;
    }
    .cut-line {
      border-top: 1.5px dashed #9ca3af; margin: 3mm 0;
      text-align: center; font-size: 8pt; color: #9ca3af; line-height: 1;
    }
  }
`;

interface VoucherEdit {
  feeOverride: string;
  arrears: string;      // manual arrears per student
  fine: string;
  discount: string;
  note: string;
}

interface FeeStructure {
  id: number;
  classId: number;
  monthlyFee: number;
  admissionFee: number;
  examFee: number;
  libraryFee: number;
  transportFee: number;
  Arrears?: number;
}

interface FeeRecord {
  id: number;
  studentId: number;
  month: string;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

function getToken(): string {
  return localStorage.getItem("token") ?? localStorage.getItem("kips_token") ?? "";
}
function authH(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const NAVY   = "#1a2a5e";
const ORANGE = "#e07b1a";

// ── Single Voucher Copy ────────────────────────────────────────────────────────
function VoucherCopy({
  copyLabel, student, selectedClassName, monthLabel, dueDate,
  voucherNo, structure, edit, fine, disc, total, monthlyFeeToUse, previousArrears, manualArrears, globalArrears,
}: {
  copyLabel: string;
  student: { name: string; admissionNumber: string; fatherName?: string | null; section?: string | null };
  selectedClassName: string;
  monthLabel: string;
  dueDate: string;
  voucherNo: string;
  structure?: FeeStructure;
  edit: VoucherEdit;
  fine: number;
  disc: number;
  total: number;
  monthlyFeeToUse: number;
  previousArrears: number;
  manualArrears: number;
  globalArrears: number;
}) {
  const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

  const feeRows: { label: string; amount: number; color?: string }[] = [];
  if (monthlyFeeToUse > 0) feeRows.push({ label: "Monthly Tuition Fee", amount: monthlyFeeToUse });
  if (structure) {
    if (structure.examFee      > 0) feeRows.push({ label: "Exam / Test Fee",  amount: structure.examFee,     color: "#7c3aed" });
    if (structure.libraryFee   > 0) feeRows.push({ label: "Annual Charges",   amount: structure.libraryFee,  color: "#0369a1" });
    if (structure.transportFee > 0) feeRows.push({ label: "Transport Fee",    amount: structure.transportFee,color: "#0891b2" });
  }
  if (previousArrears > 0) feeRows.push({ label: "Previous Arrears (Baqi Fee)",      amount: previousArrears, color: "#dc2626" });
  if (globalArrears   > 0) feeRows.push({ label: "Previous Arrears (Pichle Mahine)", amount: globalArrears,   color: "#dc2626" });
  if (manualArrears   > 0) feeRows.push({ label: "Additional Arrears (Is Student ki)", amount: manualArrears, color: "#b91c1c" });
  if (fine > 0)             feeRows.push({ label: "Fine / Late Charges",               amount: fine,            color: "#dc2626" });

  const thStyle: React.CSSProperties = {
    background: NAVY, color: "#fff", padding: "5px 8px",
    textAlign: "left" as const, fontSize: 9, fontWeight: 700,
  };
  const tdStyle = (alt: boolean): React.CSSProperties => ({
    padding: "4px 8px", borderBottom: "1px solid #e5e7eb",
    fontSize: 9.5, background: alt ? "#f3f4f6" : "#fff",
  });
  const tdRStyle = (alt: boolean, color?: string): React.CSSProperties => ({
    ...tdStyle(alt), textAlign: "right" as const, fontWeight: 600, color: color ?? "#111827",
  });

  return (
    <div className="voucher-copy" style={{ border: "1.5px solid #374151", padding: "8mm 10mm", fontFamily: "Arial, sans-serif", fontSize: "9.5pt", boxSizing: "border-box" }}>
      <div style={{ display: "inline-block", fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" as const, border: `1px dashed ${copyLabel === "School Copy" ? "#374151" : ORANGE}`, borderRadius: 3, padding: "1px 7px", color: copyLabel === "School Copy" ? "#374151" : ORANGE, marginBottom: 5 }}>{copyLabel}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 10 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: "50%", border: `2px solid ${ORANGE}` }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: NAVY, lineHeight: 1.2 }}>KIPS School Hassari</div>
          <div style={{ fontSize: 9, color: ORANGE, fontWeight: 700, marginTop: 1 }}>Bright Future — Fee Voucher</div>
          <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 1 }}>Date: {printDate}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>Voucher No.</div>
          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 10, color: NAVY }}>{voucherNo}</div>
          <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 2 }}>Month: {monthLabel}</div>
        </div>
      </div>

      <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px", marginBottom: 8, background: "#f9fafb", fontSize: 9.5 }}>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Student Name:</span><span style={{ fontWeight: 700, color: "#111827" }}>{student.name}</span></div>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Class / Section:</span><span style={{ fontWeight: 700, color: "#111827" }}>{selectedClassName}{student.section ? ` / ${student.section}` : ""}</span></div>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Admission No.:</span><span style={{ fontWeight: 700, color: "#7c3aed", fontFamily: "monospace" }}>{student.admissionNumber}</span></div>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Father Name:</span><span style={{ fontWeight: 700, color: "#111827" }}>{student.fatherName ?? "—"}</span></div>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
        <thead>
          <tr>
            <th style={thStyle}>Description</th>
            <th style={{ ...thStyle, textAlign: "right" as const }}>Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {feeRows.length === 0 && (
            <tr><td colSpan={2} style={{ ...tdStyle(false), textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No fee structure set for this class</td></tr>
          )}
          {feeRows.map((row, i) => (
            <tr key={row.label}>
              <td style={tdStyle(i % 2 === 1)}>{row.label}</td>
              <td style={tdRStyle(i % 2 === 1, row.color)}>{row.amount.toLocaleString()}</td>
            </tr>
          ))}
          {disc > 0 && (
            <tr>
              <td style={tdStyle(feeRows.length % 2 === 1)}>{edit.note || "Discount / Concession"}</td>
              <td style={tdRStyle(feeRows.length % 2 === 1, "#059669")}>−{disc.toLocaleString()}</td>
            </tr>
          )}
          {edit.note && disc === 0 && (
            <tr><td colSpan={2} style={{ ...tdStyle(false), fontStyle: "italic", color: "#6b7280", fontSize: 8.5 }}>Note: {edit.note}</td></tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ background: NAVY, color: "#fff", padding: "6px 8px", fontWeight: 900, fontSize: 10 }}>TOTAL PAYABLE</td>
            <td style={{ background: NAVY, color: "#fff", padding: "6px 8px", fontWeight: 900, fontSize: 11, textAlign: "right" }}>PKR {total.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#6b7280", marginBottom: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 4, padding: "4px 8px" }}>
        <span>Due Date: <strong style={{ color: "#92400e" }}>{dueDate}</strong></span>
        <span style={{ color: "#92400e" }}>⚠ Pay before due date to avoid late fine</span>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #d1d5db", marginTop: 10, paddingTop: 8, fontSize: 8.5, color: "#6b7280" }}>
        {["Parent / Guardian Signature", "Cashier Signature", "School Stamp / Principal"].map(label => (
          <div key={label} style={{ textAlign: "center" as const, minWidth: 120 }}>
            <div style={{ borderBottom: "1px solid #374151", marginBottom: 3, height: 18 }} />
            <div>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function FeeVoucher() {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [month, setMonth]     = useState<string>(new Date().toISOString().slice(0, 7));
  const [dueDate, setDueDate] = useState<string>(() => {
    const d = new Date(); d.setDate(10); return d.toISOString().slice(0, 10);
  });
  const [generated, setGenerated]   = useState(false);
  const [edits, setEdits]           = useState<Record<number, VoucherEdit>>({});
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [draft, setDraft]           = useState<VoucherEdit>({ feeOverride: "", arrears: "", fine: "", discount: "", note: "" });
  const [globalArrears, setGlobalArrears] = useState<string>("");  // applies to ALL students
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [allFeeRecords, setAllFeeRecords] = useState<FeeRecord[]>([]);

  const { data: classes }     = useListClasses();
  const { data: allStudents } = useListStudents({});

  // Inject print styles
  useEffect(() => {
    const el = document.createElement("style"); el.id = "kips-voucher-print";
    el.textContent = PRINT_STYLES; document.head.appendChild(el);
    return () => { document.getElementById("kips-voucher-print")?.remove(); };
  }, []);

  // Load fee structures
  useEffect(() => {
    fetch("/api/fee-structures", { headers: authH() })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Record<string, unknown>[]) => setFeeStructures(rows.map(r => ({
        id: Number(r.id), classId: Number(r.classId),
        monthlyFee:   Number(r.monthlyFee   ?? 0),
        admissionFee: Number(r.admissionFee ?? 0),
        examFee:      Number(r.examFee      ?? 0),
        libraryFee:   Number(r.libraryFee   ?? 0),
        transportFee: Number(r.transportFee ?? 0),
        Arrears:      Number(r.Arrears      ?? 0),
      }))))
      .catch(() => setFeeStructures([]));
  }, []);

  // FIX: Load ALL fee records to calculate previous arrears per student
  useEffect(() => {
    fetch("/api/fees", { headers: authH() })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Record<string, unknown>[]) => setAllFeeRecords(rows.map(r => ({
        id:              Number(r.id),
        studentId:       Number(r.studentId),
        month:           String(r.month ?? ""),
        amount:          Number(r.amount ?? 0),
        paidAmount:      Number(r.paidAmount ?? 0),
        remainingAmount: Number(r.remainingAmount ?? 0),
        status:          String(r.status ?? ""),
      }))))
      .catch(() => setAllFeeRecords([]));
  }, []);

  const feeStructureMap    = Object.fromEntries(feeStructures.map(f => [f.classId, f]));
  // FIX: show all students in class, not just active (some schools keep all)
  const classStudents      = (allStudents?.filter(s => String(s.classId) === selectedClass && s.status === "active") ?? []);
  const selectedClassName  = classes?.find(c => String(c.id) === selectedClass)?.name ?? "";
  const selectedStructure  = selectedClass ? feeStructureMap[Number(selectedClass)] : undefined;
  const monthLabel         = month ? new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" }) : "";

  const getEdit = (id: number): VoucherEdit => edits[id] ?? { feeOverride: "", arrears: "", fine: "", discount: "", note: "" };

  // FIX: Calculate previous arrears — sum of remainingAmount for months BEFORE selected month
  const getPreviousArrears = (studentId: number): number => {
    return allFeeRecords
      .filter(f =>
        f.studentId === studentId &&
        f.month < month &&
        (f.status === "unpaid" || f.status === "partial") &&
        f.remainingAmount > 0
      )
      .reduce((sum, f) => sum + f.remainingAmount, 0);
  };

  // FIX: Monthly fee = feeOverride if set by admin, otherwise fee structure monthly fee
  const getMonthlyFee = (studentId: number, structure?: FeeStructure): number => {
    const e = getEdit(studentId);
    if (e.feeOverride && Number(e.feeOverride) > 0) return Number(e.feeOverride);
    return structure?.monthlyFee ?? 0;
  };

  const calcTotal = (studentId: number, structure?: FeeStructure): number => {
    const e               = getEdit(studentId);
    const monthly         = getMonthlyFee(studentId, structure);
    const exam            = structure?.examFee      ?? 0;
    const library         = structure?.libraryFee   ?? 0;
    const transport       = structure?.transportFee ?? 0;
    const fine            = Number(e.fine     || 0);
    const disc            = Number(e.discount || 0);
    const autoArrears     = getPreviousArrears(studentId);
    const manualArrears   = Number(e.arrears  || 0);
    const gArrears        = Number(globalArrears || 0);   // class-level arrears for all
    return Math.max(0, monthly + exam + library + transport + fine + autoArrears + manualArrears + gArrears - disc);
  };

  const makeVoucherNo = (admNo: string, idx: number) =>
    `${month.replace("-", "")}-${String(admNo).split("-").pop()}-${String(idx + 1).padStart(3, "0")}`;

  const openEdit = (id: number) => {
    const e = getEdit(id);
    setDraft({ feeOverride: e.feeOverride, arrears: e.arrears, fine: e.fine, discount: e.discount, note: e.note });
    setEditingId(id);
  };
  const saveEdit = (id: number) => {
    setEdits(prev => ({ ...prev, [id]: { ...draft } }));
    setEditingId(null);
  };

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-teal-600" /> Fee Voucher
          </h1>
          <p className="text-gray-500 text-sm mt-1">Generate class-wise fee vouchers — Parent & School copies</p>
        </div>
      </div>

      {/* Controls */}
      <Card className="no-print">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Select Class *</label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setGenerated(false); setEdits({}); }}>
                <SelectTrigger><SelectValue placeholder="Choose class…" /></SelectTrigger>
                <SelectContent>
                  {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Month *</label>
              <Input type="month" value={month} onChange={e => { setMonth(e.target.value); setGenerated(false); }} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            {/* Global arrears — sub bachon ke liye ek hi bar likho */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">
                Previous Arrears — Sab Bachon ke Liye (PKR)
              </label>
              <Input
                type="number" min="0"
                placeholder="0 — khali rakhain agar koi arrears nahi"
                value={globalArrears}
                onChange={e => setGlobalArrears(e.target.value)}
              />
              {globalArrears && Number(globalArrears) > 0 && (
                <p className="text-xs text-red-600 font-semibold mt-1">
                  ⚠ PKR {Number(globalArrears).toLocaleString()} — har bachay ke voucher mein add hoga
                </p>
              )}
            </div>
          </div>

          {/* Fee structure preview */}
          {selectedClass && (
            <div className={`p-3 rounded-lg border text-sm ${selectedStructure ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-300"}`}>
              {selectedStructure ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span className="font-semibold text-blue-800">Fee Structure — {selectedClassName}:</span>
                  {selectedStructure.monthlyFee   > 0 && <span className="text-gray-700">Monthly: <strong>PKR {selectedStructure.monthlyFee.toLocaleString()}</strong></span>}
                  {selectedStructure.examFee      > 0 && <span className="text-gray-700">Exam: <strong>PKR {selectedStructure.examFee.toLocaleString()}</strong></span>}
                  {selectedStructure.libraryFee   > 0 && <span className="text-gray-700">Annual: <strong>PKR {selectedStructure.libraryFee.toLocaleString()}</strong></span>}
                  {selectedStructure.transportFee > 0 && <span className="text-gray-700">Transport: <strong>PKR {selectedStructure.transportFee.toLocaleString()}</strong></span>}
                  <span className="font-bold text-emerald-700">
                    Total: PKR {(selectedStructure.monthlyFee + selectedStructure.examFee + selectedStructure.libraryFee + selectedStructure.transportFee).toLocaleString()}/student
                  </span>
                </div>
              ) : (
                <p className="text-amber-700">⚠️ Is class ki fee structure set nahi hai. Fee Structure page par jaakar pehle set karein.</p>
              )}
            </div>
          )}

          <div className="flex gap-3 flex-wrap items-center">
            <Button
              disabled={!selectedClass || !month}
              onClick={() => setGenerated(true)}
              className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white hover:from-blue-800 hover:to-indigo-800"
            >
              <GraduationCap className="w-4 h-4 mr-2" />
              Generate Vouchers ({classStudents.length} students)
            </Button>
            {generated && classStudents.length > 0 && (
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="w-4 h-4 mr-2" /> Print All
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {generated && classStudents.length === 0 && (
        <div className="text-center py-16 text-gray-400 no-print">
          <ReceiptText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Is class mein koi active student nahi</p>
        </div>
      )}

      {/* Adjust Dialog — per-student fee editing */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Student Fee Adjust Karein</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">

            {/* Monthly fee override */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Monthly Fee (PKR)
                <span className="text-xs text-gray-400 ml-1">— khali chorain agar class fee use karni hai</span>
              </label>
              <Input
                type="number" min="0"
                placeholder={`Class fee: PKR ${selectedStructure?.monthlyFee?.toLocaleString() ?? "0"}`}
                value={draft.feeOverride}
                onChange={e => setDraft(d => ({ ...d, feeOverride: e.target.value }))}
              />
            </div>

            {/* Manual arrears — ek bacha bhai ka arrears alag laga sako */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Previous Arrears / Baqi Fee (PKR)
                <span className="text-xs text-gray-400 ml-1">— is student ke pichle mahine ki baqi fee</span>
              </label>
              <Input
                type="number" min="0"
                placeholder="0"
                value={draft.arrears}
                onChange={e => setDraft(d => ({ ...d, arrears: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Fine / Late Charges (PKR)</label>
              <Input type="number" min="0" placeholder="0" value={draft.fine}
                onChange={e => setDraft(d => ({ ...d, fine: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Discount / Concession (PKR)</label>
              <Input type="number" min="0" placeholder="0" value={draft.discount}
                onChange={e => setDraft(d => ({ ...d, discount: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Note (optional)</label>
              <Input placeholder="e.g. 2 mahine ki fee baqi thi" value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
            </div>

            {/* Live total preview in dialog */}
            {editingId !== null && (() => {
              const struct = allStudents?.find(s => s.id === editingId) && selectedStructure;
              const previewTotal = Math.max(0,
                (Number(draft.feeOverride) || selectedStructure?.monthlyFee || 0) +
                (selectedStructure?.examFee ?? 0) +
                (selectedStructure?.libraryFee ?? 0) +
                (selectedStructure?.transportFee ?? 0) +
                (Number(draft.arrears) || 0) +
                (Number(draft.fine) || 0) -
                (Number(draft.discount) || 0)
              );
              return (
                <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-gray-600">Total Payable:</span>
                  <span className="text-base font-black" style={{ color: NAVY }}>PKR {previewTotal.toLocaleString()}</span>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={() => editingId !== null && saveEdit(editingId)}
                style={{ background: NAVY, color: "#fff" }}>
                <Check className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Screen Preview Cards */}
      {generated && classStudents.length > 0 && (
        <div className="no-print space-y-4">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {classStudents.length} Vouchers — {selectedClassName} — {monthLabel}
          </p>

          {classStudents.map((student, idx) => {
            const structure      = student.classId ? feeStructureMap[student.classId] : undefined;
            const e              = getEdit(student.id);
            const fine           = Number(e.fine     || 0);
            const disc           = Number(e.discount || 0);
            const monthly        = getMonthlyFee(student.id, structure);
            const autoArrears    = getPreviousArrears(student.id);
            const manualArrears  = Number(e.arrears || 0);
            const gArrears       = Number(globalArrears || 0);
            const total          = calcTotal(student.id, structure);
            const hasEdits       = e.feeOverride || e.arrears || e.fine || e.discount || e.note;

            return (
              <Card key={student.id} className="border-2 border-gray-200 hover:border-blue-300 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Student info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}>
                        {student.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{student.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {student.admissionNumber} · {selectedClassName}{student.section ? ` / ${student.section}` : ""}
                        </p>
                        {student.fatherName && <p className="text-xs text-gray-400">s/o {student.fatherName}</p>}
                      </div>
                    </div>

                    {/* Fee breakdown */}
                    <div className="text-right shrink-0">
                      {structure || monthly > 0 ? (
                        <div className="space-y-0.5 text-xs text-gray-500">
                          {monthly       > 0 && <div>Monthly: PKR {monthly.toLocaleString()}{e.feeOverride ? " ✎" : ""}</div>}
                          {structure?.examFee      && structure.examFee      > 0 && <div>Exam: PKR {structure.examFee.toLocaleString()}</div>}
                          {structure?.libraryFee   && structure.libraryFee   > 0 && <div>Annual: PKR {structure.libraryFee.toLocaleString()}</div>}
                          {structure?.transportFee && structure.transportFee > 0 && <div>Transport: PKR {structure.transportFee.toLocaleString()}</div>}
                          {gArrears      > 0 && <div className="text-red-600 font-bold">Arrears (Sab): PKR {gArrears.toLocaleString()}</div>}
                          {autoArrears   > 0 && <div className="text-red-600 font-semibold">Auto Arrears: PKR {autoArrears.toLocaleString()}</div>}
                          {manualArrears > 0 && <div className="text-red-700 font-semibold">Arrears (Yeh Student): PKR {manualArrears.toLocaleString()} ✎</div>}
                          {fine    > 0 && <div className="text-red-500">Fine: +PKR {fine.toLocaleString()}</div>}
                          {disc    > 0 && <div className="text-emerald-600">Disc: −PKR {disc.toLocaleString()}</div>}
                        </div>
                      ) : (
                        <p className="text-xs text-amber-600">Fee structure set nahi</p>
                      )}
                      <p className="text-lg font-black mt-1" style={{ color: NAVY }}>PKR {total.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">Due: {dueDate}</p>
                    </div>

                    {/* Adjust button */}
                    <button
                      onClick={() => openEdit(student.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${hasEdits ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      {hasEdits ? "Edited ✓" : "Adjust"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Print-only vouchers — two copies per student */}
      {generated && classStudents.length > 0 && createPortal(
        <div id="kips-voucher-print" style={{ display: "none", fontFamily: "Arial, sans-serif" }}>
          {classStudents.map((student, idx) => {
            const structure      = student.classId ? feeStructureMap[student.classId] : undefined;
            const e              = getEdit(student.id);
            const fine           = Number(e.fine     || 0);
            const disc           = Number(e.discount || 0);
            const monthly        = getMonthlyFee(student.id, structure);
            const autoArrears    = getPreviousArrears(student.id);
            const manualArrears  = Number(e.arrears || 0);
            const gArrears       = Number(globalArrears || 0);
            const total          = calcTotal(student.id, structure);
            const voucherNo      = makeVoucherNo(student.admissionNumber, idx);

            return (
              <div key={student.id} className="voucher-pair" style={{ pageBreakInside: "avoid", pageBreakAfter: "always" }}>
                <VoucherCopy copyLabel="School Copy"            student={student} selectedClassName={selectedClassName} monthLabel={monthLabel} dueDate={dueDate} voucherNo={voucherNo} structure={structure} edit={e} fine={fine} disc={disc} total={total} monthlyFeeToUse={monthly} previousArrears={autoArrears} manualArrears={manualArrears} globalArrears={gArrears} />
                <div className="cut-line" style={{ borderTop: "1.5px dashed #9ca3af", margin: "4mm 0", textAlign: "center", fontSize: "8pt", color: "#9ca3af", lineHeight: 1 }}>✂ &nbsp; Cut Here &nbsp; ✂</div>
                <VoucherCopy copyLabel="Parent / Guardian Copy" student={student} selectedClassName={selectedClassName} monthLabel={monthLabel} dueDate={dueDate} voucherNo={voucherNo} structure={structure} edit={e} fine={fine} disc={disc} total={total} monthlyFeeToUse={monthly} previousArrears={autoArrears} manualArrears={manualArrears} globalArrears={gArrears} />
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}

