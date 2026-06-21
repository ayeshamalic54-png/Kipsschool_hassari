import { useEffect } from "react";
import { createPortal } from "react-dom";
import { useGetFeeDefaulters } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, AlertTriangle, MessageCircle, Phone } from "lucide-react";

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

const TH: React.CSSProperties = { padding:"7px 9px", background:"#fee2e2", color:"#7f1d1d", fontWeight:700, fontSize:9, textAlign:"left", border:"1px solid #fca5a5" };
const TD: React.CSSProperties = { padding:"6px 9px", border:"1px solid #e5e7eb", fontSize:9, color:"#1f2937", background:"#ffffff" };
const TDA: React.CSSProperties = { ...TD, background:"#fff7f7" };

// ── WhatsApp message generator ────────────────────────────────────────────────
function buildWhatsAppMsg(studentName: string, className: string, month: string, amount: number, dueDate: string, phone?: string | null): string {
  const msg = `Assalam u Alaikum! 🌟\n\nKIPS School Hassari would like to remind you that the fee for your child *${studentName}* (Class: ${className}) for the month of *${month}* is:\n\n💰 Amount: *PKR ${amount.toLocaleString()}*\n📅 Due Date: *${dueDate}*\n\nIt has not been paid yet. Kindly make the payment as soon as possible..\n\nThank you! 🙏\nKIPS School Hassari`;

  const encoded = encodeURIComponent(msg);
  const cleanPhone = (phone ?? "").replace(/\D/g, "");
  const intlPhone  = cleanPhone.startsWith("0") ? "92" + cleanPhone.slice(1) : cleanPhone.startsWith("92") ? cleanPhone : "92" + cleanPhone;
  return intlPhone.length > 4
    ? `https://wa.me/${intlPhone}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`;
}

interface FeeItem {
  id: number;
  studentName?: string | null;
  admissionNumber?: string | null;
  className?: string | null;
  month: string;
  amount?: number | null;
  fine?: number | null;
  dueDate?: string | null;
  phone?: string | null;
}

export default function FeeDefaulters() {
  const { data: defaulters, isLoading } = useGetFeeDefaulters();

  useEffect(() => {
    const prev = document.getElementById("kips-print-styles"); if (prev) prev.remove();
    const el = document.createElement("style"); el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES; document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const list         = (defaulters ?? []) as FeeItem[];
  const totalPending = list.reduce((s, f) => s + (f.amount ?? 0), 0);
  const totalFine    = list.reduce((s, f) => s + (f.fine   ?? 0), 0);
  const grandTotal   = totalPending + totalFine;

  const byClass: Record<string, FeeItem[]> = {};
  for (const f of list) {
    const key = f.className || "No Class";
    if (!byClass[key]) byClass[key] = [];
    byClass[key].push(f);
  }
  const classNames = Object.keys(byClass).sort();

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
                    <td style={i%2===0?TD:TDA}>{fee.month}</td>
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
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print Report
          </Button>
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

        {/* Table */}
        <Card className="no-print">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-12 w-full"/>)}</div>
            ) : list.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-lg font-bold text-emerald-600">✓ No Defaulters!</p>
                <p className="text-sm text-gray-400 mt-1">Sab fees clear hain</p>
              </div>
            ) : (
              <div className="divide-y">
                {classNames.map(cls => (
                  <div key={cls}>
                    {/* Class header */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-blue-700 to-indigo-700 flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{cls}</span>
                      <span className="text-xs text-white/80">
                        {byClass[cls].length} student{byClass[cls].length!==1?"s":""} &nbsp;|&nbsp;
                        PKR {byClass[cls].reduce((s,f)=>s+(f.amount??0)+(f.fine??0),0).toLocaleString()}
                      </span>
                    </div>

                    {/* Students in class */}
                    <div className="divide-y">
                      {byClass[cls].map((fee, i) => {
                        const total    = (fee.amount ?? 0) + (fee.fine ?? 0);
                        const waMsg    = buildWhatsAppMsg(fee.studentName ?? "Student", fee.className ?? "", fee.month, fee.amount ?? 0, fee.dueDate ?? "", fee.phone);
                        const hasPhone = !!(fee.phone?.trim());

                        return (
                          <div key={fee.id} className={`flex items-center gap-4 px-4 py-3 hover:bg-red-50/40 transition-colors ${i%2===0?"bg-white":"bg-red-50/20"}`}>
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-gray-900">{fee.studentName || "—"}</p>
                                <span className="font-mono text-[11px] text-purple-600 font-bold">{fee.admissionNumber || "—"}</span>
                              </div>
                              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{fee.className}</span>
                                <span>{fee.month}</span>
                                <span>Due: <strong className="text-red-600">{fee.dueDate}</strong></span>
                                {hasPhone && (
                                  <span className="flex items-center gap-1 text-gray-400">
                                    <Phone className="w-3 h-3" />{fee.phone}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Amount */}
                            <div className="text-right shrink-0">
                              <p className="text-lg font-black text-red-600">PKR {total.toLocaleString()}</p>
                              {(fee.fine ?? 0) > 0 && (
                                <p className="text-[10px] text-orange-500">incl. PKR {(fee.fine??0).toLocaleString()} fine</p>
                              )}
                            </div>

                            {/* WhatsApp button */}
                            <a
                              href={waMsg}
                              target="_blank"
                              rel="noopener noreferrer"
                              title={hasPhone ? `Send reminder to ${fee.phone}` : "Send reminder (no phone — opens WA manually)"}
                              className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                                hasPhone
                                  ? "bg-green-500 hover:bg-green-600 text-white border-green-600 shadow-sm"
                                  : "bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                              }`}
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              {hasPhone ? "WhatsApp" : "WA Msg"}
                            </a>
                          </div>
                        );
                      })}
                    </div>

                    {/* Class subtotal */}
                    <div className="px-4 py-2 bg-red-50 flex justify-between text-xs font-semibold text-red-800 border-t border-red-100">
                      <span>Class Total — {byClass[cls].length} students</span>
                      <span>PKR {byClass[cls].reduce((s,f)=>s+(f.amount??0)+(f.fine??0),0).toLocaleString()}</span>
                    </div>
                  </div>
                ))}

                {/* Grand total */}
                <div className="px-4 py-3 bg-gray-900 flex items-center justify-between">
                  <span className="text-sm font-bold text-white">Grand Total — {list.length} students</span>
                  <span className="text-base font-black text-red-300">PKR {grandTotal.toLocaleString()}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
