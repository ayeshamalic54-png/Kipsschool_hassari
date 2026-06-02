import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useListStudents, useListClasses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ReceiptText, Printer, Pencil, Check, GraduationCap, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Print CSS ──────────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 4mm 6mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    body { margin: 0; padding: 0; background: white; }
    
    body > *:not(#kips-voucher-print) {
      display: none !important;
    }
    #kips-voucher-print {
      display: block !important;
      position: static !important;
      width: 100% !important;
    }
    .voucher-pair {
      page-break-inside: avoid;
      page-break-after: always;
      height: 285mm;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 1mm 0;
    }
    .voucher-pair:last-child {
      page-break-after: avoid;
    }
    .voucher-copy {
      border: 1.5px solid #1a2a5e;
      border-radius: 6px;
      padding: 6mm 8mm;
      box-sizing: border-box;
      font-family: Arial, sans-serif;
      font-size: 9pt;
      background: white;
    }
    .cut-line {
      border-top: 1.5px dashed #e07b1a;
      margin: 1.5mm 0;
      text-align: center;
      font-size: 7.5pt;
      color: #e07b1a;
      line-height: 1;
      font-weight: bold;
    }
  }
`;

interface VoucherEdit {
  tuitionFee: string;
  examFee: string;
  annualFee: string;
  transportFee: string;
  arrears: string;
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
}

function getToken(): string {
  return localStorage.getItem("token") ?? localStorage.getItem("kips_token") ?? "";
}

function authH() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const NAVY   = "#1a2a5e";
const ORANGE = "#e07b1a";

// ── Single Voucher Copy ────────────────────────────────────────────────────────
function VoucherCopy({
  copyLabel, student, selectedClassName, monthLabel, dueDate,
  voucherNo, edit, total,
}: {
  copyLabel: string;
  student: any;
  selectedClassName: string;
  monthLabel: string;
  dueDate: string;
  voucherNo: string;
  edit: VoucherEdit;
  total: number;
}) {
  const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

  const feeRows: { label: string; amount: number; color?: string }[] = [];
  const tuition = Number(edit.tuitionFee || 0);
  const exam = Number(edit.examFee || 0);
  const annual = Number(edit.annualFee || 0);
  const transport = Number(edit.transportFee || 0);
  const arrears = Number(edit.arrears || 0);
  const fine = Number(edit.fine || 0);
  const disc = Number(edit.discount || 0);

  if (tuition   > 0) feeRows.push({ label: "Monthly Tuition Fee",  amount: tuition          });
  if (exam      > 0) feeRows.push({ label: "Exam / Test Fee",      amount: exam,     color: "#7c3aed" });
  if (annual    > 0) feeRows.push({ label: "Annual Charges",       amount: annual,   color: "#0369a1" });
  if (transport > 0) feeRows.push({ label: "Transport Fee",        amount: transport,color: "#0891b2" });
  if (arrears   > 0) feeRows.push({ label: "Previous Arrears (Outstanding)", amount: arrears, color: "#d97706" });
  if (fine      > 0) feeRows.push({ label: "Fine / Late Charges",  amount: fine,     color: "#dc2626" });

  // Inline styles for print reliability
  const headerStyle: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10,
    borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 10,
  };
  const labelBadgeStyle: React.CSSProperties = {
    display: "inline-block", fontSize: 8, fontWeight: 700, letterSpacing: 1,
    textTransform: "uppercase" as const, border: `1px dashed ${copyLabel === "School Copy" ? "#374151" : ORANGE}`,
    borderRadius: 3, padding: "1px 7px",
    color: copyLabel === "School Copy" ? "#374151" : ORANGE,
    marginBottom: 5,
  };
  const infoBoxStyle: React.CSSProperties = {
    border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px",
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px",
    marginBottom: 8, background: "#f9fafb", fontSize: 9.5,
  };
  const infoRowStyle: React.CSSProperties = { display: "flex", gap: 4 };
  const labelStyle: React.CSSProperties = { color: "#6b7280", minWidth: 90, flexShrink: 0 };
  const valueStyle: React.CSSProperties = { fontWeight: 700, color: "#111827" };
  const thStyle: React.CSSProperties = {
    background: NAVY, color: "#fff", padding: "5px 8px",
    textAlign: "left" as const, fontSize: 9, fontWeight: 700,
  };
  const tdStyle = (alt: boolean): React.CSSProperties => ({
    padding: "4px 8px", borderBottom: "1px solid #e5e7eb",
    fontSize: 9.5, background: alt ? "#f3f4f6" : "#fff",
  });
  const tdRStyle = (alt: boolean, color?: string): React.CSSProperties => ({
    ...tdStyle(alt), textAlign: "right" as const, fontWeight: 600,
    color: color ?? "#111827",
  });
  const sigBoxStyle: React.CSSProperties = {
    display: "flex", justifyContent: "space-between",
    borderTop: "1px solid #d1d5db", marginTop: 10, paddingTop: 8,
    fontSize: 8.5, color: "#6b7280",
  };
  const sigLineStyle: React.CSSProperties = {
    textAlign: "center" as const, minWidth: 120,
  };
  const sigUnderlineStyle: React.CSSProperties = {
    borderBottom: "1px solid #374151", marginBottom: 3, height: 18,
  };

  return (
    <div className="voucher-copy" style={{ border: "1.5px solid #374151", padding: "8mm 10mm", fontFamily: "Arial, sans-serif", fontSize: "9.5pt", boxSizing: "border-box" }}>
      {/* Copy label */}
      <div style={labelBadgeStyle}>{copyLabel}</div>

      {/* Header */}
      <div style={headerStyle}>
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

      {/* Student Info */}
      <div style={infoBoxStyle}>
        <div style={infoRowStyle}><span style={labelStyle}>Student Name:</span><span style={valueStyle}>{student.name}</span></div>
        <div style={infoRowStyle}><span style={labelStyle}>Class / Section:</span><span style={valueStyle}>{selectedClassName}{student.section ? ` / ${student.section}` : ""}</span></div>
        <div style={infoRowStyle}><span style={labelStyle}>Admission No.:</span><span style={{ ...valueStyle, fontFamily: "monospace", color: "#7c3aed" }}>{student.admissionNumber}</span></div>
        <div style={infoRowStyle}><span style={labelStyle}>Father Name:</span><span style={valueStyle}>{student.fatherName ?? "—"}</span></div>
      </div>

      {/* Fee Table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
        <thead>
          <tr>
            <th style={thStyle}>Description</th>
            <th style={{ ...thStyle, textAlign: "right" as const }}>Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {feeRows.length === 0 && (
            <tr><td colSpan={2} style={{ ...tdStyle(false), textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No fees assigned</td></tr>
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
            <tr>
              <td colSpan={2} style={{ ...tdStyle(false), fontStyle: "italic", color: "#6b7280", fontSize: 8.5 }}>Note: {edit.note}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr>
            <td style={{ background: NAVY, color: "#fff", padding: "6px 8px", fontWeight: 900, fontSize: 10 }}>TOTAL PAYABLE</td>
            <td style={{ background: NAVY, color: "#fff", padding: "6px 8px", fontWeight: 900, fontSize: 11, textAlign: "right" }}>PKR {total.toLocaleString()}</td>
          </tr>
        </tfoot>
      </table>

      {/* Due date + bank note */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#6b7280", marginBottom: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 4, padding: "4px 8px" }}>
        <span>Due Date: <strong style={{ color: "#92400e" }}>{dueDate}</strong></span>
        <span style={{ color: "#92400e" }}>⚠ Pay before due date to avoid late fine</span>
      </div>

      {/* Signatures */}
      <div style={sigBoxStyle}>
        <div style={sigLineStyle}>
          <div style={sigUnderlineStyle} />
          <div>Parent / Guardian Signature</div>
        </div>
        <div style={sigLineStyle}>
          <div style={sigUnderlineStyle} />
          <div>Cashier Signature</div>
        </div>
        <div style={sigLineStyle}>
          <div style={sigUnderlineStyle} />
          <div>School Stamp / Principal</div>
        </div>
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
  const [generated, setGenerated] = useState(false);
  const [edits, setEdits]   = useState<Record<number, VoucherEdit>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft]   = useState<VoucherEdit>({ fine: "", discount: "", note: "" });
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [feeStructuresLoading, setFeeStructuresLoading] = useState(false);
  
  // New States
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFetchingFees, setIsFetchingFees] = useState(false);
  const [generatedFees, setGeneratedFees] = useState<any[]>([]);
  const [previousArrearsMap, setPreviousArrearsMap] = useState<Record<number, number>>({});

  const { data: classes }    = useListClasses();
  const { data: allStudents }= useListStudents({});
  const { toast }            = useToast();

  const feeStructureMap = Object.fromEntries(feeStructures.map(f => [f.classId, f]));
  const classStudents   = (allStudents?.filter(s => String(s.classId) === selectedClass && s.status === "active") ?? []);
  const selectedClassName = classes?.find(c => String(c.id) === selectedClass)?.name ?? "";
  const selectedFeeStructure = selectedClass ? feeStructureMap[Number(selectedClass)] : undefined;
  const monthLabel = month ? new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" }) : "";

  // Fetch fees and previous arrears dynamically from database
  const fetchFeesAndArrears = async () => {
    if (!selectedClass || !month) return;
    setIsFetchingFees(true);
    try {
      const res = await fetch("/api/fees", { headers: authH() as HeadersInit });
      if (!res.ok) throw new Error("Failed to fetch fee records");
      const allFeesList: any[] = await res.json();

      // Filter current month's fees for the students in this class
      const studentIds = new Set(classStudents.map(s => s.id));
      const currentFees = allFeesList.filter(f => f.month === month && studentIds.has(Number(f.studentId)));
      setGeneratedFees(currentFees);

      // Populate local edits state from existing database values if present
      if (currentFees.length > 0) {
        setGenerated(true);
        const initialEdits: Record<number, VoucherEdit> = {};
        currentFees.forEach(f => {
          initialEdits[Number(f.studentId)] = {
            tuitionFee: f.tuitionFee ? String(Number(f.tuitionFee)) : "0",
            examFee: f.examFee ? String(Number(f.examFee)) : "0",
            annualFee: f.annualFee ? String(Number(f.annualFee)) : "0",
            transportFee: f.transportFee ? String(Number(f.transportFee)) : "0",
            arrears: f.arrears ? String(Number(f.arrears)) : "0",
            fine: f.fine ? String(Number(f.fine)) : "0",
            discount: f.discount ? String(Number(f.discount)) : "0",
            note: f.notes || "",
          };
        });
        setEdits(initialEdits);
      } else {
        setGenerated(false);
      }

      // Calculate outstanding previous arrears for each active student
      const arrearsMap: Record<number, number> = {};
      classStudents.forEach(student => {
        const studentPastFees = allFeesList.filter(f => 
          Number(f.studentId) === student.id && 
          f.month < month && 
          (f.status === "unpaid" || f.status === "partial")
        );
        
        const totalArrears = studentPastFees.reduce((sum, f) => {
          const amt = Number(f.amount ?? 0);
          const fine = Number(f.fine ?? 0);
          const disc = Number(f.discount ?? 0);
          const paid = Number(f.paidAmount ?? 0);
          return sum + Math.max(0, amt + fine - disc - paid);
        }, 0);

        arrearsMap[student.id] = totalArrears;
      });

      setPreviousArrearsMap(arrearsMap);
    } catch (err) {
      console.error(err);
    } finally {
      setIsFetchingFees(false);
    }
  };

  // Bulk generate vouchers in database
  const handleGenerateVouchers = async () => {
    if (!selectedClass || !month || !dueDate) return;
    setIsGenerating(true);
    try {
      const genRes = await fetch("/api/fees/generate-vouchers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authH(),
        },
        body: JSON.stringify({
          classId: Number(selectedClass),
          month,
          dueDate,
        }),
      });

      const genData = await genRes.json();
      if (!genRes.ok) {
        throw new Error(genData.error ?? "Failed to generate vouchers in database");
      }

      toast({
        title: "Vouchers Processed",
        description: genData.message || `Successfully processed vouchers for class.`,
      });

      await fetchFeesAndArrears();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error Generating Vouchers",
        description: err.message || "Something went wrong.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch existing fees on select class/month change
  useEffect(() => {
    if (selectedClass && month && allStudents && allStudents.length > 0) {
      fetchFeesAndArrears();
    } else {
      setGenerated(false);
      setGeneratedFees([]);
    }
  }, [selectedClass, month, allStudents]);

  // Inject print styles
  useEffect(() => {
    const el = document.createElement("style"); el.id = "kips-voucher-print";
    el.textContent = PRINT_STYLES; document.head.appendChild(el);
    return () => { document.getElementById("kips-voucher-print")?.remove(); };
  }, []);

  // Load fee structures
  useEffect(() => {
    setFeeStructuresLoading(true);
    fetch("/api/fee-structures", { headers: authH() as HeadersInit })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Record<string, unknown>[]) => setFeeStructures(rows.map(r => ({
        id: Number(r.id), classId: Number(r.classId),
        monthlyFee:   Number(r.monthlyFee   ?? 0),
        admissionFee: Number(r.admissionFee ?? 0),
        examFee:      Number(r.examFee      ?? 0),
        libraryFee:   Number(r.libraryFee   ?? 0),
        transportFee: Number(r.transportFee ?? 0),
      }))))
      .catch(() => setFeeStructures([]))
      .finally(() => setFeeStructuresLoading(false));
  }, []);

  const getEdit = (id: number): VoucherEdit => edits[id] ?? {
    tuitionFee: "0",
    examFee: "0",
    annualFee: "0",
    transportFee: "0",
    arrears: "0",
    fine: "0",
    discount: "0",
    note: ""
  };

  const openEdit = (id: number) => {
    const e = getEdit(id);
    setDraft({ ...e });
    setEditingId(id);
  };

  // Save adjustments to the database
  const saveEdit = async (id: number) => {
    const dbFee = generatedFees.find(f => Number(f.studentId) === id);
    if (!dbFee) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Fee record not found in database. Please generate first.",
      });
      return;
    }

    try {
      const res = await fetch(`/api/fees/${dbFee.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authH(),
        },
        body: JSON.stringify({
          tuitionFee: Number(draft.tuitionFee || 0),
          examFee: Number(draft.examFee || 0),
          annualFee: Number(draft.annualFee || 0),
          transportFee: Number(draft.transportFee || 0),
          arrears: Number(draft.arrears || 0),
          fine: Number(draft.fine || 0),
          discount: Number(draft.discount || 0),
          notes: draft.note || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save adjustments in database");
      }

      const updatedFee = await res.json();
      setGeneratedFees(prev => prev.map(f => f.id === updatedFee.id ? updatedFee : f));
      setEdits(prev => ({ ...prev, [id]: { ...draft } }));
      setEditingId(null);
      
      toast({
        title: "Voucher Saved",
        description: "Voucher details and total amount have been successfully updated in database.",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err.message || "Failed to update record.",
      });
    }
  };

  const calcTotal = (id: number) => {
    const e = getEdit(id);
    const tuition = Number(e.tuitionFee || 0);
    const exam = Number(e.examFee || 0);
    const annual = Number(e.annualFee || 0);
    const transport = Number(e.transportFee || 0);
    const arrears = Number(e.arrears || 0);
    const fine = Number(e.fine || 0);
    const disc = Number(e.discount || 0);
    return Math.max(0, tuition + exam + annual + transport + arrears + fine - disc);
  };

  const makeVoucherNo = (admNo: string, idx: number) =>
    `${month.replace("-", "")}-${String(admNo).split("-").pop()}-${String(idx + 1).padStart(3, "0")}`;

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          </div>

          {/* Fee structure preview */}
          {selectedClass && (
            <div className={`p-3 rounded-lg border text-sm ${selectedFeeStructure ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-300"}`}>
              {feeStructuresLoading ? (
                <p className="text-blue-600">Loading fee structure…</p>
              ) : selectedFeeStructure ? (
                <div className="flex flex-wrap gap-x-6 gap-y-1">
                  <span className="font-semibold text-blue-800">Fee Structure — {selectedClassName}:</span>
                  {selectedFeeStructure.monthlyFee > 0   && <span className="text-gray-700">Monthly: <strong>PKR {selectedFeeStructure.monthlyFee.toLocaleString()}</strong></span>}
                  {selectedFeeStructure.examFee > 0      && <span className="text-gray-700">Exam: <strong>PKR {selectedFeeStructure.examFee.toLocaleString()}</strong></span>}
                  {selectedFeeStructure.libraryFee > 0   && <span className="text-gray-700">Annual: <strong>PKR {selectedFeeStructure.libraryFee.toLocaleString()}</strong></span>}
                  {selectedFeeStructure.transportFee > 0 && <span className="text-gray-700">Transport: <strong>PKR {selectedFeeStructure.transportFee.toLocaleString()}</strong></span>}
                  <span className="font-bold text-emerald-700">Total: PKR {(selectedFeeStructure.monthlyFee + selectedFeeStructure.examFee + selectedFeeStructure.libraryFee + selectedFeeStructure.transportFee).toLocaleString()}/student</span>
                </div>
              ) : (
                <p className="text-amber-700">⚠️ No fee structure set for this class. Please go to <strong>Fee Structure</strong> page first.</p>
              )}
            </div>
          )}

          <div className="flex gap-3 flex-wrap items-center">
            <Button
              disabled={!selectedClass || !month || !dueDate || isGenerating || isFetchingFees}
              onClick={handleGenerateVouchers}
              className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white hover:from-blue-800 hover:to-indigo-800"
            >
              {isGenerating ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <GraduationCap className="w-4 h-4 mr-2" />
              )}
              {isGenerating ? "Generating in Database..." : `Generate Vouchers (${classStudents.length} students)`}
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
          <p className="font-medium">No active students in this class</p>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit Fee Voucher Details</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Monthly Tuition Fee (PKR)</label>
                <Input type="number" min="0" placeholder="0" value={draft.tuitionFee}
                  onChange={e => setDraft(d => ({ ...d, tuitionFee: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Exam / Test Fee (PKR)</label>
                <Input type="number" min="0" placeholder="0" value={draft.examFee}
                  onChange={e => setDraft(d => ({ ...d, examFee: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Annual Charges (PKR)</label>
                <Input type="number" min="0" placeholder="0" value={draft.annualFee}
                  onChange={e => setDraft(d => ({ ...d, annualFee: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Transport Fee (PKR)</label>
                <Input type="number" min="0" placeholder="0" value={draft.transportFee}
                  onChange={e => setDraft(d => ({ ...d, transportFee: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Previous Arrears (PKR)</label>
                <Input type="number" min="0" placeholder="0" value={draft.arrears}
                  onChange={e => setDraft(d => ({ ...d, arrears: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 block mb-1">Fine / Late Fee (PKR)</label>
                <Input type="number" min="0" placeholder="0" value={draft.fine}
                  onChange={e => setDraft(d => ({ ...d, fine: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Discount / Concession (PKR)</label>
              <Input type="number" min="0" placeholder="0" value={draft.discount}
                onChange={e => setDraft(d => ({ ...d, discount: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 block mb-1">Note (optional)</label>
              <Input placeholder="e.g. Sibling discount" value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={() => editingId !== null && saveEdit(editingId)}
                className="bg-indigo-700 hover:bg-indigo-800 text-white">
                <Check className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Voucher List (Screen Preview) ── */}
      {generated && classStudents.length > 0 && (
        <div className="no-print space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              {classStudents.length} Vouchers — {selectedClassName} — {monthLabel}
            </p>
          </div>

          {classStudents.map((student, idx) => {
            const e = getEdit(student.id);
            const tuition = Number(e.tuitionFee || 0);
            const exam = Number(e.examFee || 0);
            const annual = Number(e.annualFee || 0);
            const transport = Number(e.transportFee || 0);
            const arrears = Number(e.arrears || 0);
            const fine = Number(e.fine || 0);
            const disc = Number(e.discount || 0);
            const total = calcTotal(student.id);

            const hasEdits = e.fine !== "0" || e.discount !== "0" || e.note !== "" || e.tuitionFee !== "0" || e.arrears !== "0";

            return (
              <Card key={student.id} className="border-2 border-gray-200 hover:border-blue-300 transition-colors">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    {/* Student info */}
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}>
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900">{student.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {student.admissionNumber} · {selectedClassName}{student.section ? ` / ${student.section}` : ""}
                        </p>
                        {student.fatherName && <p className="text-xs text-gray-400">s/o {student.fatherName}</p>}
                      </div>
                    </div>

                    {/* Fee breakdown */}
                    <div className="text-right shrink-0">
                      <div className="space-y-0.5 text-xs text-gray-500">
                        {tuition   > 0 && <div>Tuition: PKR {tuition.toLocaleString()}</div>}
                        {exam      > 0 && <div>Exam: PKR {exam.toLocaleString()}</div>}
                        {annual    > 0 && <div>Annual: PKR {annual.toLocaleString()}</div>}
                        {transport > 0 && <div>Transport: PKR {transport.toLocaleString()}</div>}
                        {arrears   > 0 && <div className="text-orange-600 font-semibold animate-pulse">Arrears: +PKR {arrears.toLocaleString()}</div>}
                        {fine      > 0 && <div className="text-red-500">Fine: +PKR {fine.toLocaleString()}</div>}
                        {disc      > 0 && <div className="text-emerald-600">Disc: −PKR {disc.toLocaleString()}</div>}
                      </div>
                      <p className="text-lg font-black mt-1" style={{ color: NAVY }}>PKR {total.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">Due: {dueDate}</p>
                    </div>

                    {/* Edit button */}
                    <button onClick={() => openEdit(student.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${hasEdits ? "bg-amber-50 text-amber-700 border-amber-300" : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"}`}>
                      <Pencil className="w-3.5 h-3.5" />
                      {hasEdits ? "Customized" : "Adjust"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Print-only vouchers (two copies per student) ── */}
      {generated && classStudents.length > 0 && createPortal(
        <div id="kips-voucher-print" style={{ display: "none", fontFamily: "Arial, sans-serif" }}>
          {classStudents.map((student, idx) => {
            const e = getEdit(student.id);
            const total = calcTotal(student.id);
            const voucherNo = makeVoucherNo(student.admissionNumber, idx);

            return (
              <div key={student.id} className="voucher-pair">
                {/* School Copy */}
                <VoucherCopy
                  copyLabel="School Copy"
                  student={student}
                  selectedClassName={selectedClassName}
                  monthLabel={monthLabel}
                  dueDate={dueDate}
                  voucherNo={voucherNo}
                  edit={e}
                  total={total}
                />

                {/* Cut line */}
                <div className="cut-line">
                  ✂ &nbsp; Cut Here &nbsp; ✂
                </div>

                {/* Parent Copy */}
                <VoucherCopy
                  copyLabel="Parent / Guardian Copy"
                  student={student}
                  selectedClassName={selectedClassName}
                  monthLabel={monthLabel}
                  dueDate={dueDate}
                  voucherNo={voucherNo}
                  edit={e}
                  total={total}
                />
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
