import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGetFeeDefaulters, useListClasses } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, AlertTriangle, MessageCircle, Phone, Grid3X3, LayoutList, BookOpen, User } from "lucide-react";
import { cn } from "@/lib/utils";

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

// ── Gradient palette & card bg matching students/contacts pages ────────────────
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
  { bg: "#f5f3ff", border: "#ddd6fe", tag: "#7c3aed" },  // violet
  { bg: "#fff1f2", border: "#fecdd3", tag: "#e11d48" },  // pink
  { bg: "#eff6ff", border: "#bfdbfe", tag: "#2563eb" },  // blue
  { bg: "#ecfeff", border: "#a5f3fc", tag: "#0891b2" },  // cyan
  { bg: "#f0fdf4", border: "#bbf7d0", tag: "#059669" },  // teal
  { bg: "#f0fdf4", border: "#86efac", tag: "#16a34a" },  // green
  { bg: "#fffbeb", border: "#fde68a", tag: "#d97706" },  // amber
  { bg: "#fff7ed", border: "#fed7aa", tag: "#ea580c" },  // orange
  { bg: "#fdf4ff", border: "#f0abfc", tag: "#c026d3" },  // fuchsia
  { bg: "#f0f9ff", border: "#bae6fd", tag: "#0284c7" },  // sky
  { bg: "#ecfdf5", border: "#6ee7b7", tag: "#059669" },  // emerald
  { bg: "#fff1f2", border: "#fda4af", tag: "#e11d48" },  // rose
  { bg: "#eef2ff", border: "#c7d2fe", tag: "#4f46e5" },  // indigo
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

// ── WhatsApp message generator ────────────────────────────────────────────────
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

interface FeeItem {
  id: number;
  studentId?: number | null;
  studentName?: string | null;
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
  const [viewMode, setViewMode] = useState<"card" | "list">("list");
  const { data: defaulters, isLoading } = useGetFeeDefaulters({ status: statusFilter });
  const { data: classes } = useListClasses();

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
  const getGrad = (cId?: number | null) => cId != null && classColorMap.has(cId) ? GRADIENTS[classColorMap.get(cId)!] : "from-slate-500 to-gray-600";
  const getCard = (cId?: number | null) => cId != null && classColorMap.has(cId) ? CARD_BG[classColorMap.get(cId)! % CARD_BG.length] : CARD_BG[0];
  
  // Group by student ID to consolidate all fee records across all months
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
    
    // Detailed notes lists
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

    // Use the latest due date among all consolidated items
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

  const sortedList = [...list].sort((a, b) => {
    const rankA = getClassRank(a.className || "");
    const rankB = getClassRank(b.className || "");
    if (rankA !== rankB) return rankA - rankB;
    return (a.studentName || "").localeCompare(b.studentName || "");
  });

  const totalPending = list.reduce((s, f) => s + (f.amount ?? 0), 0);
  const totalFine    = list.reduce((s, f) => s + (f.fine   ?? 0), 0);
  const grandTotal   = totalPending + totalFine;

  const byClass: Record<string, FeeItem[]> = {};
  for (const f of list) {
    const key = f.className || "No Class";
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(f);
  }
  const classNames = Object.keys(byClass).sort((a, b) => getClassRank(a) - getClassRank(b));

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
          { label:"Total Defaulters", value:String(list.length),                    color:"#1d4ed8" },
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
      {list.length === 0 ? (
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
        <span style={{ fontWeight:800, fontSize:12 }}>Grand Total — {list.length} students</span>
        <span style={{ fontWeight:900, fontSize:14 }}>PKR {grandTotal.toLocaleString()}</span>
      </div>
      <div style={{ borderTop:"1px solid #e5e7eb", marginTop:24, paddingTop:8, display:"flex", justifyContent:"space-between" }}>
        <span style={{ fontSize:7, color:"#9ca3af" }}>KIPS School Hassari — School Management Portal</span>
        <span style={{ fontSize:7, color:"#9ca3af" }}>Generated: {printDate}</span>
      </div>
    </div>,
    document.body
  );

  // ── Screen view ───────────────────────────────────────────────────────────
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
            <div className="flex border rounded-lg overflow-hidden bg-white shadow-sm">
              <button
                onClick={() => setViewMode("card")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors",
                  viewMode === "card" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                <Grid3X3 className="w-3.5 h-3.5" /> Cards
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l",
                  viewMode === "list" ? "bg-red-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                )}
              >
                <LayoutList className="w-3.5 h-3.5" /> List
              </button>
            </div>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print Report
            </Button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex gap-1.5 flex-wrap no-print">
          {[
            { key: "active", label: "Active Students" },
            { key: "inactive", label: "Inactive / Left Students" }
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setStatusFilter(s.key as "active" | "inactive")}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all border ${
                statusFilter === s.key
                  ? "bg-red-600 text-white border-red-600 shadow-sm font-bold"
                  : "bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Summary cards */}
        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
            {[
              { label:"Total Defaulters", value:list.length,                            grad:"from-blue-500 to-indigo-600"   },
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
          viewMode === "card" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : (
            <Card className="no-print overflow-hidden shadow-sm border">
              <CardContent className="p-6 space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </CardContent>
            </Card>
          )
        ) : sortedList.length === 0 ? (
          <div className="text-center py-16 no-print">
            <p className="text-lg font-bold text-emerald-600">✓ No Defaulters!</p>
            <p className="text-sm text-gray-400 mt-1">Sab fees clear hain</p>
          </div>
        ) : viewMode === "card" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 no-print">
            {sortedList.map(fee => {
              const classId = fee.classId;
              const card = getCard(classId);
              const grad = getGrad(classId);
              const total = (fee.amount ?? 0) + (fee.fine ?? 0);
              const waMsg = buildWhatsAppMsg(fee.studentName ?? "Student", fee.className ?? "", fee.month, total, fee.dueDate ?? "", fee.waNotes || "", fee.phone);
              const hasPhone = !!(fee.phone?.trim());

              return (
                <div
                  key={fee.id}
                  className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 border flex flex-col"
                  style={{ background: card.bg, borderColor: card.border }}
                >
                  <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />
                  <div className="p-4 flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-3">
                      <div className={`w-[52px] h-[52px] rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0 border-2 border-white/80 overflow-hidden text-white font-extrabold text-xl`}>
                        {fee.studentName?.charAt(0) || "S"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900 truncate text-[15px] leading-tight">{fee.studentName}</h3>
                        {fee.fatherName && <p className="text-xs text-gray-550 truncate mt-0.5">s/o {fee.fatherName}</p>}
                        <p className="text-[11px] font-mono mt-0.5 font-semibold" style={{ color: card.tag }}>{fee.admissionNumber}</p>
                      </div>
                    </div>

                    {fee.className && (
                      <div>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r ${grad} text-white shadow-sm`}>
                          <BookOpen className="w-3 h-3" />
                          {fee.className}
                        </span>
                      </div>
                    )}

                    <div className="space-y-2 text-sm flex-1">
                      <div className="rounded-lg px-3 py-2 text-xs text-gray-655 leading-relaxed" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${card.border}` }}>
                        <div className="font-bold text-gray-700 mb-1">Unpaid Month(s): {fee.month}</div>
                        {fee.notes && <div className="italic text-gray-500 font-medium">{fee.notes}</div>}
                      </div>

                      <div className="flex items-center justify-between rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${card.border}` }}>
                        <div>
                          <div className="text-gray-500">Amount Due</div>
                          <div className="font-extrabold text-[15px] text-red-600">PKR {total.toLocaleString()}</div>
                        </div>
                        {(fee.fine ?? 0) > 0 && (
                          <div className="text-right">
                            <div className="text-gray-500">Late Fine</div>
                            <div className="font-bold text-orange-600">PKR {(fee.fine ?? 0).toLocaleString()}</div>
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-1 text-[11px] text-gray-500 mt-1">
                        {fee.dueDate && (
                          <div className="flex items-center gap-1">
                            <span className="font-semibold text-gray-600">Due Date:</span>
                            <span className="text-gray-800 font-bold">{fee.dueDate}</span>
                          </div>
                        )}
                        {fee.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-gray-400" />
                            <span className="text-gray-700">{fee.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-100/50 flex justify-end">
                      <a
                        href={waMsg}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(
                          "flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border w-full text-center shadow-sm",
                          hasPhone
                            ? "bg-green-500 hover:bg-green-600 text-white border-green-600"
                            : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        )}
                      >
                        <MessageCircle className="w-4 h-4" />
                        {hasPhone ? "Send WhatsApp" : "Send WA Message"}
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card className="no-print overflow-hidden shadow-sm border">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[900px]">
                  <thead>
                    <tr className="bg-gradient-to-r from-red-600 to-rose-700 text-white">
                      {["#", "Adm #", "Student Name", "Class", "Month(s)", "Amount Due", "Fine", "Due Date", "Phone", "Action"].map(h => (
                        <th key={h} className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedList.map((fee, i) => {
                      const total    = (fee.amount ?? 0) + (fee.fine ?? 0);
                      const waMsg    = buildWhatsAppMsg(fee.studentName ?? "Student", fee.className ?? "", fee.month, total, fee.dueDate ?? "", fee.waNotes || "", fee.phone);
                      const hasPhone = !!(fee.phone?.trim());

                      return (
                        <tr key={fee.id} className={`border-b hover:bg-red-50/20 transition-colors ${i%2===0?"bg-white":"bg-gray-50/40"}`}>
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
                          
                          <td className="py-3.5 px-3 whitespace-nowrap">
                            <a
                              href={waMsg}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={hasPhone ? `Send reminder to ${fee.phone}` : "Send reminder (no phone — opens WA manually)"}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                                hasPhone
                                  ? "bg-green-500 hover:bg-green-600 text-white border-green-600 shadow-sm"
                                  : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
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
                      <td colSpan={5} className="py-3 px-3 text-xs font-bold text-red-800">
                        Total Pending: {sortedList.length} student{sortedList.length !== 1 ? "s" : ""}
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
    </>
  );
}

