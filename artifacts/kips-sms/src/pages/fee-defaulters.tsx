import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGetFeeDefaulters, useListClasses } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, AlertTriangle, MessageCircle, Phone, Loader2, Play, Square, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    body > *:not(#kips-print-portal) { display: none !important; }
    #kips-print-portal {
      display: block !important;
      position: static !important;
      width: 100% !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      color: #111827 !important;
      padding: 14mm 14mm !important;
      box-sizing: border-box !important;
    }
    table { border-collapse: collapse !important; width: 100% !important; }
    tr    { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

const GRADIENTS = [
  "from-violet-500 to-purple-600","from-pink-500 to-rose-500",
  "from-blue-500 to-indigo-600",  "from-cyan-500 to-blue-500",
  "from-teal-500 to-emerald-500", "from-green-500 to-teal-600",
  "from-amber-400 to-orange-500", "from-orange-500 to-red-500",
  "from-fuchsia-500 to-pink-600", "from-sky-400 to-cyan-500",
  "from-emerald-500 to-green-600","from-rose-500 to-pink-600",
  "from-indigo-400 to-violet-500",
];
const CARD_BG = [
  { bg: "#f5f3ff", border: "#ddd6fe", tag: "#7c3aed" },
  { bg: "#fff1f2", border: "#fecdd3", tag: "#e11d48" },
  { bg: "#eff6ff", border: "#bfdbfe", tag: "#2563eb" },
  { bg: "#ecfeff", border: "#a5f3fc", tag: "#0891b2" },
  { bg: "#f0fdf4", border: "#bbf7d0", tag: "#059669" },
  { bg: "#f0fdf4", border: "#86efac", tag: "#16a34a" },
  { bg: "#fffbeb", border: "#fde68a", tag: "#d97706" },
  { bg: "#fff7ed", border: "#fed7aa", tag: "#ea580c" },
  { bg: "#fdf4ff", border: "#f0abfc", tag: "#c026d3" },
  { bg: "#f0f9ff", border: "#bae6fd", tag: "#0284c7" },
  { bg: "#ecfdf5", border: "#6ee7b7", tag: "#059669" },
  { bg: "#fff1f2", border: "#fda4af", tag: "#e11d48" },
  { bg: "#eef2ff", border: "#c7d2fe", tag: "#4f46e5" },
];

const getCleanMonth = (m: string) => {
  const match = m.match(/\d{4}-\d{2}/);
  return match ? match[0] : m;
};

const formatCleanMonth = (m: string) => {
  const match = m.match(/^(\d{4})-(\d{2})$/);
  if (!match) return m;
  const [_, year, month] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

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

const TH: React.CSSProperties = { padding:"7px 9px", background:"#fee2e2", color:"#7f1d1d", fontWeight:700, fontSize:9, textAlign:"left", border:"1px solid #fca5a5" };
const TD: React.CSSProperties = { padding:"6px 9px", border:"1px solid #e5e7eb", fontSize:9, color:"#1f2937", background:"#ffffff" };
const TDA: React.CSSProperties = { ...TD, background:"#fff7f7" };

function getToken(): string {
  return localStorage.getItem("token") ?? localStorage.getItem("kips_token") ?? "";
}
function authH(): HeadersInit {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function buildWhatsAppMsg(studentName: string, className: string, month: string, amount: number, dueDate: string, notes: string, phone?: string | null): string {
  const monthText = month.includes(",") ? `months of *${month}*` : `month of *${month}*`;
  const msg = `Assalam u Alaikum! 🌟\n\nKIPS School Hassari would like to remind you that the fee for your child *${studentName}* (Class: ${className}) for the ${monthText} is:\n\n${notes}\n\n💵 Total Payable: *PKR ${amount.toLocaleString()}*\n📅 Due Date: *${dueDate}*\n\nIt has not been paid yet. Kindly make the payment as soon as possible..\n\nThank you! 🙏\nKIPS School Hassari`;

  const encoded = encodeURIComponent(msg);
  const cleanPhone = (phone ?? "").replace(/\D/g, "");
  const intlPhone  = cleanPhone.startsWith("0") ? "92" + cleanPhone.slice(1) : cleanPhone.startsWith("92") ? cleanPhone : "92" + cleanPhone;
  return intlPhone.length > 4
    ? `https://wa.me/${intlPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

function getUrduTemplate(studentName: string, className: string, month: string, amount: number, dueDate: string, notes: string): string {
  const cleanNotes = notes
    .replace(/•/g, "")
    .replace(/Tuition Fee/gi, "Taleemi Fee")
    .replace(/Admission Fee/gi, "Dakhla Fee")
    .replace(/Exam Fee/gi, "Imtihan Fee")
    .replace(/Transport Fee/gi, "Transport Fee")
    .replace(/Annual Charges/gi, "Salana Charges")
    .replace(/Fine/gi, "Jurmana");
  
  const monthText = month.includes(",") ? `maheenon ( *${month}* )` : `maheena ( *${month}* )`;
  return `السلام علیکم! 🌟\n\nکیپس سکول ہساری کی طرف سے گزارش ہے کہ آپ کے بچے/بچی *${studentName}* (کلاس: ${className}) کی ${monthText} کی فیس بقایا ہے:\n\n${cleanNotes}\n\n💵 کل قابلِ ادا رقم: *PKR ${amount.toLocaleString()}*\n📅 آخری تاریخ: *${dueDate}*\n\nیہ فیس ابھی تک جمع نہیں کروائی گئی۔ برائے مہربانی جلد از جلد فیس جمع کروائیں۔\n\nشکریہ! 🙏\nکیپس سکول ہساری`;
}

function getEnglishTemplate(studentName: string, className: string, month: string, amount: number, dueDate: string, notes: string): string {
  const monthText = month.includes(",") ? `months of *${month}*` : `month of *${month}*`;
  return `Assalam u Alaikum! 🌟\n\nKIPS School Hassari would like to remind you that the fee for your child *${studentName}* (Class: ${className}) for the ${monthText} is:\n\n${notes}\n\n💵 Total Payable: *PKR ${amount.toLocaleString()}*\n📅 Due Date: *${dueDate}*\n\nIt has not been paid yet. Kindly make the payment as soon as possible..\n\nThank you! 🙏\nKIPS School Hassari`;
}

interface FeeItem {
  id: number;
  studentId?: number | null;
  studentName?: string | null;
  fatherName?: string | null;
  admissionNumber?: string | null;
  classId?: number | null;
  className?: string | null;
  month: string;
  amount?: number | null;
  fine?: number | null;
  dueDate?: string | null;
  phone?: string | null;
  notes?: string;
  waNotes?: string;
}

export default function FeeDefaulters() {
  const [statusFilter, setStatusFilter] = useState<"active" | "inactive">("active");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [viewMode] = useState<"list">("list");
  const { data: defaulters, isLoading } = useGetFeeDefaulters({ status: statusFilter });
  const { data: classes } = useListClasses();

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Record<number, boolean>>({});

  // WhatsApp connection states
  const [waStatus, setWaStatus] = useState<"connected" | "connecting" | "disconnected">("disconnected");
  const [waQr, setWaQr] = useState<string | null>(null);
  
  // Dialog controls
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [queueStudents, setQueueStudents] = useState<FeeItem[]>([]);
  const [sendMode, setSendMode] = useState<"auto" | "manual">("auto");

  // Manual Queue States
  const [queueIndex, setQueueIndex] = useState(0);
  const [templateLanguage, setTemplateLanguage] = useState<"urdu" | "english">("urdu");
  const [currentMessageText, setCurrentMessageText] = useState("");
  const [sentIds, setSentIds] = useState<Record<number, boolean>>({});

  // Auto Sending Progress States
  const [autoProgress, setAutoProgress] = useState<{
    sending: boolean;
    total: number;
    sent: number;
    failed: number;
    errors: string[];
  }>({ sending: false, total: 0, sent: 0, failed: 0, errors: [] });

  useEffect(() => {
    const prev = document.getElementById("kips-print-styles"); if (prev) prev.remove();
    const el = document.createElement("style"); el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES; document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const rawList      = (defaulters ?? []) as FeeItem[];

  const sortedClasses = classes
    ? [...classes].sort((a, b) => getClassRank(a.name) - getClassRank(b.name))
    : [];

  const classColorMap = new Map<number, number>();
  sortedClasses.forEach((cls, i) => classColorMap.set(cls.id, i % GRADIENTS.length));
  
  const groupedMap: Record<string, { first: FeeItem; items: FeeItem[] }> = {};
  for (const f of rawList) {
    if (!f.studentName || !f.className) {
      continue;
    }
    const studentId = f.studentId || (f as any).student_id;
    const key = String(studentId);
    if (!groupedMap[key]) {
      groupedMap[key] = { first: f, items: [] };
    }
    groupedMap[key].items.push(f);
  }

  const list: FeeItem[] = Object.values(groupedMap).map(({ first, items }) => {
    const amount = items.reduce((s, i) => s + (i.amount ?? 0), 0);
    const fine = items.reduce((s, i) => s + (i.fine ?? 0), 0);
    
    const notesList = items.map(i => {
      const m = formatCleanMonth(getCleanMonth(i.month));
      const label = (i as any).notes || 'Fee';
      return `${m} ${label}: PKR ${Number(i.amount ?? 0).toLocaleString()}`;
    });
    const notes = notesList.join(", ");
    
    const waNotesList = items.map(i => {
      const m = formatCleanMonth(getCleanMonth(i.month));
      const label = (i as any).notes || 'Fee';
      return `• ${m} - ${label}: *PKR ${Number(i.amount ?? 0).toLocaleString()}*`;
    });
    const waNotes = waNotesList.join("\n");

    const uniqueMonths = Array.from(new Set(items.map(i => formatCleanMonth(getCleanMonth(i.month)))));
    const month = uniqueMonths.join(", ");

    const dueDates = items.map(i => i.dueDate).filter(Boolean) as string[];
    const dueDate = dueDates.length > 0 ? dueDates.sort().reverse()[0] : (first.dueDate ?? "");

    return {
      ...first,
      month,
      amount,
      fine,
      dueDate,
      notes,
      waNotes,
    } as unknown as FeeItem;
  });

  const filteredList = classFilter === "all"
    ? list
    : list.filter(f => String(f.classId) === classFilter);

  const sortedList = [...filteredList].sort((a, b) => {
    const rankA = getClassRank(a.className || "");
    const rankB = getClassRank(b.className || "");
    if (rankA !== rankB) return rankA - rankB;
    return (a.studentName || "").localeCompare(b.studentName || "");
  });

  const totalPending = filteredList.reduce((s, f) => s + (f.amount ?? 0), 0);
  const totalFine    = filteredList.reduce((s, f) => s + (f.fine   ?? 0), 0);
  const grandTotal   = totalPending + totalFine;

  const byClass: Record<string, FeeItem[]> = {};
  for (const f of filteredList) {
    const key = f.className || "No Class";
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(f);
  }
  const classNames = Object.keys(byClass).sort((a, b) => getClassRank(a) - getClassRank(b));

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleSelectAll = () => {
    const allSelected = sortedList.length > 0 && sortedList.every(f => selectedIds[f.studentId ?? 0]);
    const next: Record<number, boolean> = {};
    if (!allSelected) {
      sortedList.forEach(f => {
        if (f.studentId) next[f.studentId] = true;
      });
    }
    setSelectedIds(next);
  };

  const selectedCount = sortedList.filter(f => selectedIds[f.studentId ?? 0]).length;

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

  // Connect & Disconnect triggers
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

  // Poll status & bulk progress when bulk sending dialogue is open
  useEffect(() => {
    if (!bulkDialogOpen) return;
    checkWhatsAppStatus();
    
    const interval = setInterval(async () => {
      // Check connection status
      await checkWhatsAppStatus();
      
      // Check sending progress
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
  }, [bulkDialogOpen]);

  const handleOpenBulkDialog = () => {
    const selectedStudents = sortedList.filter(f => selectedIds[f.studentId ?? 0]);
    setQueueStudents(selectedStudents);
    setQueueIndex(0);
    setSentIds({});
    setAutoProgress({ sending: false, total: 0, sent: 0, failed: 0, errors: [] });
    setBulkDialogOpen(true);
    checkWhatsAppStatus();
  };

  // Auto Send bulk backend trigger
  const handleStartAutoSending = async () => {
    if (waStatus !== "connected") return;
    
    // Prepare message payload
    const payload = queueStudents.map(s => {
      const total = (s.amount ?? 0) + (s.fine ?? 0);
      const text = templateLanguage === "urdu"
        ? getUrduTemplate(s.studentName ?? "Student", s.className ?? "", s.month, total, s.dueDate ?? "", s.waNotes || "")
        : getEnglishTemplate(s.studentName ?? "Student", s.className ?? "", s.month, total, s.dueDate ?? "", s.waNotes || "");
      
      return {
        phone: s.phone ?? "",
        message: text,
        studentName: s.studentName ?? "Student"
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

  // Manual fallback queue synchronization
  useEffect(() => {
    if (bulkDialogOpen && queueIndex < queueStudents.length) {
      const s = queueStudents[queueIndex];
      const total = (s.amount ?? 0) + (s.fine ?? 0);
      const text = templateLanguage === "urdu"
        ? getUrduTemplate(s.studentName ?? "Student", s.className ?? "", s.month, total, s.dueDate ?? "", s.waNotes || "")
        : getEnglishTemplate(s.studentName ?? "Student", s.className ?? "", s.month, total, s.dueDate ?? "", s.waNotes || "");
      setCurrentMessageText(text);
    }
  }, [bulkDialogOpen, queueIndex, templateLanguage, queueStudents]);

  const handleSendNext = () => {
    if (queueIndex >= queueStudents.length) return;
    const s = queueStudents[queueIndex];
    const cleanPhone = (s.phone ?? "").replace(/\D/g, "");
    const intlPhone = cleanPhone.startsWith("0") ? "92" + cleanPhone.slice(1) : cleanPhone.startsWith("92") ? cleanPhone : "92" + cleanPhone;
    const encoded = encodeURIComponent(currentMessageText);
    const waUrl = intlPhone.length > 4
      ? `https://wa.me/${intlPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    
    window.open(waUrl, "_blank");
    setSentIds(prev => ({ ...prev, [s.studentId ?? 0]: true }));
    setQueueIndex(prev => prev + 1);
  };

  const handleSkipNext = () => {
    setQueueIndex(prev => prev + 1);
  };

  useEffect(() => {
    setSelectedIds({});
  }, [classFilter, statusFilter]);

  // ── Print portal ──────────────────────────────────────────────────────────
  const printPortal = createPortal(
    <div id="kips-print-portal" style={{ position:"fixed", left:"-9999px", top:0, width:"210mm", fontFamily:"Arial, sans-serif", background:"white", color:"#111827", padding:"14mm 14mm", boxSizing:"border-box" }}>
      <div style={{ display:"flex", alignItems:"center", gap:18, borderBottom:"3px solid #1e3a8a", paddingBottom:14, marginBottom:20 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width:72, height:72, objectFit:"contain", flexShrink:0 }} />
        <div style={{ flex:1, textAlign:"center" }}>
          <div style={{ fontSize:21, fontWeight:900, color:"#1e3a8a" }}>KIPS School Hassari</div>
          <div style={{ fontSize:11, color:"#ea580c", fontWeight:700, marginTop:3 }}>Bright Future — School Portal</div>
          <div style={{ fontSize:9, color:"#9ca3af", marginTop:2 }}>Fee Defaulters Report — {printDate}</div>
        </div>
      </div>
      <div style={{ display:"flex", gap:8, marginBottom:22 }}>
        {([
          { label:"Total Defaulters", value:String(filteredList.length),             color:"#1d4ed8" },
          { label:"Classes Affected", value:String(classNames.length),              color:"#7c3aed" },
          { label:"Amount Due",       value:`PKR ${totalPending.toLocaleString()}`, color:"#b91c1c" },
          { label:"Grand Total",      value:`PKR ${grandTotal.toLocaleString()}`,   color:"#7c2d12" },
        ] as { label:string; value:string; color:string }[]).map(c => (
          <div key={c.label} style={{ flex:"1 1 0", border:`2px solid ${c.color}`, borderRadius:7, padding:"9px 6px", textAlign:"center", background:"#f9fafb" }}>
            <div style={{ fontSize:7, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px" }}>{c.label}</div>
            <div style={{ fontSize:12, fontWeight:900, color:c.color, marginTop:5 }}>{c.value}</div>
          </div>
        ))}
      </div>
      {filteredList.length === 0 ? (
        <div style={{ textAlign:"center", color:"#9ca3af", fontStyle:"italic", padding:"30px 0", fontSize:11 }}>No defaulters!</div>
      ) : classNames.map(cls => {
        const rows = byClass[cls];
        const classDue  = rows.reduce((s,f) => s+(f.amount??0), 0);
        const classFine = rows.reduce((s,f) => s+(f.fine??0), 0);
        return (
          <div key={cls} style={{ marginBottom:20 }}>
            <div style={{ background:"#1e3a8a", color:"white", padding:"7px 12px", display:"flex", justifyContent:"space-between", alignItems:"center", borderRadius:"5px 5px 0 0" }}>
              <span style={{ fontWeight:800, fontSize:11 }}>{cls}</span>
              <span style={{ fontSize:9, opacity:0.85 }}>{rows.length} student{rows.length!==1?"s":""} | Total: PKR {(classDue+classFine).toLocaleString()}</span>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr>
                <th style={TH}>#</th><th style={TH}>Student Name</th><th style={TH}>Adm#</th>
                <th style={TH}>Month</th><th style={TH}>Amount Due</th><th style={TH}>Fine</th><th style={TH}>Due Date</th>
              </tr></thead>
              <tbody>
                {rows.map((fee,i) => (
                  <tr key={fee.id}>
                    <td style={i%2===0?TD:TDA}>{i+1}</td>
                    <td style={{...(i%2===0?TD:TDA),fontWeight:600}}>{fee.studentName||"—"}</td>
                    <td style={i%2===0?TD:TDA}>{fee.admissionNumber||"—"}</td>
                    <td style={i%2===0?TD:TDA}>
                      <div>{fee.month}</div>
                      {fee.notes && (
                        <div style={{ fontSize:7, color:"#6b7280", marginTop:2, fontStyle:"italic" }}>{fee.notes}</div>
                      )}
                    </td>
                    <td style={{...(i%2===0?TD:TDA),color:"#b91c1c",fontWeight:700}}>PKR {(fee.amount??0).toLocaleString()}</td>
                    <td style={i%2===0?TD:TDA}>{(fee.fine??0)>0?`PKR ${(fee.fine??0).toLocaleString()}`:"—"}</td>
                    <td style={i%2===0?TD:TDA}>{fee.dueDate}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr>
                <td colSpan={4} style={{...TH,background:"#fef2f2"}}>Class Total</td>
                <td style={{...TH,background:"#fef2f2",color:"#b91c1c"}}>PKR {classDue.toLocaleString()}</td>
                <td style={{...TH,background:"#fef2f2",color:"#c2410c"}}>{classFine>0?`PKR ${classFine.toLocaleString()}`:"—"}</td>
                <td style={{...TH,background:"#fef2f2"}} />
              </tr></tfoot>
            </table>
          </div>
        );
      })}
      <div style={{ background:"#7f1d1d", color:"white", padding:"10px 14px", borderRadius:6, display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8 }}>
        <span style={{ fontWeight:800, fontSize:12 }}>Grand Total — {filteredList.length} students</span>
        <span style={{ fontWeight:900, fontSize:14 }}>PKR {grandTotal.toLocaleString()}</span>
      </div>
      <div style={{ borderTop:"1px solid #e5e7eb", marginTop:24, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:7, color:"#9ca3af" }}>KIPS School Hassari — School Management Portal</span>
        <span style={{ fontSize:7, color:"#9ca3af" }}>Generated: {printDate}</span>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      {printPortal}
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-6 h-6 text-red-500" /> Fee Defaulters
            </h1>
            <p className="text-gray-500 text-sm mt-1">Students with unpaid / overdue fees</p>
          </div>
          <div className="flex gap-2 no-print">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print Report
            </Button>
          </div>
        </div>

        {/* Filters and Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border no-print shadow-sm">
          <div className="flex gap-2.5 items-center flex-wrap">
            <button
              onClick={() => setStatusFilter("active")}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all border ${
                statusFilter === "active"
                  ? "bg-red-600 text-white border-red-650 shadow-sm font-bold"
                  : "bg-white text-gray-650 border-gray-200 hover:border-gray-400"
              }`}
            >
              Active Students
            </button>
            <button
              onClick={() => setStatusFilter("inactive")}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all border ${
                statusFilter === "inactive"
                  ? "bg-red-600 text-white border-red-650 shadow-sm font-bold"
                  : "bg-white text-gray-650 border-gray-200 hover:border-gray-400"
              }`}
            >
              Inactive / Left Students
            </button>

            <Select value={classFilter} onValueChange={setClassFilter}>
              <SelectTrigger className="w-44 bg-white border border-gray-200 rounded-full text-xs font-semibold px-4 h-9">
                <SelectValue placeholder="All Classes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes (Sab Classes)</SelectItem>
                {sortedClasses.map(c => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCount > 0 ? (
            <Button
              onClick={handleOpenBulkDialog}
              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs rounded-full px-5 py-2.5 flex items-center gap-1.5 shadow-md border-green-700 w-full sm:w-auto animate-bounce"
            >
              <MessageCircle className="w-4 h-4" />
              Send Bulk WhatsApp ({selectedCount})
            </Button>
          ) : (
            <div className="text-xs text-gray-400 italic">Select students to send bulk WhatsApp</div>
          )}
        </div>

        {/* Summary cards */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
            {[
              { label:"Filtered Defaulters", value:filteredList.length,                    grad:"from-blue-500 to-indigo-600"   },
              { label:"Classes Affected", value:classNames.length,                      grad:"from-violet-500 to-purple-600" },
              { label:"Amount Due",       value:`PKR ${totalPending.toLocaleString()}`, grad:"from-red-500 to-rose-600"      },
              { label:"Grand Total",      value:`PKR ${grandTotal.toLocaleString()}`,   grad:"from-orange-600 to-red-700"    },
            ].map(c => (
              <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${c.grad} p-4`}>
                    <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">{c.label}</p>
                    <p className="text-white text-xl font-black mt-1">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {isLoading ? (
          <Card className="no-print overflow-hidden shadow-sm border">
            <CardContent className="p-6 space-y-3">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </CardContent>
          </Card>
        ) : sortedList.length === 0 ? (
          <div className="text-center py-16 no-print">
            <p className="text-lg font-bold text-emerald-600">✓ No Defaulters!</p>
            <p className="text-sm text-gray-400 mt-1">Sab fees clear hain</p>
          </div>
        ) : (
          <Card className="no-print overflow-hidden shadow-sm border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-red-600 to-rose-700 text-white">
                      <th className="py-3 px-3 text-left w-10">
                        <Checkbox
                          checked={sortedList.length > 0 && sortedList.every(f => selectedIds[f.studentId ?? 0])}
                          onCheckedChange={toggleSelectAll}
                          className="border-white data-[state=checked]:bg-white data-[state=checked]:text-red-600"
                        />
                      </th>
                      {["#", "Adm #", "Student Name", "Class", "Month(s)", "Amount Due", "Fine", "Due Date", "Phone", "Action"].map(h => {
                        const isAction = h === "Action";
                        return (
                          <th
                            key={h}
                            className={cn(
                              "text-left py-3 px-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap",
                              isAction && "sticky right-0 bg-[#be123c] z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]"
                            )}
                          >
                            {h}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedList.map((fee, i) => {
                      const total    = (fee.amount ?? 0) + (fee.fine ?? 0);
                      const waMsg    = buildWhatsAppMsg(fee.studentName ?? "Student", fee.className ?? "", fee.month, total, fee.dueDate ?? "", fee.waNotes || "", fee.phone);
                      const hasPhone = !!(fee.phone?.trim());
                      const isSelected = !!selectedIds[fee.studentId ?? 0];

                      return (
                        <tr
                          key={fee.id}
                          className={cn(
                            "group border-b transition-colors",
                            isSelected 
                              ? "bg-[#fef2f2] hover:bg-[#fee2e2]" 
                              : i % 2 === 0 
                              ? "bg-white hover:bg-[#fdf2f2]" 
                              : "bg-[#f9fafb] hover:bg-[#fdf2f2]"
                          )}
                        >
                          <td className="py-3.5 px-3">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelect(fee.studentId ?? 0)}
                            />
                          </td>
                          <td className="py-3.5 px-3 text-gray-400 text-xs font-medium">{i+1}</td>
                          <td className="py-3.5 px-3 font-mono text-[11px] font-bold text-purple-600 whitespace-nowrap">
                            {fee.admissionNumber || "—"}
                          </td>
                          <td className="py-3.5 px-3">
                            <div>
                              <p className="font-semibold text-gray-900 text-sm whitespace-nowrap">{fee.studentName || "—"}</p>
                              {fee.notes && (
                                <p className="text-[10px] text-gray-400 mt-0.5 max-w-[280px] leading-tight font-normal italic">
                                  {fee.notes}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <span className="inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                              {fee.className}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 text-gray-600 text-xs font-medium whitespace-nowrap">
                            {fee.month}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <p className="font-bold text-red-600 text-sm">PKR {total.toLocaleString()}</p>
                          </td>
                          <td className="py-3.5 px-3 text-orange-600 text-xs font-semibold whitespace-nowrap">
                            {(fee.fine ?? 0) > 0 ? `PKR ${(fee.fine??0).toLocaleString()}` : "—"}
                          </td>
                          <td className="py-3.5 px-3 text-gray-700 font-semibold whitespace-nowrap">
                            {fee.dueDate}
                          </td>
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            {hasPhone ? (
                              <div className="flex items-center gap-1 text-gray-700 text-xs font-medium">
                                <Phone className="w-3.5 h-3.5 text-gray-400" />
                                {fee.phone}
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className={cn(
                            "py-3.5 px-3 whitespace-nowrap sticky right-0 z-10 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.15)] transition-colors",
                            isSelected 
                              ? "bg-[#fef2f2] group-hover:bg-[#fee2e2]" 
                              : i % 2 === 0 
                              ? "bg-white group-hover:bg-[#fdf2f2]" 
                              : "bg-[#f9fafb] group-hover:bg-[#fdf2f2]"
                          )}>
                            <a
                              href={waMsg}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={hasPhone ? `Send reminder to ${fee.phone}` : "Send reminder (no phone — opens WA manually)"}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                hasPhone
                                  ? "bg-green-500 hover:bg-green-600 text-white border-green-600 shadow-sm"
                                  : "bg-green-55 text-green-700 border-green-200"
                              }`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              {hasPhone ? "WhatsApp" : "WA Msg"}
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-red-50/50 border-t-2 border-red-200">
                      <td colSpan={6} className="py-3 px-3 text-xs font-bold text-red-800">
                        Total Defaulters: {sortedList.length} student{sortedList.length !== 1 ? "s" : ""}
                      </td>
                      <td colSpan={5} className="py-3 px-3 text-right">
                        <span className="text-xs font-bold text-red-800 mr-2">Grand Total:</span>
                        <span className="text-base font-black text-red-600">PKR {grandTotal.toLocaleString()}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Bulk WhatsApp Dialog ── */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600 text-lg font-bold">
              <MessageCircle className="w-5 h-5" /> Bulk WhatsApp Reminders ({queueStudents.length} Students)
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
                        <Play className="w-4 h-4" /> Send to all ${queueStudents.length} Parents Automatically
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
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 py-1">
              <div className="md:col-span-5 border rounded-xl p-3 bg-gray-50 max-h-[350px] overflow-y-auto space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Sending Queue</p>
                {queueStudents.map((s, idx) => {
                  const isCurrent = idx === queueIndex;
                  const isSent = sentIds[s.studentId ?? 0];
                  return (
                    <div
                      key={s.studentId}
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
                          <span className="truncate">{s.studentName}</span>
                        </div>
                        <p className="text-[10px] text-gray-400">{s.className} · PKR {(s.amount ?? 0).toLocaleString()}</p>
                        {s.phone ? (
                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{s.phone}</p>
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

              <div className="md:col-span-7 flex flex-col gap-3 min-h-[350px]">
                {queueIndex < queueStudents.length ? (
                  <>
                    <div className="flex justify-between items-center bg-gray-100 p-2 rounded-xl">
                      <span className="text-xs font-bold text-gray-650">Language:</span>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => setTemplateLanguage("urdu")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                            templateLanguage === "urdu" ? "bg-green-600 text-white border-green-650" : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                          )}
                        >
                          Urdu (اردو)
                        </button>
                        <button
                          onClick={() => setTemplateLanguage("english")}
                          className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-bold transition-all border",
                            templateLanguage === "english" ? "bg-green-600 text-white border-green-650" : "bg-white text-gray-600 hover:bg-gray-50 border-gray-200"
                          )}
                        >
                          English
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-1.5">
                      <label className="text-xs font-bold text-gray-500">Edit Message Preview:</label>
                      <Textarea
                        value={currentMessageText}
                        onChange={e => setCurrentMessageText(e.target.value)}
                        dir={templateLanguage === "urdu" ? "rtl" : "ltr"}
                        className="flex-1 min-h-[180px] text-sm p-3 font-medium bg-white border border-gray-200 rounded-xl leading-relaxed focus:ring-2 focus:ring-green-150 focus:border-green-400"
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <div className="flex justify-between items-center text-xs text-gray-500 bg-gray-50 p-2 rounded-lg">
                        <span>Recipient: <strong>{queueStudents[queueIndex]?.studentName}</strong></span>
                        <span>Phone: <strong>{queueStudents[queueIndex]?.phone || "N/A"}</strong></span>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSendNext}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold text-sm py-3 rounded-xl shadow-lg border-green-700 flex items-center justify-center gap-2"
                        >
                          <MessageCircle className="w-5 h-5" /> Open WhatsApp &amp; Next
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleSkipNext}
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
                    <h3 className="text-lg font-bold text-green-800">All Reminders Processed!</h3>
                    <p className="text-sm text-green-600 mt-1 max-w-[280px]">
                      You have successfully opened links for all selected student reminders.
                    </p>
                    <Button
                      onClick={() => setBulkDialogOpen(false)}
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
    </>
  );
}
