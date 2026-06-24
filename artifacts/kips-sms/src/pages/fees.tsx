import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useListFees, useCreateFee, usePayFee,
  useListStudents, useListClasses,
  getListFeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm }  from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z }        from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, CheckCircle, Clock, AlertCircle,
  Printer, Pencil, Trash2, Grid3X3, LayoutList,
  CreditCard, TrendingUp, TrendingDown, DollarSign, Search,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { useSchoolInfo } from "@/lib/school-info";
import type { FeeRecord } from "@workspace/api-client-react";

// ── Auth helper ───────────────────────────────────────────────────────────────
function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...authHeader(), ...options?.headers },
  });
  if (!res.ok) { const msg = await res.text().catch(() => "Request failed"); throw new Error(msg); }
  return res.status === 204 ? null : res.json();
}

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

type FeeStructure = {
  id: number; classId: number; className: string | null;
  monthlyFee: number; admissionFee: number; lateFine: number; notes: string | null;
};
interface Receipt {
  receiptNo: string; studentName: string; admissionNumber: string;
  className: string; month: string; amountPaid: number; remaining: number;
  newStatus: string; paidDate: string;
}

const STATUS = {
  paid:    { icon: CheckCircle, label:"Paid",    grad:"from-emerald-500 to-teal-600",   light:"bg-emerald-50 border-emerald-200",  badge:"bg-emerald-100 text-emerald-700 border-emerald-200" },
  unpaid:  { icon: AlertCircle, label:"Unpaid",  grad:"from-red-500 to-rose-600",       light:"bg-red-50 border-red-200",          badge:"bg-red-100 text-red-700 border-red-200"             },
  partial: { icon: Clock,       label:"Partial", grad:"from-amber-400 to-orange-500",   light:"bg-amber-50 border-amber-200",      badge:"bg-amber-100 text-amber-700 border-amber-200"       },
};

const addFeeSchema = z.object({
  studentId: z.string().min(1,"Student required"),
  amount:    z.string().min(1,"Amount required"),
  month:     z.string().min(1,"Month required"),
  dueDate:   z.string().min(1,"Due date required"),
  fine:      z.string().optional(),
  discount:  z.string().optional(),
});
const editFeeSchema = z.object({
  amount:  z.string().min(1,"Amount required"),
  month:   z.string().min(1,"Month required"),
  dueDate: z.string().min(1,"Due date required"),
  fine:    z.string().optional(),
});

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .no-print { display: none !important; }
    body > *:not(#fee-print-portal) { display: none !important; }
    #fee-print-portal {
      display: block !important;
      position: static !important;
      width: 100% !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      padding: 12mm 14mm !important;
      box-sizing: border-box !important;
    }
    table { border-collapse: collapse !important; width: 100% !important; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

// ── Receipt HTML ──────────────────────────────────────────────────────────────
function esc(s: unknown) { return String(s??"").replace(/[&<>"']/g,c=>({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]??c)); }
function buildReceiptHtml(r: Receipt, logo: string) {
  const paidFull = r.remaining<=0;
  const copy = (lbl:string) => `<div class="receipt"><div class="copy-tag">${esc(lbl)}</div>
    <div class="header"><img src="${esc(logo)}" class="logo"/><div><div class="sname">KIPS School Hassari</div><div class="tag">Bright Future</div></div></div>
    <div class="bar">FEE PAYMENT RECEIPT</div>
    <div class="meta"><span><b>Receipt#:</b>${esc(r.receiptNo)}</span><span><b>Date:</b>${esc(r.paidDate)}</span></div>
    <table class="info"><tr><td class="l">Student</td><td><b>${esc(r.studentName)}</b></td></tr>
    <tr><td class="l">Adm#</td><td>${esc(r.admissionNumber)}</td></tr>
    <tr><td class="l">Class</td><td>${esc(r.className)}</td></tr>
    <tr><td class="l">Month</td><td><b>${esc(r.month)}</b></td></tr></table>
    <div class="amt ${paidFull?"paid":"partial"}"><div class="al">AMOUNT PAID</div><div class="av">PKR ${r.amountPaid.toLocaleString()}</div>
    <div class="as">${paidFull?"✓ FULLY PAID":`Remaining: PKR ${r.remaining.toLocaleString()}`}</div></div>
    <div class="sigs"><div class="sig"><div class="sl"></div><div>Cashier</div></div><div class="sig"><div class="sl"></div><div>Authorized</div></div></div>
    <div class="foot">Thank you • Keep this receipt</div></div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Receipt</title><style>
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;-webkit-print-color-adjust:exact!important}
.page{max-width:180mm;margin:0 auto}.receipt{border:1.5px solid #1a2a5e;border-radius:6px;padding:14px 18px;margin-bottom:10px;position:relative}
.copy-tag{position:absolute;top:-1px;right:14px;background:#1a2a5e;color:#fff;font-size:10px;font-weight:700;padding:3px 14px;border-radius:0 0 4px 4px;-webkit-print-color-adjust:exact}
.header{display:flex;align-items:center;gap:12px;padding-bottom:10px;border-bottom:1px solid #ddd;margin-bottom:8px}
.logo{width:50px;height:50px;border-radius:50%;object-fit:cover;border:1.5px solid #1a2a5e}
.sname{font-size:17px;font-weight:800;color:#1a2a5e}.tag{font-size:10px;color:#666}
.bar{text-align:center;background:#1a2a5e;color:#fff;font-size:11px;font-weight:700;letter-spacing:3px;padding:5px;margin:8px 0;border-radius:3px;-webkit-print-color-adjust:exact}
.meta{display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px}
.info{width:100%;font-size:12px;border-collapse:collapse;margin-bottom:10px}.info td{padding:5px 8px;border-bottom:1px dotted #ccc}.l{color:#666;width:35%}
.amt{text-align:center;padding:12px;margin-bottom:10px;border-radius:4px;color:#fff;-webkit-print-color-adjust:exact}.paid{background:#059669}.partial{background:#0891b2}
.al{font-size:10px;letter-spacing:2px;opacity:.9}.av{font-size:24px;font-weight:800;margin:3px 0}.as{font-size:11px;font-weight:600}
.sigs{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:14px 0 8px;text-align:center;font-size:10px;color:#666}
.sl{border-top:1px solid #333;height:1px;margin-bottom:3px}.foot{text-align:center;font-size:9px;color:#888;padding-top:6px;border-top:1px dashed #ddd}
.cut{text-align:center;font-size:9px;color:#999;letter-spacing:3px;padding:4px 0;margin:2px 0;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc}
.no-print{position:fixed;top:10px;right:10px;background:#1a2a5e;color:#fff;padding:8px 14px;border-radius:4px;font-size:12px;cursor:pointer;border:none;font-weight:600}
@media print{.no-print{display:none}}</style></head>
<body><button class="no-print" onclick="window.print()">🖨️ Print</button>
<div class="page">${copy("SCHOOL COPY")}<div class="cut">✂ CUT HERE ✂</div>${copy("PARENT COPY")}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Fees() {
  const [viewMode,     setViewMode]     = useState<"card"|"list">("card");
  const [addOpen,      setAddOpen]      = useState(false);
  const [payOpen,      setPayOpen]      = useState<number|null>(null);
  const [editFee,      setEditFee]      = useState<FeeRecord|null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeRecord|null>(null);
  const [deletingId,   setDeletingId]   = useState<number|null>(null);
  const [editSaving,   setEditSaving]   = useState(false);
  const [payAmount,    setPayAmount]    = useState("");
  const [payDiscount,  setPayDiscount]  = useState("0");
  const [statusFilter, setStatusFilter] = useState<string|undefined>();
  const [classFilter,  setClassFilter]  = useState<string|undefined>();
  const [searchQ,      setSearchQ]      = useState("");
  const [receipt,      setReceipt]      = useState<Receipt|null>(null);
  const [structs,      setStructs]      = useState<FeeStructure[]>([]);
  const [selClassId,   setSelClassId]   = useState("");
  const [stuSearch,    setStuSearch]    = useState("");

  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const schoolInfo  = useSchoolInfo();
  const isAdmin     = user?.role === "admin";
  const isStudent   = user?.role === "student";

  const { data: fees, isLoading } = useListFees({});
  const { data: students }        = useListStudents({});
  const { data: classes }         = useListClasses();
  const createMut = useCreateFee();
  const payMut    = usePayFee();
  const currFee   = fees?.find(f => f.id === payOpen);

  useEffect(() => {
    apiFetch("/api/fee-structures").then(d => setStructs(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  // Print styles inject
  useEffect(() => {
    const el = document.createElement("style"); el.id="kips-fee-print";
    el.textContent = PRINT_STYLES; document.head.appendChild(el);
    return () => { document.getElementById("kips-fee-print")?.remove(); };
  }, []);

  // ── Filtered data ─────────────────────────────────────────────────────────
  const allFees      = fees ?? [];

  // FIX: Filter by classId (numeric comparison) instead of className string match
  const rawDisplayFees = allFees
    .filter(f => {
      if (!classFilter) return true;
      const fExt = f as unknown as Record<string,unknown>;
      // Try classId first (most reliable), fall back to className match
      if (fExt.classId !== undefined && fExt.classId !== null) {
        return String(fExt.classId) === classFilter;
      }
      // Fallback: match by class name
      const cls = classes?.find(c => String(c.id) === classFilter);
      return cls ? f.className === cls.name : true;
    })
    .filter(f => !statusFilter || (statusFilter==="unpaid" ? f.status!=="paid" : f.status===statusFilter))
    .filter(f => {
      const q = searchQ.trim().toLowerCase(); if (!q) return true;
      const ext = f as unknown as Record<string,unknown>;
      return (f.studentName??"").toLowerCase().includes(q) ||
             ((ext.admissionNumber as string)??"").toLowerCase().includes(q);
    });

  const displayFees = isStudent
    ? (() => {
        const uniqueMonths = Array.from(new Set(rawDisplayFees.map(f => getCleanMonth(f.month))));
        return uniqueMonths.map(m => {
          const items = rawDisplayFees.filter(f => getCleanMonth(f.month) === m);
          const first = items[0];
          const amount = items.reduce((s, i) => s + Number(i.amount ?? 0), 0);
          const paidAmount = items.reduce((s, i) => s + Number(i.paidAmount ?? 0), 0);
          const remainingAmount = items.reduce((s, i) => s + Number(i.remainingAmount ?? 0), 0);
          const fine = items.reduce((s, i) => s + Number((i as any).fine ?? 0), 0);
          const discount = items.reduce((s, i) => s + Number((i as any).discount ?? 0), 0);
          
          let status: "paid" | "unpaid" | "partial" = "unpaid";
          const allPaid = items.every(i => i.status === "paid");
          const allUnpaid = items.every(i => i.status === "unpaid");
          if (allPaid) {
            status = "paid";
          } else if (allUnpaid) {
            status = "unpaid";
          } else {
            status = "partial";
          }

          return {
            ...first,
            id: first?.id ?? 0,
            month: formatCleanMonth(m),
            amount,
            paidAmount,
            remainingAmount,
            status,
            fine,
            discount,
            notes: items.map(i => `${i.notes ?? 'Fee'}: PKR ${Number(i.amount).toLocaleString()}`).join(", "),
          } as unknown as FeeRecord;
        });
      })()
    : rawDisplayFees;

  const totalAmt  = allFees.reduce((s,f)=>s+f.amount,0);
  const totalPaid = allFees.reduce((s,f)=>s+(f.paidAmount??0),0);
  const totalRem  = allFees.reduce((s,f)=>s+(f.remainingAmount??0),0);

  const ext = (f:FeeRecord) => f as unknown as Record<string,unknown>;
  const st  = (s:string) => STATUS[s as keyof typeof STATUS] ?? STATUS.unpaid;
  const printDate = new Date().toLocaleDateString("en-PK",{day:"numeric",month:"long",year:"numeric"});

  // ── Print Portal ──────────────────────────────────────────────────────────
  const TH:React.CSSProperties = { padding:"7px 10px", background:"#1a2a5e", color:"#fff", fontWeight:700, fontSize:9, textAlign:"left", border:"1px solid #3b5998" };
  const TD = (alt:boolean):React.CSSProperties => ({ padding:"6px 10px", border:"1px solid #e5e7eb", fontSize:9, color:"#1f2937", background:alt?"#f0f4ff":"#fff" });

  const selClassName = classFilter ? classes?.find(c=>String(c.id)===classFilter)?.name : undefined;

  const printPortal = createPortal(
    <div id="fee-print-portal" style={{ position:"absolute", left:"-99999px", top:"-99999px", fontFamily:"Arial, sans-serif" }}>
      {/* Letterhead */}
      <div style={{ display:"flex", alignItems:"center", gap:16, borderBottom:"3px solid #1a2a5e", paddingBottom:12, marginBottom:18 }}>
        <img src={schoolInfo.logoUrl||"/kips-logo.jpeg"} alt="KIPS"
          style={{ width:72, height:72, objectFit:"cover", borderRadius:"50%", border:"2px solid #e07b1a" }}
          onError={e=>{(e.target as HTMLImageElement).src="/kips-logo.jpeg";}} />
        <div style={{ flex:1, textAlign:"center" }}>
          <h1 style={{ margin:0, fontSize:20, fontWeight:900, color:"#1a2a5e" }}>{schoolInfo.name||"KIPS School Hassari"}</h1>
          <p style={{ margin:"2px 0 0", fontSize:11, color:"#e07b1a", fontWeight:700 }}>{schoolInfo.tagline||"Bright Future"}</p>
          <p style={{ margin:"3px 0 0", fontSize:9, color:"#6b7280" }}>{printDate}</p>
        </div>
      </div>
      {/* Title */}
      <div style={{ textAlign:"center", marginBottom:16 }}>
        <h2 style={{ margin:0, fontSize:15, fontWeight:800, color:"#1a2a5e" }}>
          Fee Records{selClassName ? ` — ${selClassName}` : ""}
          {statusFilter ? ` (${statusFilter.charAt(0).toUpperCase()+statusFilter.slice(1)})` : ""}
        </h2>
        <p style={{ margin:"4px 0 0", fontSize:9, color:"#6b7280" }}>Total Records: {displayFees.length}</p>
      </div>
      {/* Summary row */}
      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
        {([
          { label:"Total Amount", value:`PKR ${displayFees.reduce((s,f)=>s+f.amount,0).toLocaleString()}`, color:"#1a2a5e" },
          { label:"Total Paid",   value:`PKR ${displayFees.reduce((s,f)=>s+(f.paidAmount??0),0).toLocaleString()}`, color:"#059669" },
          { label:"Outstanding",  value:`PKR ${displayFees.reduce((s,f)=>s+(f.remainingAmount??0),0).toLocaleString()}`, color:"#dc2626" },
        ] as {label:string;value:string;color:string}[]).map(c=>(
          <div key={c.label} style={{ flex:"1 1 0", border:`1.5px solid ${c.color}`, borderRadius:6, padding:"7px 8px", textAlign:"center", background:"#f9fafb" }}>
            <div style={{ fontSize:7, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:"0.5px" }}>{c.label}</div>
            <div style={{ fontSize:12, fontWeight:900, color:c.color, marginTop:4 }}>{c.value}</div>
          </div>
        ))}
      </div>
      {/* Table */}
      <table style={{ width:"100%", borderCollapse:"collapse" }}>
        <thead>
          <tr>{["#","Adm #","Student Name","Father","Class","Month","Amount","Fine","Paid","Remaining","Due Date","Status"].map(h=>(
            <th key={h} style={TH}>{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          {!displayFees.length
            ? <tr><td colSpan={12} style={{...TD(false),textAlign:"center",color:"#9ca3af",fontStyle:"italic"}}>No records</td></tr>
            : displayFees.map((fee,i)=>{
                const e = ext(fee);
                const admNo = (e.admissionNumber as string)??"—";
                const fine  = Number(e.fine??0);
                const disc  = Number(e.discount??0);
                const statusData = st(fee.status);
                return (
                  <tr key={fee.id}>
                    <td style={TD(i%2===1)}>{i+1}</td>
                    <td style={{...TD(i%2===1),color:"#7c3aed",fontFamily:"monospace",fontWeight:700}}>{admNo}</td>
                    <td style={{...TD(i%2===1),fontWeight:600}}>{fee.studentName||"—"}</td>
                    <td style={TD(i%2===1)}>{(e.fatherName as string)||"—"}</td>
                    <td style={TD(i%2===1)}>{fee.className||"—"}</td>
                    <td style={TD(i%2===1)}>
                      <div>{fee.month}</div>
                      {isStudent && ext(fee).notes && (
                        <div style={{ fontSize: 8, color: "#6b7280", marginTop: 2 }}>{ext(fee).notes as string}</div>
                      )}
                    </td>
                    <td style={{...TD(i%2===1),fontWeight:600}}>PKR {fee.amount.toLocaleString()}</td>
                    <td style={TD(i%2===1)}>{fine>0?`PKR ${fine.toLocaleString()}`:"—"}</td>
                    <td style={{...TD(i%2===1),color:"#059669",fontWeight:700}}>PKR {(fee.paidAmount??0).toLocaleString()}</td>
                    <td style={{...TD(i%2===1),color:"#dc2626",fontWeight:700}}>PKR {(fee.remainingAmount??0).toLocaleString()}</td>
                    <td style={TD(i%2===1)}>{fee.dueDate}</td>
                    <td style={TD(i%2===1)}>{statusData.label}</td>
                  </tr>
                );
              })
          }
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={6} style={{...TH,background:"#f0f4ff",color:"#1a2a5e"}}>Total ({displayFees.length})</td>
            <td style={{...TH,background:"#f0f4ff",color:"#1a2a5e"}}>PKR {displayFees.reduce((s,f)=>s+f.amount,0).toLocaleString()}</td>
            <td style={{...TH,background:"#f0f4ff",color:"#1a2a5e"}}></td>
            <td style={{...TH,background:"#f0f4ff",color:"#059669"}}>PKR {displayFees.reduce((s,f)=>s+(f.paidAmount??0),0).toLocaleString()}</td>
            <td style={{...TH,background:"#f0f4ff",color:"#dc2626"}}>PKR {displayFees.reduce((s,f)=>s+(f.remainingAmount??0),0).toLocaleString()}</td>
            <td colSpan={2} style={{...TH,background:"#f0f4ff"}}></td>
          </tr>
        </tfoot>
      </table>
      {/* Footer */}
      <div style={{ marginTop:24, borderTop:"1px solid #e5e7eb", paddingTop:8, display:"flex", justifyContent:"space-between", fontSize:8, color:"#9ca3af" }}>
        <span>KIPS School Hassari — Fee Management System</span>
        <span>Printed: {printDate}</span>
      </div>
    </div>,
    document.body
  );

  // ── Mutations ──────────────────────────────────────────────────────────────
  const addForm = useForm<z.infer<typeof addFeeSchema>>({
    resolver: zodResolver(addFeeSchema), defaultValues:{fine:"0",discount:"0"},
  });
  const handleStudentChange = (id:string, onChange:(v:string)=>void) => {
    onChange(id);
    const stu = students?.find(s=>s.id===Number(id));
    if (stu?.classId) {
      setSelClassId(String(stu.classId));
      const fs = structs.find(s=>s.classId===stu.classId);
      if (fs) { addForm.setValue("amount",String(fs.monthlyFee)); addForm.setValue("fine",String(fs.lateFine??0)); }
    }
  };
  const onAddSubmit = (v:z.infer<typeof addFeeSchema>) => {
    createMut.mutate({ data:{ studentId:Number(v.studentId), amount:Number(v.amount), month:v.month, dueDate:v.dueDate, fine:Number(v.fine??0), discount:Number(v.discount??0) } as never }, {
      onSuccess:()=>{ queryClient.invalidateQueries({queryKey:getListFeesQueryKey()}); toast({title:"Fee record created"}); setAddOpen(false); addForm.reset({fine:"0",discount:"0"}); setSelClassId(""); },
      onError:()=>toast({variant:"destructive",title:"Failed to create fee record"}),
    });
  };

  const editForm = useForm<z.infer<typeof editFeeSchema>>({ resolver:zodResolver(editFeeSchema) });
  const openEditFee = (fee:FeeRecord) => {
    setEditFee(fee);
    editForm.reset({ amount:String(fee.amount), month:fee.month, dueDate:fee.dueDate, fine:String(ext(fee).fine??0) });
  };
  const onEditSubmit = async (v:z.infer<typeof editFeeSchema>) => {
    if (!editFee) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/fees/${editFee.id}`,{method:"PUT",body:JSON.stringify({amount:Number(v.amount),month:v.month,dueDate:v.dueDate,fine:Number(v.fine??0)})});
      queryClient.invalidateQueries({queryKey:getListFeesQueryKey()});
      toast({title:"Fee updated"}); setEditFee(null);
    } catch(e:unknown){toast({variant:"destructive",title:"Update failed",description:e instanceof Error?e.message:""});}
    finally{setEditSaving(false);}
  };

  const handleDelete = async (fee:FeeRecord) => {
    setDeletingId(fee.id);
    try {
      await apiFetch(`/api/fees/${fee.id}`,{method:"DELETE"});
      queryClient.invalidateQueries({queryKey:getListFeesQueryKey()});
      toast({title:"Fee deleted"}); setDeleteTarget(null);
    } catch(e:unknown){toast({variant:"destructive",title:"Delete failed",description:e instanceof Error?e.message:""});}
    finally{setDeletingId(null);}
  };

  const handlePay = () => {
    if (!payOpen||!payAmount||!currFee) return;
    const paid=Number(payAmount), disc=Math.max(0,Number(payDiscount??0));
    payMut.mutate({id:payOpen,data:{paidAmount:paid,discount:disc} as never},{
      onSuccess:()=>{
        queryClient.invalidateQueries({queryKey:getListFeesQueryKey()});
        queryClient.invalidateQueries({queryKey:["/api/dashboard/stats"]});
        const fineN=Number(ext(currFee).fine??0), discN=Math.max(0,Number(payDiscount??0));
        const effTotal=currFee.amount+fineN-discN;
        const remaining=Math.max(0,effTotal-((currFee.paidAmount??0)+paid));
        setReceipt({ receiptNo:`RCP-${Date.now().toString().slice(-6)}`, studentName:currFee.studentName??"—",
          admissionNumber:(ext(currFee).admissionNumber as string)??"—", className:currFee.className??"—",
          month:currFee.month, amountPaid:paid, remaining, newStatus:remaining<=0?"paid":"partial",
          paidDate:new Date().toLocaleDateString("en-PK",{dateStyle:"long"}) });
        setPayOpen(null); setPayAmount(""); setPayDiscount("0");
      },
      onError:()=>toast({variant:"destructive",title:"Payment failed"}),
    });
  };

  const printReceipt = () => {
    if (!receipt) return;
    const w=window.open("","_blank","width=500,height=700");
    if (!w){toast({variant:"destructive",title:"Popup blocked"});return;}
    w.document.write(buildReceiptHtml(receipt,`${window.location.origin}/kips-logo.jpeg`));
    w.document.close();
  };

  // ── Sorted classes for add dialog ─────────────────────────────────────────
  const sortedClasses = classes ? [...classes].sort((a,b)=>{ const na=parseInt(a.name)||0, nb=parseInt(b.name)||0; return na&&nb?na-nb:a.name.localeCompare(b.name); }) : [];
  const classStudents = selClassId ? (students??[]).filter(s=>Number(s.classId)===Number(selClassId)).sort((a,b)=>(a.admissionNumber??"").localeCompare(b.admissionNumber??"",undefined,{numeric:true})) : [];
  const q2 = stuSearch.trim().toLowerCase();
  const filteredStu  = q2 ? classStudents.filter(s=>(s.admissionNumber??"").toLowerCase().includes(q2)||(s.name??"").toLowerCase().includes(q2)) : classStudents;

  return (
    <div className="space-y-4 pb-8">
      {printPortal}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{allFees.length} total records</p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={()=>setViewMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode==="card"?"bg-blue-600 text-white":"bg-white text-gray-600 hover:bg-gray-50"}`}>
              <Grid3X3 className="w-3.5 h-3.5"/> Cards
            </button>
            <button onClick={()=>setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l ${viewMode==="list"?"bg-blue-600 text-white":"bg-white text-gray-600 hover:bg-gray-50"}`}>
              <LayoutList className="w-3.5 h-3.5"/> List
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={()=>window.print()}>
            <Printer className="w-4 h-4 mr-1"/> Print
          </Button>
          {!isStudent && (
            <Dialog open={addOpen} onOpenChange={o=>{setAddOpen(o);if(!o){addForm.reset({fine:"0",discount:"0"});setSelClassId("");setStuSearch("");}}}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700">
                  <Plus className="w-4 h-4 mr-2"/> Add Fee
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Fee Record</DialogTitle></DialogHeader>
                <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    {/* Class select */}
                    <div>
                      <label className="text-sm font-medium block mb-1">Class <span className="text-xs text-gray-400">(select first)</span></label>
                      <Select value={selClassId} onValueChange={cid=>{
                        setSelClassId(cid); addForm.setValue("studentId","");
                        const fs=structs.find(s=>s.classId===Number(cid));
                        if(fs){addForm.setValue("amount",String(fs.monthlyFee));addForm.setValue("fine",String(fs.lateFine??0));}
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select class first"/></SelectTrigger>
                        <SelectContent className="max-h-64 overflow-y-auto">
                          {sortedClasses.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Student search */}
                    <FormField control={addForm.control} name="studentId" render={({field})=>{
                      const sel = classStudents.find(s=>String(s.id)===field.value);
                      return (
                        <FormItem>
                          <FormLabel>Student *</FormLabel>
                          <Input placeholder={selClassId?"Search name or adm#...":"Select class first"} value={stuSearch} onChange={e=>setStuSearch(e.target.value)} disabled={!selClassId} className="mb-2"/>
                          {selClassId && (
                            <div className="border rounded-md max-h-48 overflow-y-auto bg-white">
                              {!filteredStu.length
                                ? <div className="px-3 py-4 text-sm text-gray-400 text-center">{q2?"No match":"No students in class"}</div>
                                : filteredStu.map(s=>{
                                    const isSel=String(s.id)===field.value;
                                    return <button key={s.id} type="button" onClick={()=>{handleStudentChange(String(s.id),field.onChange);setStuSearch("");}}
                                      className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${isSel?"bg-emerald-50 text-emerald-800 font-semibold":"hover:bg-gray-50"}`}>
                                      <span className="font-mono text-xs text-purple-600 mr-2">{s.admissionNumber}</span>{s.name}
                                      {isSel&&<span className="ml-2 text-emerald-600">✓</span>}
                                    </button>;
                                  })
                              }
                            </div>
                          )}
                          {sel && <p className="text-xs text-emerald-700 mt-1">✓ <strong>{sel.admissionNumber}</strong> — {sel.name}</p>}
                          <FormMessage/>
                        </FormItem>
                      );
                    }}/>
                    <FormField control={addForm.control} name="amount"  render={({field})=>(<FormItem><FormLabel>Amount (PKR)*</FormLabel><FormControl><Input type="number" placeholder="2500" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                    <FormField control={addForm.control} name="month"   render={({field})=>(<FormItem><FormLabel>Month*</FormLabel><FormControl><Input type="month" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                    <FormField control={addForm.control} name="dueDate" render={({field})=>(<FormItem><FormLabel>Due Date*</FormLabel><FormControl><Input type="date" {...field}/></FormControl><FormMessage/></FormItem>)}/>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={addForm.control} name="fine"     render={({field})=>(<FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field}/></FormControl></FormItem>)}/>
                      <FormField control={addForm.control} name="discount" render={({field})=>(<FormItem><FormLabel>Discount (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field}/></FormControl></FormItem>)}/>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={()=>setAddOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMut.isPending}>{createMut.isPending&&<Loader2 className="w-4 h-4 animate-spin mr-2"/>}Create</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {!isLoading && allFees.length>0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          {[
            {label:"Total Records", value:String(allFees.length),           sub:`${allFees.filter(f=>f.status==="paid").length} paid`,grad:"from-blue-500 to-indigo-600",    Icon:CreditCard},
            {label:"Total Amount",  value:`PKR ${totalAmt.toLocaleString()}`, sub:null,                                               grad:"from-violet-500 to-purple-600",  Icon:DollarSign},
            {label:"Total Paid",    value:`PKR ${totalPaid.toLocaleString()}`,sub:null,                                               grad:"from-emerald-500 to-green-600",  Icon:TrendingUp},
            {label:"Outstanding",   value:`PKR ${totalRem.toLocaleString()}`, sub:`${allFees.filter(f=>f.status==="unpaid").length} unpaid`,grad:"from-rose-500 to-red-600",Icon:TrendingDown},
          ].map(c=>(
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${c.grad} p-4`}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-white/80 text-xs font-semibold uppercase tracking-wide leading-tight">{c.label}</p>
                    <c.Icon className="w-4 h-4 text-white/40"/>
                  </div>
                  <p className="text-white font-bold text-base leading-tight">{c.value}</p>
                  {c.sub && <p className="text-white/70 text-xs mt-0.5">{c.sub}</p>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <Select value={classFilter??"all"} onValueChange={v=>setClassFilter(v==="all"?undefined:v)}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue placeholder="All Classes"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {sortedClasses.map(c=><SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"/>
          <Input className="pl-9 h-9" placeholder="Search name or admission #..." value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{v:undefined,l:"All"},{v:"paid",l:"Paid"},{v:"unpaid",l:"Unpaid"},{v:"partial",l:"Partial"}].map(f=>(
            <button key={f.l} onClick={()=>setStatusFilter(f.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${(!f.v&&!statusFilter)||statusFilter===f.v?"bg-gray-800 text-white border-gray-800":"bg-white text-gray-500 border-gray-200 hover:border-gray-400"}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i=><Skeleton key={i} className="h-52 rounded-2xl"/>)}
        </div>
      ) : !displayFees.length ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300"/>
          <p className="font-medium text-gray-500">No fee records found</p>
          <p className="text-sm mt-1">Change filter or add a new record</p>
        </div>

      /* ── CARD VIEW ── */
      ) : viewMode==="card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayFees.map(fee=>{
            const s  = st(fee.status);
            const SI = s.icon;
            const fineN = Number(ext(fee).fine??0);
            const discN = Number(ext(fee).discount??0);
            const admNo = (ext(fee).admissionNumber as string)??"—";
            const effTot = Math.max(0,fee.amount+fineN-discN);
            const rem    = fee.remainingAmount??0;
            return (
              <div key={fee.id} className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${s.light}`}>
                <div className={`h-2 bg-gradient-to-r ${s.grad}`}/>
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate">{fee.studentName||"—"}</p>
                      <p className="text-[11px] font-mono text-purple-600 font-bold mt-0.5">{admNo}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {fee.className && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{fee.className}</span>}
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.badge}`}>
                          <SI className="w-3 h-3"/>{s.label}
                        </span>
                      </div>
                      {isStudent && ext(fee).notes && (
                        <p className="text-[10px] text-gray-500 font-normal mt-1.5 leading-relaxed bg-white/40 p-1.5 rounded border border-white/30">
                          {ext(fee).notes as string}
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400">{fee.month}</p>
                      <p className={`text-xl font-black mt-0.5 ${fee.status==="paid"?"text-emerald-600":fee.status==="partial"?"text-amber-600":"text-red-600"}`}>
                        PKR {effTot.toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="bg-white/70 rounded-xl p-3 space-y-1 text-xs border border-white/60">
                    <div className="flex justify-between text-gray-600"><span>Amount</span><span className="font-semibold text-gray-800">PKR {fee.amount.toLocaleString()}</span></div>
                    {fineN>0 && <div className="flex justify-between text-orange-600"><span>Fine</span><span>+PKR {fineN.toLocaleString()}</span></div>}
                    {discN>0 && <div className="flex justify-between text-blue-600"><span>Discount</span><span>-PKR {discN.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-emerald-600 border-t pt-1"><span>Paid</span><span className="font-bold">PKR {(fee.paidAmount??0).toLocaleString()}</span></div>
                    {rem>0 && <div className="flex justify-between text-red-600 font-bold"><span>Remaining</span><span>PKR {rem.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-gray-400"><span>Due</span><span>{fee.dueDate}</span></div>
                  </div>
                  <div className="flex gap-2 pt-1 border-t border-gray-200/60 flex-wrap">
                    {!isStudent && fee.status!=="paid" && (
                      <button onClick={()=>{setPayOpen(fee.id);setPayAmount(String(fee.remainingAmount??0));}}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                        💳 Pay Now
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        <button onClick={()=>openEditFee(fee)}
                          className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors">
                          <Pencil className="w-3.5 h-3.5"/>
                        </button>
                        <button onClick={()=>setDeleteTarget(fee)}
                          className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5"/>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      /* ── LIST VIEW ── */
      ) : (
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                {["Student","Adm #","Class","Month","Amount","Fine","Paid","Remaining","Due Date","Status","Actions"].map(h=>(
                  <th key={h} className="text-left px-4 py-3 font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayFees.map((fee,i)=>{
                const s=st(fee.status); const SI=s.icon;
                const fineN=Number(ext(fee).fine??0);
                const discN=Number(ext(fee).discount??0);
                const admNo=(ext(fee).admissionNumber as string)??"—";
                const effTot=Math.max(0,fee.amount+fineN-discN);
                const rem=fee.remainingAmount??0;
                return (
                  <tr key={fee.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${i%2===0?"bg-white":"bg-gray-50/30"}`}>
                    <td className="px-4 py-3 font-semibold text-gray-900">{fee.studentName||"—"}</td>
                    <td className="px-4 py-3 font-mono text-xs text-purple-600 font-bold">{admNo}</td>
                    <td className="px-4 py-3 text-gray-600">{fee.className||"—"}</td>
                    <td className="px-4 py-3 text-gray-600">
                      <div>{fee.month}</div>
                      {isStudent && ext(fee).notes && (
                        <div className="text-[10px] text-gray-400 font-normal mt-0.5">{ext(fee).notes as string}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-semibold">PKR {fee.amount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-orange-600">{fineN>0?`+PKR ${fineN.toLocaleString()}`:"—"}</td>
                    <td className="px-4 py-3 text-emerald-600 font-semibold">PKR {(fee.paidAmount??0).toLocaleString()}</td>
                    <td className="px-4 py-3 text-red-600 font-semibold">{rem>0?`PKR ${rem.toLocaleString()}`:"—"}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{fee.dueDate}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${s.badge}`}>
                        <SI className="w-3 h-3"/>{s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {!isStudent && fee.status!=="paid" && (
                          <button onClick={()=>{setPayOpen(fee.id);setPayAmount(String(fee.remainingAmount??0));}}
                            className="px-2 py-1 rounded bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">Pay</button>
                        )}
                        {isAdmin && <>
                          <button onClick={()=>openEditFee(fee)} className="p-1 rounded bg-blue-50 hover:bg-blue-100 text-blue-600"><Pencil className="w-3 h-3"/></button>
                          <button onClick={()=>setDeleteTarget(fee)} className="p-1 rounded bg-red-50 hover:bg-red-100 text-red-600"><Trash2 className="w-3 h-3"/></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pay Dialog ── */}
      <Dialog open={payOpen!==null} onOpenChange={o=>{if(!o){setPayOpen(null);setPayAmount("");setPayDiscount("0");}}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Collect Payment</DialogTitle></DialogHeader>
          {currFee && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <p className="font-bold">{currFee.studentName}</p>
                <p className="text-gray-500 text-xs">{currFee.month} · {currFee.className}</p>
                <p className="text-red-600 font-semibold mt-1">Remaining: PKR {(currFee.remainingAmount??0).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Amount Paid (PKR)</label>
                <Input type="number" value={payAmount} onChange={e=>setPayAmount(e.target.value)} placeholder="Enter amount"/>
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Discount (PKR)</label>
                <Input type="number" value={payDiscount} onChange={e=>setPayDiscount(e.target.value)} placeholder="0"/>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={()=>{setPayOpen(null);setPayAmount("");setPayDiscount("0");}}>Cancel</Button>
                <Button onClick={handlePay} disabled={payMut.isPending||!payAmount} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {payMut.isPending&&<Loader2 className="w-4 h-4 animate-spin mr-2"/>}Collect
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editFee} onOpenChange={o=>{if(!o)setEditFee(null);}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Edit Fee Record</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="amount"  render={({field})=>(<FormItem><FormLabel>Amount (PKR)*</FormLabel><FormControl><Input type="number" {...field}/></FormControl><FormMessage/></FormItem>)}/>
              <FormField control={editForm.control} name="month"   render={({field})=>(<FormItem><FormLabel>Month*</FormLabel><FormControl><Input type="month" {...field}/></FormControl><FormMessage/></FormItem>)}/>
              <FormField control={editForm.control} name="dueDate" render={({field})=>(<FormItem><FormLabel>Due Date*</FormLabel><FormControl><Input type="date" {...field}/></FormControl><FormMessage/></FormItem>)}/>
              <FormField control={editForm.control} name="fine"    render={({field})=>(<FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field}/></FormControl></FormItem>)}/>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={()=>setEditFee(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>{editSaving&&<Loader2 className="w-4 h-4 animate-spin mr-2"/>}Save</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={o=>{if(!o)setDeleteTarget(null);}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle className="text-red-600">Delete Fee Record?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">This will permanently remove the fee record for <strong>{deleteTarget?.studentName}</strong> ({deleteTarget?.month}).</p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={()=>setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={deletingId===deleteTarget?.id} onClick={()=>deleteTarget&&handleDelete(deleteTarget)}>
              {deletingId===deleteTarget?.id&&<Loader2 className="w-4 h-4 animate-spin mr-2"/>}Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ── */}
      <Dialog open={!!receipt} onOpenChange={o=>{if(!o)setReceipt(null);}}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Payment Successful</DialogTitle></DialogHeader>
          {receipt && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2"/>
                <p className="font-bold text-gray-900">{receipt.studentName}</p>
                <p className="text-emerald-700 text-xl font-black">PKR {receipt.amountPaid.toLocaleString()}</p>
                <p className="text-xs text-gray-500 mt-1">{receipt.month} · {receipt.className}</p>
                {receipt.remaining>0 && <p className="text-red-500 text-xs font-semibold mt-1">Remaining: PKR {receipt.remaining.toLocaleString()}</p>}
              </div>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={printReceipt}><Printer className="w-4 h-4 mr-2"/>Print Receipt</Button>
                <Button variant="outline" onClick={()=>setReceipt(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
