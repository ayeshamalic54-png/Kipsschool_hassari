import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useListStudents, useListClasses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ReceiptText, Printer, Pencil, Check, GraduationCap,
  Save, Loader2, CheckCircle2, AlertTriangle, Trash2, MessageCircle,
  Play, Square, Wifi, WifiOff, RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

// ── Print CSS ─────────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 6mm 8mm; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body > *:not(#kips-voucher-print) { display: none !important; }
    body { margin: 0; padding: 0; background: white; }
    #kips-voucher-print { display: block !important; }
    .voucher-pair { page-break-inside: avoid; page-break-after: always; }
    .voucher-pair:last-child { page-break-after: avoid; }
    .voucher-copy {
      border: 1.5px solid #374151;
      padding: 8mm 10mm; box-sizing: border-box;
      font-family: Arial, sans-serif; font-size: 9.5pt;
    }
    .cut-line {
      border-top: 1.5px dashed #9ca3af; margin: 3mm 0;
      text-align: center; font-size: 8pt; color: #9ca3af; line-height: 1;
    }
  }
`;

const NAVY   = "#1a2a5e";
const ORANGE = "#e07b1a";

// ── Types ─────────────────────────────────────────────────────────────────────
interface VoucherEdit {
  feeOverride: string; // monthly tuition
  examOverride: string;
  annualOverride: string;
  transportOverride: string;
  admissionOverride: string;
  arrears:     string;
  fine:        string;
  discount:    string;
  note:        string;
}

interface FeeStructure {
  id:          number;
  classId:     number;
  monthlyFee:  number;
  admissionFee:number;
  examFee:     number;
  libraryFee:  number;
  transportFee:number;
  Arrears:     number;
}

interface FeeRecord {
  id:              number;
  studentId:       number;
  classId:         number | null;
  month:           string;
  amount:          number;
  paidAmount:      number;
  remainingAmount: number;
  status:          string;
}

function getToken(): string {
  return localStorage.getItem("token") ?? localStorage.getItem("kips_token") ?? "";
}
function authH(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ── Single Voucher Copy ───────────────────────────────────────────────────────
// All fee components (monthly + exam + annual + transport + arrears + fine − discount)
// are shown as rows in ONE combined table inside a single voucher.
function VoucherCopy({
  copyLabel, student, selectedClassName, monthLabel, dueDate,
  voucherNo, structure, edit, fine, disc, total, monthlyFeeToUse,
  examFeeToUse, annualFeeToUse, transportFeeToUse, admissionFeeToUse,
  previousArrears, manualArrears, selectedFees,
}: {
  copyLabel:        string;
  student:          { name: string; admissionNumber: string; fatherName?: string | null; section?: string | null };
  selectedClassName:string;
  monthLabel:       string;
  dueDate:          string;
  voucherNo:        string;
  structure?:       FeeStructure;
  edit:             VoucherEdit;
  fine:             number;
  disc:             number;
  total:            number;
  monthlyFeeToUse:  number;
  examFeeToUse:     number;
  annualFeeToUse:   number;
  transportFeeToUse:number;
  admissionFeeToUse:number;
  previousArrears:  number;
  manualArrears:    number;
  selectedFees:     { monthly: boolean; exam: boolean; annual: boolean; transport: boolean; previous: boolean; admission: boolean };
}) {
  const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

  // ALL fee components combined into one list — single voucher
  const feeRows: { label: string; amount: number; color?: string; prefix?: string }[] = [];
  if (selectedFees.monthly && monthlyFeeToUse  > 0) feeRows.push({ label: "Monthly Tuition Fee",     amount: monthlyFeeToUse  });
  if (selectedFees.admission && admissionFeeToUse > 0) feeRows.push({ label: "Admission Fee", amount: admissionFeeToUse, color: "#059669" });
  if (selectedFees.exam && examFeeToUse > 0) feeRows.push({ label: "Exam / Test Fee", amount: examFeeToUse, color: "#7c3aed" });
  if (selectedFees.annual && annualFeeToUse > 0) feeRows.push({ label: "Annual Charges", amount: annualFeeToUse, color: "#0369a1" });
  if (selectedFees.transport && transportFeeToUse > 0) feeRows.push({ label: "Transport Fee", amount: transportFeeToUse, color: "#0891b2" });
  if (selectedFees.previous && previousArrears > 0) feeRows.push({ label: "Previous Arrears (Auto)",  amount: previousArrears,  color: "#dc2626" });
  if (manualArrears   > 0) feeRows.push({ label: "Additional Arrears",       amount: manualArrears,    color: "#b91c1c" });
  if (fine            > 0) feeRows.push({ label: "Late Fine",                amount: fine,             color: "#dc2626" });
  if (disc            > 0) feeRows.push({ label: edit.note || "Discount / Concession", amount: disc, color: "#059669", prefix: "−" });

  const thStyle: React.CSSProperties = { background: NAVY, color: "#fff", padding: "5px 8px", textAlign: "left", fontSize: 9, fontWeight: 700 };
  const tdStyle  = (alt: boolean): React.CSSProperties => ({ padding: "4px 8px", borderBottom: "1px solid #e5e7eb", fontSize: 9.5, background: alt ? "#f3f4f6" : "#fff" });
  const tdRStyle = (alt: boolean, color?: string): React.CSSProperties => ({ ...tdStyle(alt), textAlign: "right", fontWeight: 600, color: color ?? "#111827" });

  return (
    <div className="voucher-copy" style={{ border: "1.5px solid #374151", padding: "8mm 10mm", fontFamily: "Arial, sans-serif", fontSize: "9.5pt", boxSizing: "border-box" }}>
      {/* Copy label */}
      <div style={{ display: "inline-block", fontSize: 8, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", border: `1px dashed ${copyLabel === "School Copy" ? "#374151" : ORANGE}`, borderRadius: 3, padding: "1px 7px", color: copyLabel === "School Copy" ? "#374151" : ORANGE, marginBottom: 5 }}>{copyLabel}</div>

      {/* School header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, borderBottom: `2px solid ${NAVY}`, paddingBottom: 8, marginBottom: 10 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 46, height: 46, objectFit: "cover", borderRadius: "50%", border: `2px solid ${ORANGE}` }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: NAVY, lineHeight: 1.2 }}>KIPS School Hassari</div>
          <div style={{ fontSize: 9, color: ORANGE, fontWeight: 700, marginTop: 1 }}>Bright Future — Fee Voucher</div>
          <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 1 }}>Issue Date: {printDate}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 8, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5 }}>Voucher No.</div>
          <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 10, color: NAVY }}>{voucherNo}</div>
          <div style={{ fontSize: 8, color: "#9ca3af", marginTop: 2 }}>Month: {monthLabel}</div>
        </div>
      </div>

      {/* Student info */}
      <div style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "7px 10px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 20px", marginBottom: 8, background: "#f9fafb", fontSize: 9.5 }}>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Student Name:</span><span style={{ fontWeight: 700, color: "#111827" }}>{student.name}</span></div>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Class / Section:</span><span style={{ fontWeight: 700, color: "#111827" }}>{selectedClassName}{student.section ? ` / ${student.section}` : ""}</span></div>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Admission No.:</span><span style={{ fontWeight: 700, color: "#7c3aed", fontFamily: "monospace" }}>{student.admissionNumber}</span></div>
        <div style={{ display: "flex", gap: 4 }}><span style={{ color: "#6b7280", minWidth: 90, flexShrink: 0 }}>Father Name:</span><span style={{ fontWeight: 700, color: "#111827" }}>{student.fatherName ?? "—"}</span></div>
      </div>

      {/* ── FEE TABLE — all components combined in ONE table ── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 6 }}>
        <thead>
          <tr>
            <th style={thStyle}>Fee Description</th>
            <th style={{ ...thStyle, textAlign: "right" }}>Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          {feeRows.length === 0 ? (
            <tr><td colSpan={2} style={{ ...tdStyle(false), textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No fee structure configured for this class</td></tr>
          ) : feeRows.map((row, i) => (
            <tr key={row.label}>
              <td style={tdStyle(i % 2 === 1)}>{row.label}</td>
              <td style={tdRStyle(i % 2 === 1, row.color)}>
                {row.prefix ?? ""}{row.amount.toLocaleString()}
              </td>
            </tr>
          ))}
          {/* Extra note row (when note provided but no discount) */}
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

      {/* Due date notice */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8.5, color: "#6b7280", marginBottom: 10, background: "#fef3c7", border: "1px solid #fbbf24", borderRadius: 4, padding: "4px 8px" }}>
        <span>Due Date: <strong style={{ color: "#92400e" }}>{dueDate}</strong></span>
        <span style={{ color: "#92400e" }}>Please pay before the due date to avoid late fine</span>
      </div>

      {/* Signature line */}
      <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #d1d5db", marginTop: 10, paddingTop: 8, fontSize: 8.5, color: "#6b7280" }}>
        {["Parent / Guardian Signature", "Cashier Signature", "School Stamp / Principal"].map(label => (
          <div key={label} style={{ textAlign: "center", minWidth: 120 }}>
            <div style={{ borderBottom: "1px solid #374151", marginBottom: 3, height: 18 }} />
            <div>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const getClassRank = (name: string): number => {
  const n = name.toLowerCase().trim();
  if (n.includes("play") || n.includes("pg")) return 1;
  if (n.includes("nursery") || n.includes("nur")) return 2;
  if (n.includes("prep")) return 3;
  
  const match = n.match(/\d+/);
  if (match) {
    return 3 + parseInt(match[0], 10);
  }
  return 100;
};

const getVoucherEnglishTemplate = (studentName: string, className: string, month: string, amount: number, dueDate: string) => {
  return `Assalam u Alaikum! 🌟\n\nKIPS School Hassari has generated a fee voucher for your child *${studentName}* (Class: ${className}) for the month of *${month}*.\n\n💵 Total Payable: *PKR ${amount.toLocaleString()}*\n📅 Due Date: *${dueDate}*\n\nKindly make the payment before the due date to avoid a late fine. Thank you! 🙏\nKIPS School Hassari`;
};

const getVoucherUrduTemplate = (studentName: string, className: string, month: string, amount: number, dueDate: string) => {
  return `السلام علیکم! 🌟\n\nکیپس سکول ہساری کی طرف سے آپ کے بچے/بچی *${studentName}* (کلاس: ${className}) کا ماہ *${month}* کا فیس واؤچر تیار کر دیا گیا ہے۔\n\n💵 کل قابلِ ادا رقم: *PKR ${amount.toLocaleString()}*\n📅 آخری تاریخ: *${dueDate}*\n\nبرائے مہربانی جرمانے سے بچنے کے لیے فیس آخری تاریخ سے پہلے جمع کروائیں۔\n\nشکریہ! 🙏\nکیپس سکول ہساری`;
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FeeVoucher() {
  const [selectedClass, setSelectedClass] = useState("");
  // WhatsApp post-save states
  const [showWaPrompt, setShowWaPrompt] = useState(false);
  const [waQueueOpen, setWaQueueOpen] = useState(false);
  const [waQueueIndex, setWaQueueIndex] = useState(0);
  const [waSentIds, setWaSentIds] = useState<Record<number, boolean>>({});
  const [waLanguage, setWaLanguage] = useState<"urdu" | "english">("urdu");
  const [waMessageText, setWaMessageText] = useState("");
  
  // WhatsApp automatic sending states
  const [waStatus, setWaStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
  const [waQr, setWaQr] = useState<string | null>(null);
  const [sendMode, setSendMode] = useState<"auto" | "manual">("auto");
  const [autoProgress, setAutoProgress] = useState<{
    sending: boolean;
    total: number;
    sent: number;
    failed: number;
    errors: string[];
  }>({ sending: false, total: 0, sent: 0, failed: 0, errors: [] });
  const [month,         setMonth]         = useState(new Date().toISOString().slice(0, 7));
  const [dueDate,       setDueDate]       = useState(() => {
    const d = new Date(); d.setDate(10); return d.toISOString().slice(0, 10);
  });
  const [generated,     setGenerated]     = useState(false);
  const [edits,         setEdits]         = useState<Record<number, VoucherEdit>>({});
  const [editingId,     setEditingId]     = useState<number | null>(null);
  const [draft,         setDraft]         = useState<VoucherEdit>({ feeOverride: "", examOverride: "", annualOverride: "", transportOverride: "", admissionOverride: "", arrears: "", fine: "", discount: "", note: "" });
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [allFeeRecords, setAllFeeRecords] = useState<FeeRecord[]>([]);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [deleting,      setDeleting]      = useState(false);
  const [selectedFees,  setSelectedFees]  = useState({
    monthly: true,
    exam: true,
    annual: true,
    transport: true,
    previous: true,
    admission: false,
  });

  const { data: classes }     = useListClasses();
  const { data: allStudents } = useListStudents({});
  const { toast } = useToast();

  const feeStructureMap   = Object.fromEntries(feeStructures.map(f => [f.classId, f]));
  const selectedStructure = selectedClass ? feeStructureMap[Number(selectedClass)] : undefined;
  const classStudents     = allStudents?.filter(s => String(s.classId) === selectedClass && s.status === "active") ?? [];
  const selectedClassName = classes?.find(c => String(c.id) === selectedClass)?.name ?? "";
  const monthLabel        = month ? new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" }) : "";

  useEffect(() => {
    if (selectedStructure) {
      setSelectedFees({
        monthly: selectedStructure.monthlyFee > 0,
        exam: selectedStructure.examFee > 0,
        annual: selectedStructure.libraryFee > 0,
        transport: selectedStructure.transportFee > 0,
        previous: true,
        admission: selectedStructure.admissionFee > 0,
      });
    } else {
      setSelectedFees({
        monthly: true,
        exam: true,
        annual: true,
        transport: true,
        previous: true,
        admission: false,
      });
    }
  }, [selectedClass, selectedStructure]);

  // ── Duplicate warning state ────────────────────────────────────────────────
  // existingForMonth = fee records already saved for selected class + month
  const [existingForMonth,    setExistingForMonth]    = useState<FeeRecord[]>([]);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [checkingDuplicate,   setCheckingDuplicate]   = useState(false);



  const sortedClasses = classes
    ? [...classes].sort((a, b) => getClassRank(a.name) - getClassRank(b.name))
    : [];

  // Inject print CSS
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "kips-voucher-print";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-voucher-print")?.remove(); };
  }, []);

  // Load fee structures
  useEffect(() => {
    fetch("/api/fee-structures", { headers: authH() })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Record<string, unknown>[]) => setFeeStructures(rows.map(r => ({
        id:          Number(r.id),
        classId:     Number(r.classId),
        monthlyFee:  Number(r.monthlyFee   ?? 0),
        admissionFee:Number(r.admissionFee ?? 0),
        examFee:     Number(r.examFee      ?? 0),
        libraryFee:  Number(r.libraryFee   ?? 0),
        transportFee:Number(r.transportFee ?? 0),
        Arrears:     Number(r.Arrears      ?? 0),
      }))))
      .catch(() => setFeeStructures([]));
  }, []);

  // Load all fee records (for arrears auto-calc + duplicate detection)
  const loadFeeRecords = useCallback(() => {
    fetch("/api/fees", { headers: authH() })
      .then(r => r.ok ? r.json() : [])
      .then((rows: Record<string, unknown>[]) => setAllFeeRecords(rows.map(r => ({
        id:              Number(r.id),
        studentId:       Number(r.studentId),
        classId:         r.classId != null ? Number(r.classId) : null,
        month:           String(r.month ?? ""),
        amount:          Number(r.amount ?? 0),
        paidAmount:      Number(r.paidAmount ?? 0),
        remainingAmount: Number(r.remainingAmount ?? 0),
        status:          String(r.status ?? ""),
      }))))
      .catch(() => setAllFeeRecords([]));
  }, []);

  useEffect(() => { loadFeeRecords(); }, [loadFeeRecords]);

  // Synchronize WhatsApp message text
  useEffect(() => {
    if (waQueueOpen && waQueueIndex < classStudents.length) {
      const student = classStudents[waQueueIndex];
      const structure = student.classId ? feeStructureMap[student.classId] : undefined;
      const total = calcTotal(student.id, structure);
      
      const text = waLanguage === "urdu"
        ? getVoucherUrduTemplate(student.name, selectedClassName, monthLabel, total, dueDate)
        : getVoucherEnglishTemplate(student.name, selectedClassName, monthLabel, total, dueDate);
      
      setWaMessageText(text);
    }
  }, [waQueueOpen, waQueueIndex, waLanguage, classStudents, selectedClassName, monthLabel, dueDate]);

  // WhatsApp Status check & updates
  const checkWhatsAppStatus = async () => {
    try {
      const res = await fetch("/api/whatsapp/status", { headers: authH() });
      if (res.ok) {
        const data = await res.json() as { status: "connected" | "connecting" | "disconnected"; qr: string | null };
        setWaStatus(data.status);
        setWaQr(data.qr);
        if (data.status === "connected") {
          setSendMode("auto");
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const triggerConnect = async () => {
    try {
      setWaStatus("connecting");
      await fetch("/api/whatsapp/connect", { method: "POST", headers: authH() });
      checkWhatsAppStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const triggerDisconnect = async () => {
    if (!confirm("Logout from WhatsApp connection?")) return;
    try {
      await fetch("/api/whatsapp/disconnect", { method: "POST", headers: authH() });
      checkWhatsAppStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartAutoSending = async () => {
    if (waStatus !== "connected") return;
    
    const payload = classStudents.map(student => {
      const structure = student.classId ? feeStructureMap[student.classId] : undefined;
      const total = calcTotal(student.id, structure);
      const text = waLanguage === "urdu"
        ? getVoucherUrduTemplate(student.name, selectedClassName, monthLabel, total, dueDate)
        : getVoucherEnglishTemplate(student.name, selectedClassName, monthLabel, total, dueDate);
      
      return {
        phone: student.phone ?? "",
        message: text,
        studentName: student.name
      };
    });

    try {
      await fetch("/api/whatsapp/send-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body: JSON.stringify({ messages: payload })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleStopAutoSending = async () => {
    try {
      await fetch("/api/whatsapp/stop-bulk", { method: "POST", headers: authH() });
    } catch (e) {
      console.error(e);
    }
  };

  // Poll status & bulk progress when bulk sending dialogue is open
  useEffect(() => {
    if (!waQueueOpen) return;
    checkWhatsAppStatus();
    
    const interval = setInterval(async () => {
      await checkWhatsAppStatus();
      try {
        const res = await fetch("/api/whatsapp/bulk-progress", { headers: authH() });
        if (res.ok) {
          const data = await res.json() as typeof autoProgress;
          setAutoProgress(data);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [waQueueOpen]);


  const getEdit = (id: number): VoucherEdit =>
    edits[id] ?? { feeOverride: "", examOverride: "", annualOverride: "", transportOverride: "", arrears: "", fine: "", discount: "", note: "" };

  // Auto-calculate previous arrears for a student
  const getPreviousArrears = useCallback((studentId: number): number => {
    return allFeeRecords
      .filter(f =>
        f.studentId === studentId &&
        f.month < month &&
        (f.status === "unpaid" || f.status === "partial") &&
        f.remainingAmount > 0
      )
      .reduce((sum, f) => sum + f.remainingAmount, 0);
  }, [allFeeRecords, month]);

  const getMonthlyFee = (studentId: number, structure?: FeeStructure): number => {
    const e = getEdit(studentId);
    return (e.feeOverride && Number(e.feeOverride) > 0) ? Number(e.feeOverride) : (structure?.monthlyFee ?? 0);
  };

  const getExamFee = (studentId: number, structure?: FeeStructure): number => {
    const e = getEdit(studentId);
    return (e.examOverride && Number(e.examOverride) > 0) ? Number(e.examOverride) : (structure?.examFee ?? 0);
  };

  const getAnnualFee = (studentId: number, structure?: FeeStructure): number => {
    const e = getEdit(studentId);
    return (e.annualOverride && Number(e.annualOverride) > 0) ? Number(e.annualOverride) : (structure?.libraryFee ?? 0);
  };

  const getTransportFee = (studentId: number, structure?: FeeStructure): number => {
    const e = getEdit(studentId);
    return (e.transportOverride && Number(e.transportOverride) > 0) ? Number(e.transportOverride) : (structure?.transportFee ?? 0);
  };

  const getAdmissionFee = (studentId: number, structure?: FeeStructure): number => {
    const e = getEdit(studentId);
    return (e.admissionOverride && Number(e.admissionOverride) > 0) ? Number(e.admissionOverride) : (structure?.admissionFee ?? 0);
  };

  const calcTotal = (studentId: number, structure?: FeeStructure): number => {
    const e             = getEdit(studentId);
    const monthly       = selectedFees.monthly ? getMonthlyFee(studentId, structure) : 0;
    const exam          = selectedFees.exam ? getExamFee(studentId, structure) : 0;
    const library       = selectedFees.annual ? getAnnualFee(studentId, structure) : 0;
    const transport     = selectedFees.transport ? getTransportFee(studentId, structure) : 0;
    const admission     = selectedFees.admission ? getAdmissionFee(studentId, structure) : 0;
    const fine          = Number(e.fine     || 0);
    const disc          = Number(e.discount || 0);
    const structArrears = selectedFees.previous ? (structure?.Arrears ?? 0) : 0;
    const autoArrears   = selectedFees.previous ? getPreviousArrears(studentId) : 0;
    const manualArrears = Number(e.arrears  || 0);
    return Math.max(0, monthly + exam + library + transport + admission + fine + structArrears + autoArrears + manualArrears - disc);
  };

  const makeVoucherNo = (admNo: string, idx: number) =>
    `${month.replace("-", "")}-${String(admNo).split("-").pop()}-${String(idx + 1).padStart(3, "0")}`;

  const openEdit = (id: number) => {
    const e = getEdit(id);
    setDraft({ 
      feeOverride: e.feeOverride, 
      examOverride: e.examOverride,
      annualOverride: e.annualOverride,
      transportOverride: e.transportOverride,
      admissionOverride: e.admissionOverride || "",
      arrears: e.arrears, 
      fine: e.fine, 
      discount: e.discount, 
      note: e.note 
    });
    setEditingId(id);
  };
  const saveEdit = (id: number) => {
    setEdits(prev => ({ ...prev, [id]: { ...draft } }));
    setEditingId(null);
  };

  // ── Duplicate check before generating ────────────────────────────────────
  const handleGenerateClick = useCallback(async () => {
    if (!selectedClass || !month) return;
    setCheckingDuplicate(true);

    try {
      // Re-fetch latest fee records to get fresh data
      const res = await fetch("/api/fees", { headers: authH() });
      const rows: Record<string, unknown>[] = res.ok ? await res.json() : [];
      const fresh: FeeRecord[] = rows.map(r => ({
        id:              Number(r.id),
        studentId:       Number(r.studentId),
        classId:         r.classId != null ? Number(r.classId) : null,
        month:           String(r.month ?? ""),
        amount:          Number(r.amount ?? 0),
        paidAmount:      Number(r.paidAmount ?? 0),
        remainingAmount: Number(r.remainingAmount ?? 0),
        status:          String(r.status ?? ""),
      }));
      setAllFeeRecords(fresh);

      // Check: any records for this class + month already?
      const existing = fresh.filter(
        f => String(f.classId) === selectedClass && f.month === month
      );

      if (existing.length > 0) {
        setExistingForMonth(existing);
        setDuplicateDialogOpen(true);
        return;
      }

      // No duplicates — proceed
      setEdits({});
      setSaved(false);
      setGenerated(true);
    } finally {
      setCheckingDuplicate(false);
    }
  }, [selectedClass, month]);

  const handleDeleteExisting = async () => {
    if (existingForMonth.length === 0) return;
    setDeleting(true);
    try {
      await Promise.all(
        existingForMonth.map(async (record) => {
          const res = await fetch(`/api/fees/${record.id}`, {
            method: "DELETE",
            headers: authH(),
          });
          if (!res.ok) {
            throw new Error(`Failed to delete record ID ${record.id}`);
          }
        })
      );
      
      toast({ 
        title: "Vouchers deleted", 
        description: `Successfully removed ${existingForMonth.length} existing records for ${monthLabel}.` 
      });
      
      setDuplicateDialogOpen(false);
      setExistingForMonth([]);
      setEdits({});
      setSaved(false);
      setGenerated(true);
      loadFeeRecords();
    } catch (err: unknown) {
      toast({ 
        variant: "destructive", 
        title: "Delete failed", 
        description: String((err as Error).message) 
      });
    } finally {
      setDeleting(false);
    }
  };

  // ── Save to database ──────────────────────────────────────────────────────
  const handleSaveToDatabase = async () => {
    if (!selectedClass || !month || classStudents.length === 0) return;
    setSaving(true);
    try {
      const studentsPayload = classStudents.map(student => {
        const structure = student.classId ? feeStructureMap[student.classId] : undefined;
        const e         = getEdit(student.id);
        const monthly   = selectedFees.monthly ? getMonthlyFee(student.id, structure) : 0;
        const exam      = selectedFees.exam ? getExamFee(student.id, structure) : 0;
        const annual    = selectedFees.annual ? getAnnualFee(student.id, structure) : 0;
        const transport = selectedFees.transport ? getTransportFee(student.id, structure) : 0;
        const arrears   = selectedFees.previous ? (getPreviousArrears(student.id) + (structure?.Arrears ?? 0)) : 0;
        const extraArrears = Number(e.arrears || 0);

        return {
          studentId:    student.id,
          amount:       calcTotal(student.id, structure),
          fine:         Number(e.fine     || 0),
          discount:     Number(e.discount || 0),
          tuitionFee:   monthly,
          examFee:      exam,
          annualFee:    annual,
          transportFee: transport,
          arrears:      arrears + extraArrears,
          note:         e.note || null,
        };
      });

      const res = await fetch("/api/fee-vouchers/generate", {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authH() },
        body:    JSON.stringify({ classId: Number(selectedClass), month, dueDate, students: studentsPayload }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as Record<string, string>).error ?? `HTTP ${res.status}`);
      }

      const data = await res.json() as { created: number; skipped: number };
      setSaved(true);
      toast({ title: "Fee records saved", description: `${data.created} records created${data.skipped > 0 ? `, ${data.skipped} skipped (already exist)` : ""}.` });
      loadFeeRecords();
      setShowWaPrompt(true);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Save failed", description: String((e as Error).message) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">

      {/* ── Header ── */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="w-6 h-6 text-teal-600" /> Fee Voucher
          </h1>
          <p className="text-gray-500 text-sm mt-1">Generate class-wise fee vouchers — Parent &amp; School copies</p>
        </div>
      </div>

      {/* ── Controls ── */}
      <Card className="no-print">
        <CardContent className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Select Class *</label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setGenerated(false); setEdits({}); setSaved(false); setExistingForMonth([]); }}>
                <SelectTrigger><SelectValue placeholder="Choose class..." /></SelectTrigger>
                <SelectContent>
                  {sortedClasses.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Month *</label>
              <Input type="month" value={month} onChange={e => { setMonth(e.target.value); setGenerated(false); setSaved(false); setExistingForMonth([]); }} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Due Date</label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* Fee structure quick-view */}
          {selectedClass && (
            <div className={`p-4 rounded-xl border text-sm ${selectedStructure ? "bg-blue-50 border-blue-200" : "bg-amber-50 border-amber-300"}`}>
              {selectedStructure ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-blue-900">Select Fees to Include for Vouchers:</span>
                    <span className="text-xs text-blue-700 italic">Uncheck any fee you want to exclude from this batch of vouchers</span>
                  </div>
                  
                  <div className="flex flex-wrap gap-x-6 gap-y-3 items-center bg-white p-3 rounded-lg border border-blue-100">
                    {selectedStructure.monthlyFee > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:text-gray-900 font-medium">
                        <Checkbox 
                          checked={selectedFees.monthly} 
                          onCheckedChange={(checked) => setSelectedFees(prev => ({ ...prev, monthly: !!checked }))}
                        />
                        <span>Monthly Fee (PKR {selectedStructure.monthlyFee.toLocaleString()})</span>
                      </label>
                    )}
                    
                    {selectedStructure.examFee > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:text-gray-900 font-medium">
                        <Checkbox 
                          checked={selectedFees.exam} 
                          onCheckedChange={(checked) => setSelectedFees(prev => ({ ...prev, exam: !!checked }))}
                        />
                        <span>Exam Fee (PKR {selectedStructure.examFee.toLocaleString()})</span>
                      </label>
                    )}
                    
                    {selectedStructure.libraryFee > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:text-gray-900 font-medium">
                        <Checkbox 
                          checked={selectedFees.annual} 
                          onCheckedChange={(checked) => setSelectedFees(prev => ({ ...prev, annual: !!checked }))}
                        />
                        <span>Annual Charges (PKR {selectedStructure.libraryFee.toLocaleString()})</span>
                      </label>
                    )}
                    
                    {selectedStructure.transportFee > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:text-gray-900 font-medium">
                        <Checkbox 
                          checked={selectedFees.transport} 
                          onCheckedChange={(checked) => setSelectedFees(prev => ({ ...prev, transport: !!checked }))}
                        />
                        <span>Transport Fee (PKR {selectedStructure.transportFee.toLocaleString()})</span>
                      </label>
                    )}

                    {selectedStructure.admissionFee > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-gray-700 hover:text-gray-900 font-medium">
                        <Checkbox 
                          checked={selectedFees.admission} 
                          onCheckedChange={(checked) => setSelectedFees(prev => ({ ...prev, admission: !!checked }))}
                        />
                        <span>Admission Fee (PKR {selectedStructure.admissionFee.toLocaleString()})</span>
                      </label>
                    )}

                    {selectedStructure.Arrears > 0 && (
                      <label className="flex items-center gap-2 cursor-pointer select-none text-red-700 hover:text-red-900 font-medium">
                        <Checkbox 
                          checked={selectedFees.previous} 
                          onCheckedChange={(checked) => setSelectedFees(prev => ({ ...prev, previous: !!checked }))}
                        />
                        <span>Previous Arrears (PKR {selectedStructure.Arrears.toLocaleString()})</span>
                      </label>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm pt-1">
                    <span className="font-semibold text-gray-600">Base Class Total: PKR {(selectedStructure.monthlyFee + selectedStructure.examFee + selectedStructure.libraryFee + selectedStructure.transportFee + selectedStructure.Arrears + selectedStructure.admissionFee).toLocaleString()}</span>
                    <span className="text-gray-300">|</span>
                    <span className="font-bold text-emerald-700">
                      Selected Total / Student: PKR {(
                        (selectedFees.monthly ? selectedStructure.monthlyFee : 0) +
                        (selectedFees.exam ? selectedStructure.examFee : 0) +
                        (selectedFees.annual ? selectedStructure.libraryFee : 0) +
                        (selectedFees.transport ? selectedStructure.transportFee : 0) +
                        (selectedFees.previous ? selectedStructure.Arrears : 0) +
                        (selectedFees.admission ? selectedStructure.admissionFee : 0)
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-amber-700">No fee structure set for this class. Set it in the Fee Structure page first.</p>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 flex-wrap items-center">
            <Button
              disabled={!selectedClass || !month || checkingDuplicate}
              onClick={handleGenerateClick}
              className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white hover:from-blue-800 hover:to-indigo-800"
            >
              {checkingDuplicate
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Checking...</>
                : <><GraduationCap className="w-4 h-4 mr-2" />Generate Vouchers ({classStudents.length} students)</>
              }
            </Button>

            {generated && classStudents.length > 0 && (
              <>
                <Button
                  onClick={handleSaveToDatabase}
                  disabled={saving || saved}
                  className={saved
                    ? "bg-emerald-600 text-white cursor-default"
                    : "bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700"
                  }
                >
                  {saving
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                    : saved
                    ? <><CheckCircle2 className="w-4 h-4 mr-2" />Saved to Fees</>
                    : <><Save className="w-4 h-4 mr-2" />Save to Database</>
                  }
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-2" /> Print All
                </Button>
              </>
            )}
          </div>

          {saved && (
            <p className="text-sm text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
              Fee records saved to database. You can view and update them in the Fees page.
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Empty state ── */}
      {generated && classStudents.length === 0 && (
        <div className="text-center py-16 text-gray-400 no-print">
          <ReceiptText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No active students found in this class</p>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────────────────
          DUPLICATE WARNING DIALOG
          Shows when fee records already exist for the selected class + month.
          User MUST delete existing records first before generating new ones.
      ──────────────────────────────────────────────────────────────────── */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Fee Records Already Exist
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-700">
              Fee records for <strong className="text-gray-900">{selectedClassName}</strong> — <strong className="text-gray-900">{monthLabel}</strong> already exist in the database.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> {existingForMonth.length} existing record{existingForMonth.length !== 1 ? "s" : ""} found
              </p>
              <p className="text-sm text-red-700">
                To generate new vouchers for this month, you must first delete the existing fee records from the <strong>Fees</strong> page.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <p className="font-semibold mb-1">Steps to replace existing vouchers:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to the <strong>Fees</strong> page</li>
                <li>Filter by class <strong>{selectedClassName}</strong> and month <strong>{monthLabel}</strong></li>
                <li>Delete all existing fee records for that month</li>
                <li>Return here and generate new vouchers</li>
              </ol>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDeleteExisting}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting Vouchers...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete &amp; Generate New
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Per-student fee adjust dialog ── */}
      <Dialog open={editingId !== null} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adjust Student Fee</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedFees.monthly && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Monthly Fee Override (PKR)
                  <span className="text-xs text-gray-400 ml-1">— leave blank to use class fee</span>
                </label>
                <Input type="number" min="0"
                  placeholder={`Class fee: PKR ${selectedStructure?.monthlyFee?.toLocaleString() ?? "0"}`}
                  value={draft.feeOverride}
                  onChange={e => setDraft(d => ({ ...d, feeOverride: e.target.value }))} />
              </div>
            )}

            {selectedFees.exam && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Exam Fee Override (PKR)
                  <span className="text-xs text-gray-400 ml-1">— leave blank to use class fee</span>
                </label>
                <Input type="number" min="0"
                  placeholder={`Class fee: PKR ${selectedStructure?.examFee?.toLocaleString() ?? "0"}`}
                  value={draft.examOverride}
                  onChange={e => setDraft(d => ({ ...d, examOverride: e.target.value }))} />
              </div>
            )}

            {selectedFees.annual && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Annual Charges Override (PKR)
                  <span className="text-xs text-gray-400 ml-1">— leave blank to use class fee</span>
                </label>
                <Input type="number" min="0"
                  placeholder={`Class fee: PKR ${selectedStructure?.libraryFee?.toLocaleString() ?? "0"}`}
                  value={draft.annualOverride}
                  onChange={e => setDraft(d => ({ ...d, annualOverride: e.target.value }))} />
              </div>
            )}

            {selectedFees.transport && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Transport Fee Override (PKR)
                  <span className="text-xs text-gray-400 ml-1">— leave blank to use class fee</span>
                </label>
                <Input type="number" min="0"
                  placeholder={`Class fee: PKR ${selectedStructure?.transportFee?.toLocaleString() ?? "0"}`}
                  value={draft.transportOverride}
                  onChange={e => setDraft(d => ({ ...d, transportOverride: e.target.value }))} />
              </div>
            )}

            {selectedFees.admission && (
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">
                  Admission Fee Override (PKR)
                  <span className="text-xs text-gray-400 ml-1">— leave blank to use class fee</span>
                </label>
                <Input type="number" min="0"
                  placeholder={`Class fee: PKR ${selectedStructure?.admissionFee?.toLocaleString() ?? "0"}`}
                  value={draft.admissionOverride}
                  onChange={e => setDraft(d => ({ ...d, admissionOverride: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">
                Additional Arrears (PKR)
                <span className="text-xs text-gray-400 ml-1">— extra outstanding balance</span>
              </label>
              <Input type="number" min="0" placeholder="0" value={draft.arrears}
                onChange={e => setDraft(d => ({ ...d, arrears: e.target.value }))} />
              {editingId !== null && getPreviousArrears(editingId) > 0 && (
                <p className="text-xs text-red-600 mt-1">
                  Auto-detected unpaid arrears: PKR {getPreviousArrears(editingId).toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Late Fine (PKR)</label>
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
              <Input placeholder="e.g. Scholarship concession" value={draft.note}
                onChange={e => setDraft(d => ({ ...d, note: e.target.value }))} />
            </div>

            {editingId !== null && (() => {
              const preview = Math.max(0,
                (selectedFees.monthly ? (Number(draft.feeOverride) || selectedStructure?.monthlyFee || 0) : 0) +
                (selectedFees.exam ? (Number(draft.examOverride) || selectedStructure?.examFee || 0) : 0) +
                (selectedFees.annual ? (Number(draft.annualOverride) || selectedStructure?.libraryFee || 0) : 0) +
                (selectedFees.transport ? (Number(draft.transportOverride) || selectedStructure?.transportFee || 0) : 0) +
                (selectedFees.admission ? (Number(draft.admissionOverride) || selectedStructure?.admissionFee || 0) : 0) +
                (selectedFees.previous ? (getPreviousArrears(editingId) + (selectedStructure?.Arrears ?? 0)) : 0) +
                (Number(draft.arrears)  || 0) +
                (Number(draft.fine)     || 0) -
                (Number(draft.discount) || 0)
              );
              return (
                <div className="flex justify-between items-center bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                  <span className="text-sm font-medium text-gray-600">Total Payable:</span>
                  <span className="text-base font-black" style={{ color: NAVY }}>PKR {preview.toLocaleString()}</span>
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
              <Button onClick={() => editingId !== null && saveEdit(editingId)} style={{ background: NAVY, color: "#fff" }}>
                <Check className="w-4 h-4 mr-2" /> Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Screen Preview Cards ── */}
      {generated && classStudents.length > 0 && (
        <div className="no-print space-y-3">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            {classStudents.length} Vouchers — {selectedClassName} — {monthLabel}
          </p>

          {classStudents.map(student => {
            const structure     = student.classId ? feeStructureMap[student.classId] : undefined;
            const e             = getEdit(student.id);
            const fine          = Number(e.fine     || 0);
            const disc          = Number(e.discount || 0);
            const monthly       = getMonthlyFee(student.id, structure);
            const exam          = getExamFee(student.id, structure);
            const annual        = getAnnualFee(student.id, structure);
            const transport     = getTransportFee(student.id, structure);
            const admission     = getAdmissionFee(student.id, structure);
            const autoArrears   = getPreviousArrears(student.id);
            const manualArrears = Number(e.arrears || 0);
            const total         = calcTotal(student.id, structure);
            const hasEdits      = e.feeOverride || e.examOverride || e.annualOverride || e.transportOverride || e.admissionOverride || e.arrears || e.fine || e.discount || e.note;

            return (
              <Card key={student.id} className="border-2 border-gray-200 hover:border-blue-300 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
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

                    {/* Fee breakdown summary */}
                    <div className="text-right shrink-0 min-w-32">
                      <div className="space-y-0.5 text-xs text-gray-500">
                        {selectedFees.monthly && monthly > 0 && (
                          <div>Monthly: PKR {monthly.toLocaleString()}{e.feeOverride ? " ✎" : ""}</div>
                        )}
                        {selectedFees.exam && exam > 0 && (
                          <div>Exam: PKR {exam.toLocaleString()}{e.examOverride ? " ✎" : ""}</div>
                        )}
                        {selectedFees.annual && annual > 0 && (
                          <div>Annual Charges: PKR {annual.toLocaleString()}{e.annualOverride ? " ✎" : ""}</div>
                        )}
                        {selectedFees.transport && transport > 0 && (
                          <div>Transport: PKR {transport.toLocaleString()}{e.transportOverride ? " ✎" : ""}</div>
                        )}
                        {selectedFees.admission && admission > 0 && (
                          <div>Admission: PKR {admission.toLocaleString()}{e.admissionOverride ? " ✎" : ""}</div>
                        )}
                        {selectedFees.previous && (autoArrears > 0 || (structure?.Arrears ?? 0) > 0) && (
                          <div className="text-red-600 font-medium">Arrears: PKR {(autoArrears + (structure?.Arrears ?? 0)).toLocaleString()}</div>
                        )}
                        {manualArrears > 0 && <div className="text-red-700 font-medium">Extra Arrears: PKR {manualArrears.toLocaleString()} ✎</div>}
                        {fine > 0 && <div className="text-red-500">Fine: +PKR {fine.toLocaleString()}</div>}
                        {disc > 0 && <div className="text-emerald-600">Discount: −PKR {disc.toLocaleString()}</div>}
                      </div>
                      <p className="text-lg font-black mt-1" style={{ color: NAVY }}>PKR {total.toLocaleString()}</p>
                      <p className="text-[10px] text-gray-400">Due: {dueDate}</p>
                    </div>

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

      {/* ── Print-only vouchers (portalled to body) ── */}
      {generated && classStudents.length > 0 && createPortal(
        <div id="kips-voucher-print" style={{ display: "none", fontFamily: "Arial, sans-serif" }}>
          {classStudents.map((student, idx) => {
            const structure     = student.classId ? feeStructureMap[student.classId] : undefined;
            const e             = getEdit(student.id);
            const fine          = Number(e.fine     || 0);
            const disc          = Number(e.discount || 0);
            const monthly       = getMonthlyFee(student.id, structure);
            const exam          = getExamFee(student.id, structure);
            const annual        = getAnnualFee(student.id, structure);
            const transport     = getTransportFee(student.id, structure);
            const admission     = getAdmissionFee(student.id, structure);
            const autoArrears   = getPreviousArrears(student.id);
            const manualArrears = Number(e.arrears || 0);
            const total         = calcTotal(student.id, structure);
            const voucherNo     = makeVoucherNo(student.admissionNumber, idx);

            return (
              <div key={student.id} className="voucher-pair" style={{ pageBreakInside: "avoid", pageBreakAfter: "always" }}>
                <VoucherCopy copyLabel="School Copy"
                  student={student} selectedClassName={selectedClassName}
                  monthLabel={monthLabel} dueDate={dueDate} voucherNo={voucherNo}
                  structure={structure} edit={e} fine={fine} disc={disc} total={total}
                  monthlyFeeToUse={monthly}
                  examFeeToUse={exam}
                  annualFeeToUse={annual}
                  transportFeeToUse={transport}
                  admissionFeeToUse={admission}
                  previousArrears={autoArrears + (structure?.Arrears ?? 0)} manualArrears={manualArrears}
                  selectedFees={selectedFees} />

                <div className="cut-line" style={{ borderTop: "1.5px dashed #9ca3af", margin: "4mm 0", textAlign: "center", fontSize: "8pt", color: "#9ca3af" }}>
                  ✂ &nbsp; Cut Here &nbsp; ✂
                </div>

                <VoucherCopy copyLabel="Parent / Guardian Copy"
                  student={student} selectedClassName={selectedClassName}
                  monthLabel={monthLabel} dueDate={dueDate} voucherNo={voucherNo}
                  structure={structure} edit={e} fine={fine} disc={disc} total={total}
                  monthlyFeeToUse={monthly}
                  examFeeToUse={exam}
                  annualFeeToUse={annual}
                  transportFeeToUse={transport}
                  admissionFeeToUse={admission}
                  previousArrears={autoArrears + (structure?.Arrears ?? 0)} manualArrears={manualArrears}
                  selectedFees={selectedFees} />
              </div>
            );
          })}
        </div>,
        document.body
      )}
      {/* ── WhatsApp Voucher Delivery Prompt ── */}
      <Dialog open={showWaPrompt} onOpenChange={setShowWaPrompt}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-655 font-bold">
              <MessageCircle className="w-5 h-5 text-green-600" /> Send Vouchers via WhatsApp?
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-700">
              Fee records for class <strong>{selectedClassName}</strong> have been saved successfully!
            </p>
            <p className="text-sm text-gray-600">
              Would you like to send fee voucher notifications to parents on WhatsApp? This is 100% free and uses a semi-automated queue.
            </p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={() => setShowWaPrompt(false)}>
              No, Close
            </Button>
            <Button
              onClick={() => {
                setShowWaPrompt(false);
                setWaQueueOpen(true);
                setWaQueueIndex(0);
                setWaSentIds({});
              }}
              className="bg-green-600 hover:bg-green-700 text-white font-bold animate-pulse"
            >
              Yes, Start Sending
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── WhatsApp Voucher Queue Sender Dialog ── */}
      <Dialog open={waQueueOpen} onOpenChange={setWaQueueOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 text-lg font-bold">
              <MessageCircle className="w-5 h-5" /> WhatsApp Voucher Sender ({classStudents.length} Students)
            </DialogTitle>
            <DialogDescription>
              Choose between automatic server-side background sending or manual queue helper.
            </DialogDescription>
          </DialogHeader>

          {/* Mode Switch Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setSendMode("auto")}
              className={cn(
                "flex-1 py-2.5 font-bold text-xs text-center border-b-2 transition-all",
                sendMode === "auto" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              Aik Click Sab Ko (Automatic Bulk)
            </button>
            <button
              onClick={() => setSendMode("manual")}
              className={cn(
                "flex-1 py-2.5 font-bold text-xs text-center border-b-2 transition-all",
                sendMode === "manual" ? "border-green-600 text-green-600" : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              Ek Ek Karke (Manual Queue)
            </button>
          </div>

          {sendMode === "auto" ? (
            /* ────────────────────────────────────────────────────────
               AUTOMATIC SENDER TAB
            ──────────────────────────────────────────────────────── */
            <div className="space-y-4 py-1">
              {waStatus === "connected" ? (
                /* Connected view */
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-5 h-5 text-green-600 animate-pulse" />
                      <div>
                        <span className="text-xs font-bold text-green-800">WhatsApp connected successfully!</span>
                        <p className="text-[10px] text-green-650">Ready to dispatch background messages.</p>
                      </div>
                    </div>
                    <Button onClick={triggerDisconnect} variant="outline" size="sm" className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50 text-xs">
                      Disconnect Account
                    </Button>
                  </div>

                  {autoProgress.sending ? (
                    /* Progress Screen */
                    <div className="border rounded-xl p-6 bg-gray-50 text-center space-y-4">
                      <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto" />
                      <div>
                        <h4 className="font-bold text-sm text-gray-800">Sending Messages in Background</h4>
                        <p className="text-xs text-gray-400 mt-0.5">Please keep this tab open while sending.</p>
                      </div>
                      
                      {/* Progress Bar */}
                      <div className="max-w-md mx-auto">
                        <div className="flex justify-between text-xs text-gray-550 mb-1 font-semibold">
                          <span>Progress: {autoProgress.sent + autoProgress.failed} / {autoProgress.total}</span>
                          <span>{Math.round(((autoProgress.sent + autoProgress.failed) / autoProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                          <div
                            className="bg-green-500 h-full transition-all duration-500"
                            style={{ width: `${((autoProgress.sent + autoProgress.failed) / autoProgress.total) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-center gap-4 text-xs mt-3 text-gray-600">
                          <span className="text-green-700 font-bold">Sent: {autoProgress.sent}</span>
                          <span className="text-red-600 font-bold">Failed: {autoProgress.failed}</span>
                        </div>
                      </div>

                      <Button onClick={handleStopAutoSending} variant="destructive" className="flex items-center gap-1.5 mx-auto text-xs font-bold">
                        <Square className="w-3.5 h-3.5" /> Stop Sending
                      </Button>
                    </div>
                  ) : (
                    /* Not sending screen */
                    <div className="space-y-4">
                      <div className="bg-gray-50 border rounded-xl p-4">
                        <h4 className="text-xs font-bold text-gray-700 mb-2 uppercase tracking-wide">Language Template</h4>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setWaLanguage("urdu")}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                              waLanguage === "urdu" ? "bg-green-650 text-white border-green-700" : "bg-white text-gray-650 border-gray-200"
                            )}
                          >
                            Urdu Messages (اردو)
                          </button>
                          <button
                            onClick={() => setWaLanguage("english")}
                            className={cn(
                              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
                              waLanguage === "english" ? "bg-green-650 text-white border-green-700" : "bg-white text-gray-650 border-gray-200"
                            )}
                          >
                            English Messages
                          </button>
                        </div>
                      </div>

                      {autoProgress.total > 0 && !autoProgress.sending && (
                        /* Results of last send */
                        <div className={cn(
                          "border rounded-xl p-4 text-xs",
                          autoProgress.failed > 0 ? "bg-red-50 border-red-200 text-red-800" : "bg-green-50 border-green-200 text-green-800"
                        )}>
                          <p className="font-bold">Sending session finished!</p>
                          <p className="mt-1">Successfully dispatched: <strong>{autoProgress.sent}</strong> | Failed: <strong>{autoProgress.failed}</strong></p>
                          {autoProgress.errors.length > 0 && (
                            <div className="mt-2 bg-white/70 p-2.5 rounded-lg border border-red-200 max-h-24 overflow-y-auto space-y-1">
                              {autoProgress.errors.map((err, i) => (
                                <p key={i} className="text-[10px] text-red-700 font-mono">{err}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <Button
                        onClick={handleStartAutoSending}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl shadow-md border-green-700 flex items-center justify-center gap-2"
                      >
                        <Play className="w-4 h-4" /> Send to all {classStudents.length} Parents Automatically
                      </Button>
                    </div>
                  )}
                </div>
              ) : waQr ? (
                /* QR Code view */
                <div className="text-center p-6 border rounded-xl bg-gray-50 space-y-4">
                  <WifiOff className="w-12 h-12 text-red-400 mx-auto" />
                  <div>
                    <h3 className="font-bold text-sm text-gray-800">Scan QR Code to Connect</h3>
                    <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
                      Scan the QR code with your WhatsApp linked devices to connect. This establishes a free background automation link on the server.
                    </p>
                  </div>
                  <div className="bg-white p-4 border rounded-xl inline-block shadow-sm">
                    <img src={waQr} alt="WhatsApp QR Code" className="w-52 h-52 mx-auto" />
                    <p className="text-[10px] text-gray-400 mt-2 font-bold uppercase tracking-wider">Scan now using phone</p>
                  </div>
                  <div className="pt-2">
                    <Button onClick={triggerConnect} className="bg-green-650 hover:bg-green-750 text-white font-bold text-xs flex items-center gap-1.5 mx-auto">
                      <RefreshCw className="w-3.5 h-3.5" /> Start / Refresh QR
                    </Button>
                  </div>
                </div>
              ) : (
                /* Connecting loader view */
                <div className="text-center p-12 border rounded-xl bg-gray-50 space-y-3">
                  <Loader2 className="w-10 h-10 animate-spin text-green-600 mx-auto" />
                  <p className="font-bold text-xs text-gray-700">Connecting to WhatsApp Web services...</p>
                  <p className="text-[10px] text-gray-400">If QR code doesn't load in 10 seconds, click Refresh below.</p>
                  <div className="pt-2">
                    <Button onClick={triggerConnect} className="bg-green-650 hover:bg-green-750 text-white font-bold text-xs flex items-center gap-1.5 mx-auto">
                      <RefreshCw className="w-3.5 h-3.5" /> Start / Refresh QR
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ────────────────────────────────────────────────────────
               MANUAL REDIRECT QUEUE TAB
            ──────────────────────────────────────────────────────── */
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-2">
              {/* Left Queue List */}
              <div className="md:col-span-5 border rounded-xl p-3 bg-gray-50 max-h-[350px] overflow-y-auto space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Students Queue</p>
                {classStudents.map((student, idx) => {
                  const isCurrent = idx === waQueueIndex;
                  const isSent = waSentIds[student.id];
                  const total = calcTotal(student.id, student.classId ? feeStructureMap[student.classId] : undefined);
                  return (
                    <div
                      key={student.id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all",
                        isCurrent
                          ? "bg-green-50 border-green-300 ring-2 ring-green-100 font-semibold"
                          : isSent
                          ? "bg-gray-100 border-gray-200 text-gray-400"
                          : "bg-white border-gray-200 text-gray-700"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="font-bold flex items-center gap-1.5">
                          {isSent && <span className="text-green-600 font-bold">✓</span>}
                          <span className="truncate">{student.name}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">PKR {total.toLocaleString()}</p>
                        {student.phone ? (
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{student.phone}</p>
                        ) : (
                          <p className="text-[10px] text-red-500 font-bold mt-0.5">No Phone Number</p>
                        )}
                      </div>
                      {isCurrent && (
                        <span className="text-[10px] bg-green-600 text-white font-extrabold px-1.5 py-0.5 rounded-md animate-pulse">
                          CURRENT
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Right Editor / Controller */}
              <div className="md:col-span-7 flex flex-col gap-3 min-h-[350px]">
                {waQueueIndex < classStudents.length ? (
                  <>
                    <div className="flex justify-between items-center bg-gray-100 p-2 rounded-xl">
                      <span className="text-xs font-bold text-gray-650">Language:</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setWaLanguage("urdu")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                            waLanguage === "urdu" ? "bg-green-600 text-white border-green-650" : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                          )}
                        >
                          Urdu (اردو)
                        </button>
                        <button
                          onClick={() => setWaLanguage("english")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                            waLanguage === "english" ? "bg-green-600 text-white border-green-650" : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                          )}
                        >
                          English
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500">Edit Message Preview:</label>
                      <Textarea
                        value={waMessageText}
                        onChange={e => setWaMessageText(e.target.value)}
                        dir={waLanguage === "urdu" ? "rtl" : "ltr"}
                        className="flex-1 min-h-[180px] text-sm p-3 font-medium bg-white border border-gray-200 rounded-xl leading-relaxed focus:ring-2 focus:ring-green-150 focus:border-green-400"
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex justify-between items-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        <span>Recipient: <strong>{classStudents[waQueueIndex]?.name}</strong></span>
                        <span>Phone: <strong>{classStudents[waQueueIndex]?.phone || "N/A"}</strong></span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            const student = classStudents[waQueueIndex];
                            const cleanPhone = (student.phone ?? "").replace(/\D/g, "");
                            const intlPhone = cleanPhone.startsWith("0") ? "92" + cleanPhone.slice(1) : cleanPhone.startsWith("92") ? cleanPhone : "92" + cleanPhone;
                            const encoded = encodeURIComponent(waMessageText);
                            const waUrl = intlPhone.length > 4
                              ? `https://wa.me/${intlPhone}?text=${encoded}`
                              : `https://wa.me/?text=${encoded}`;
                            
                            window.open(waUrl, "_blank");

                            setWaSentIds(prev => ({ ...prev, [student.id]: true }));
                            setWaQueueIndex(prev => prev + 1);
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-sm py-3 rounded-xl shadow-lg border-green-700 flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-5 h-5" /> Open WhatsApp &amp; Next
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setWaQueueIndex(prev => prev + 1)}
                          className="text-gray-500 border-gray-200 hover:bg-gray-100"
                        >
                          Skip
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-green-50/50 border border-green-100 rounded-2xl">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-bold text-2xl mb-4">
                      ✓
                    </div>
                    <h3 className="text-lg font-bold text-green-800">All Vouchers Notified!</h3>
                    <p className="text-sm text-green-600 mt-1 max-w-[280px]">
                      You have successfully completed notifications for all student vouchers.
                    </p>
                    <Button
                      onClick={() => setWaQueueOpen(false)}
                      className="mt-5 bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-6 py-2.5 rounded-full"
                    >
                      Close Dialog
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
