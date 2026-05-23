import { useState, useEffect } from "react";
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
  CreditCard, TrendingUp, TrendingDown, DollarSign,
  Eye, Search,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
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

// ── Types & configs ───────────────────────────────────────────────────────────
type FeeStructure = {
  id: number; classId: number; className: string | null;
  monthlyFee: number; admissionFee: number; lateFine: number; notes: string | null;
};
interface Receipt {
  receiptNo: string; studentName: string; admissionNumber: string;
  className: string; month: string; amountPaid: number; remaining: number;
  newStatus: string; paidDate: string;
}

const statusConfig = {
  paid:    { icon: CheckCircle, label: "Paid",    grad: "from-emerald-500 to-teal-600",  light: "bg-emerald-50 border-emerald-200",  badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  unpaid:  { icon: AlertCircle, label: "Unpaid",  grad: "from-red-500 to-rose-600",      light: "bg-red-50 border-red-200",          badge: "bg-red-100 text-red-700 border-red-200"             },
  partial: { icon: Clock,       label: "Partial", grad: "from-amber-400 to-orange-500",  light: "bg-amber-50 border-amber-200",      badge: "bg-amber-100 text-amber-700 border-amber-200"       },
};

// ── Schemas ───────────────────────────────────────────────────────────────────
const addFeeSchema = z.object({
  studentId: z.string().min(1, "Student required"),
  classId:   z.string().optional(),
  amount:    z.string().min(1, "Amount required"),
  month:     z.string().min(1, "Month required"),
  dueDate:   z.string().min(1, "Due date required"),
  fine:      z.string().optional(),
  discount:  z.string().optional(),
});
const editFeeSchema = z.object({
  amount:  z.string().min(1, "Amount required"),
  month:   z.string().min(1, "Month required"),
  dueDate: z.string().min(1, "Due date required"),
  fine:    z.string().optional(),
});

// ── Receipt HTML ──────────────────────────────────────────────────────────────
function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
function buildReceiptHtml(receipt: Receipt, logoSrc: string): string {
  const paidFull = receipt.remaining <= 0; const e = escapeHtml;
  const copyHtml = (lbl: string) => `<div class="receipt">
    <div class="copy-tag">${e(lbl)}</div>
    <div class="header"><img src="${e(logoSrc)}" alt="KIPS" class="logo" /><div class="header-text">
      <div class="school-name">KIPS School Hassari</div><div class="tagline">Bright Future — Quality Education</div>
    </div></div>
    <div class="title-bar">FEE PAYMENT RECEIPT</div>
    <div class="meta"><span><b>Receipt #:</b> ${e(receipt.receiptNo)}</span><span><b>Date:</b> ${e(receipt.paidDate)}</span></div>
    <table class="info">
      <tr><td class="lbl">Student Name</td><td class="val"><b>${e(receipt.studentName)}</b></td></tr>
      <tr><td class="lbl">Admission No.</td><td class="val">${e(receipt.admissionNumber)}</td></tr>
      <tr><td class="lbl">Class</td><td class="val">${e(receipt.className)}</td></tr>
      <tr><td class="lbl">Month</td><td class="val"><b>${e(receipt.month)}</b></td></tr>
    </table>
    <div class="amount-box ${paidFull ? "paid" : "partial"}">
      <div class="amt-label">AMOUNT PAID</div><div class="amt-value">PKR ${receipt.amountPaid.toLocaleString()}</div>
      ${paidFull ? `<div class="status">✓ FULLY PAID</div>` : `<div class="status">Remaining: PKR ${receipt.remaining.toLocaleString()}</div>`}
    </div>
    <div class="signatures">
      <div class="sig"><div class="sig-line"></div><div class="sig-label">Cashier</div></div>
      <div class="sig"><div class="sig-line"></div><div class="sig-label">Authorized Signature</div></div>
    </div>
    <div class="footer">Thank you for your payment • Keep this receipt for your records</div>
  </div>`;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fee Receipt</title>
<style>@page{size:A4 portrait;margin:12mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',Arial,sans-serif;color:#111;background:#fff;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}.page{max-width:180mm;margin:0 auto}.receipt{border:1.5px solid #1a2a5e;border-radius:6px;padding:14px 18px;margin-bottom:10px;position:relative;page-break-inside:avoid}.copy-tag{position:absolute;top:-1px;right:14px;background:#1a2a5e;color:#fff;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:3px 14px;border-radius:0 0 4px 4px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.header{display:flex;align-items:center;gap:12px;padding:6px 0 10px;border-bottom:1px solid #ddd}.logo{width:54px;height:54px;border-radius:50%;object-fit:cover;border:1.5px solid #1a2a5e}.school-name{font-size:18px;font-weight:800;color:#1a2a5e}.tagline{font-size:10px;color:#666;margin-top:1px}.title-bar{text-align:center;background:#1a2a5e;color:#fff;font-size:11px;font-weight:700;letter-spacing:3px;padding:5px;margin:10px 0;border-radius:3px;-webkit-print-color-adjust:exact;print-color-adjust:exact}.meta{display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px;color:#333}.info{width:100%;font-size:12px;border-collapse:collapse;margin-bottom:10px}.info td{padding:5px 8px;border-bottom:1px dotted #ccc}.info .lbl{color:#666;width:35%}.amount-box{text-align:center;padding:12px;margin-bottom:10px;border-radius:4px;color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}.amount-box.paid{background:#059669}.amount-box.partial{background:#0891b2}.amt-label{font-size:10px;letter-spacing:2px;opacity:.9}.amt-value{font-size:24px;font-weight:800;margin:3px 0}.status{font-size:11px;font-weight:600;margin-top:4px}.signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:14px 0 8px}.sig{text-align:center}.sig-line{border-top:1px solid #333;margin-bottom:3px;height:1px}.sig-label{font-size:10px;color:#666}.footer{text-align:center;font-size:9px;color:#888;padding-top:6px;border-top:1px dashed #ddd;font-style:italic}.cut-line{text-align:center;font-size:9px;color:#999;letter-spacing:3px;padding:4px 0;margin:2px 0;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc}.no-print{position:fixed;top:10px;right:10px;background:#1a2a5e;color:#fff;padding:8px 14px;border-radius:4px;font-size:12px;cursor:pointer;border:none;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,.2)}@media print{.no-print{display:none}}</style></head>
<body><button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="page">${copyHtml("SCHOOL COPY")}<div class="cut-line">✂ CUT HERE ✂</div>${copyHtml("PARENT COPY")}</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Fees() {
  const [viewMode,      setViewMode]      = useState<"card" | "list">("card");
  const [addOpen,       setAddOpen]       = useState(false);
  const [payOpen,       setPayOpen]       = useState<number | null>(null);
  const [editFee,       setEditFee]       = useState<FeeRecord | null>(null);
  const [deleteTarget,  setDeleteTarget]  = useState<FeeRecord | null>(null);
  const [deletingId,    setDeletingId]    = useState<number | null>(null);
  const [editSaving,    setEditSaving]    = useState(false);
  const [payAmount,     setPayAmount]     = useState("");
  const [payDiscount,   setPayDiscount]   = useState("0");
  const [statusFilter,  setStatusFilter]  = useState<string | undefined>();
  const [classFilter,   setClassFilter]   = useState<string | undefined>();
  const [searchQ,       setSearchQ]       = useState("");
  const [receipt,       setReceipt]       = useState<Receipt | null>(null);
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedClassId,  setSelectedClassId]  = useState<string>("");
  const [studentSearch,    setStudentSearch]    = useState<string>("");

  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === "admin";
  const isStudent   = user?.role === "student";

  const { data: fees,     isLoading } = useListFees({});
  const { data: students }            = useListStudents({});
  const { data: classes  }            = useListClasses();
  const createMutation  = useCreateFee();
  const payMutation     = usePayFee();
  const currentFee      = fees?.find(f => f.id === payOpen);

  useEffect(() => {
    apiFetch("/api/fee-structures")
      .then(data => setFeeStructures(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // ── Filtered display ───────────────────────────────────────────────────────
  const selectedClassName = classFilter ? classes?.find(c => String(c.id) === classFilter)?.name : undefined;
  const displayFees = (fees ?? [])
    .filter(f => !selectedClassName || f.className === selectedClassName)
    .filter(f => !statusFilter || (statusFilter === "unpaid" ? f.status !== "paid" : f.status === statusFilter))
    .filter(f => {
      if (!searchQ.trim()) return true;
      const q = searchQ.toLowerCase();
      return (f.studentName ?? "").toLowerCase().includes(q) ||
             ((f as unknown as Record<string,unknown>).admissionNumber as string ?? "").toLowerCase().includes(q);
    });

  // ── Summary totals ─────────────────────────────────────────────────────────
  const allFees        = fees ?? [];
  const totalAmount    = allFees.reduce((s, f) => s + f.amount, 0);
  const totalPaid      = allFees.reduce((s, f) => s + (f.paidAmount ?? 0), 0);
  const totalOutstand  = allFees.reduce((s, f) => s + (f.remainingAmount ?? 0), 0);

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleStudentChange = (studentId: string, onChange: (v: string) => void) => {
    onChange(studentId);
    const student = students?.find(s => s.id === Number(studentId));
    if (student?.classId) {
      setSelectedClassId(String(student.classId));
      const fs = feeStructures.find(s => s.classId === student.classId);
      if (fs) { addForm.setValue("amount", String(fs.monthlyFee)); addForm.setValue("fine", String(fs.lateFine ?? 0)); }
    }
  };

  const addForm = useForm<z.infer<typeof addFeeSchema>>({
    resolver: zodResolver(addFeeSchema),
    defaultValues: { fine: "0", discount: "0" },
  });
  const onAddSubmit = (v: z.infer<typeof addFeeSchema>) => {
    createMutation.mutate({ data: { studentId: Number(v.studentId), amount: Number(v.amount), month: v.month, dueDate: v.dueDate, fine: Number(v.fine ?? 0), discount: Number(v.discount ?? 0) } as never }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() }); toast({ title: "Fee record created" }); setAddOpen(false); addForm.reset({ fine: "0", discount: "0" }); setSelectedClassId(""); },
      onError:   () => toast({ variant: "destructive", title: "Failed to create fee record" }),
    });
  };

  const editForm = useForm<z.infer<typeof editFeeSchema>>({ resolver: zodResolver(editFeeSchema) });
  const openEdit = (fee: FeeRecord) => {
    setEditFee(fee);
    editForm.reset({ amount: String(fee.amount), month: fee.month, dueDate: fee.dueDate, fine: String((fee as unknown as Record<string,unknown>).fine ?? 0) });
  };
  const onEditSubmit = async (v: z.infer<typeof editFeeSchema>) => {
    if (!editFee) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/fees/${editFee.id}`, { method: "PUT", body: JSON.stringify({ amount: Number(v.amount), month: v.month, dueDate: v.dueDate, fine: Number(v.fine ?? 0) }) });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      toast({ title: "Fee record updated" }); setEditFee(null);
    } catch (e: unknown) { toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "" }); }
    finally { setEditSaving(false); }
  };

  const handleDelete = async (fee: FeeRecord) => {
    setDeletingId(fee.id);
    try {
      await apiFetch(`/api/fees/${fee.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      toast({ title: "Fee record deleted" }); setDeleteTarget(null);
    } catch (e: unknown) { toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : "" }); }
    finally { setDeletingId(null); }
  };

  const handlePay = () => {
    if (!payOpen || !payAmount || !currentFee) return;
    const paid = Number(payAmount), disc = Math.max(0, Number(payDiscount ?? 0));
    payMutation.mutate({ id: payOpen, data: { paidAmount: paid, discount: disc } as never }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        const fineN = Number((currentFee as unknown as Record<string,unknown>).fine ?? 0);
        const discN = Math.max(0, Number(payDiscount ?? 0));
        const effTotal = currentFee.amount + fineN - discN;
        const totalPaidNow = (currentFee.paidAmount ?? 0) + paid;
        const remaining = Math.max(0, effTotal - totalPaidNow);
        setReceipt({
          receiptNo: `RCP-${Date.now().toString().slice(-6)}`,
          studentName: currentFee.studentName ?? "—",
          admissionNumber: (currentFee as unknown as Record<string,unknown>).admissionNumber as string ?? "—",
          className: currentFee.className ?? "—",
          month: currentFee.month,
          amountPaid: paid, remaining,
          newStatus: remaining <= 0 ? "paid" : "partial",
          paidDate: new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
        });
        setPayOpen(null); setPayAmount(""); setPayDiscount("0");
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) { toast({ variant: "destructive", title: "Popup blocked" }); return; }
    w.document.write(buildReceiptHtml(receipt, `${window.location.origin}/kips-logo.jpeg`));
    w.document.close();
  };

  const feeExtra = (fee: FeeRecord) => fee as unknown as Record<string, unknown>;

  // ── Status card helper ─────────────────────────────────────────────────────
  const getStatus = (s: string) => statusConfig[s as keyof typeof statusConfig] ?? statusConfig.unpaid;

  return (
    <div className="space-y-4 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 text-sm mt-0.5">{allFees.length} records total</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode==="card" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <Grid3X3 className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l ${viewMode==="list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          {!isStudent && (
            <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { addForm.reset({ fine: "0", discount: "0" }); setSelectedClassId(""); setStudentSearch(""); } }}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700">
                  <Plus className="w-4 h-4 mr-2" /> Add Fee Record
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New Fee Record</DialogTitle>
                  {feeStructures.length > 0 && <p className="text-xs text-emerald-600 mt-1">✓ Amount auto-fills when student is selected</p>}
                </DialogHeader>
                <Form {...addForm}>
                  <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium block mb-1">Class <span className="text-xs text-gray-400">(select first)</span></label>
                      <Select value={selectedClassId} onValueChange={cid => {
                        setSelectedClassId(cid); addForm.setValue("studentId", "");
                        const fs = feeStructures.find(s => s.classId === Number(cid));
                        if (fs) { addForm.setValue("amount", String(fs.monthlyFee)); addForm.setValue("fine", String(fs.lateFine ?? 0)); }
                      }}>
                        <SelectTrigger><SelectValue placeholder="Select class first" /></SelectTrigger>
                        <SelectContent className="max-h-72 overflow-y-auto">
                          {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <FormField control={addForm.control} name="studentId" render={({ field }) => {
                      const allInClass = selectedClassId ? (students ?? []).filter(s => Number(s.classId) === Number(selectedClassId)).sort((a,b) => (a.admissionNumber ?? "").localeCompare(b.admissionNumber ?? "", undefined, { numeric: true })) : [];
                      const q = studentSearch.trim().toLowerCase();
                      const filtered = q ? allInClass.filter(s => (s.admissionNumber ?? "").toLowerCase().includes(q) || (s.name ?? "").toLowerCase().includes(q)) : allInClass;
                      const selected = allInClass.find(s => String(s.id) === field.value);
                      return (
                        <FormItem>
                          <FormLabel>Student *</FormLabel>
                          <Input placeholder={selectedClassId ? "Search name or adm#..." : "Select class first"} value={studentSearch} onChange={e => setStudentSearch(e.target.value)} disabled={!selectedClassId} className="mb-2" />
                          {selectedClassId && (
                            <div className="border rounded-md max-h-52 overflow-y-auto bg-white">
                              {!filtered.length ? <div className="px-3 py-4 text-sm text-gray-500 text-center">{q ? "No match" : "No students"}</div>
                                : filtered.map(s => {
                                  const isSel = String(s.id) === field.value;
                                  return <button key={s.id} type="button" onClick={() => { handleStudentChange(String(s.id), field.onChange); setStudentSearch(""); }}
                                    className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${isSel ? "bg-emerald-50 text-emerald-800 font-medium" : "hover:bg-gray-50"}`}>
                                    <span className="font-mono text-xs text-purple-600 mr-2">{s.admissionNumber}</span>{s.name}{isSel && <span className="ml-2 text-emerald-600">✓</span>}
                                  </button>;
                                })}
                            </div>
                          )}
                          {selected && <p className="text-xs text-emerald-700 mt-1">✓ <strong>{selected.admissionNumber}</strong> — {selected.name}</p>}
                          <FormMessage />
                        </FormItem>
                      );
                    }} />
                    <FormField control={addForm.control} name="amount" render={({ field }) => (
                      <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" placeholder="2500" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={addForm.control} name="month" render={({ field }) => (
                      <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={addForm.control} name="dueDate" render={({ field }) => (
                      <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-3">
                      <FormField control={addForm.control} name="fine" render={({ field }) => (
                        <FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={addForm.control} name="discount" render={({ field }) => (
                        <FormItem><FormLabel>Discount (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* ── Summary Cards ── */}
      {!isLoading && allFees.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Records",  value: allFees.length,                      sub: `${allFees.filter(f=>f.status==="paid").length} paid`,    grad: "from-blue-500 to-indigo-600",   icon: CreditCard   },
            { label: "Total Amount",   value: `PKR ${totalAmount.toLocaleString()}`, sub: null,                                                    grad: "from-violet-500 to-purple-600", icon: DollarSign   },
            { label: "Total Paid",     value: `PKR ${totalPaid.toLocaleString()}`,   sub: null,                                                    grad: "from-emerald-500 to-green-600", icon: TrendingUp   },
            { label: "Outstanding",    value: `PKR ${totalOutstand.toLocaleString()}`,sub: `${allFees.filter(f=>f.status==="unpaid").length} unpaid`,grad: "from-rose-500 to-red-600",     icon: TrendingDown },
          ].map(c => (
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${c.grad} p-4`}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-white/80 text-xs font-semibold uppercase tracking-wide leading-tight">{c.label}</p>
                    <c.icon className="w-4 h-4 text-white/50" />
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
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={classFilter ?? "all"} onValueChange={v => setClassFilter(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-full sm:w-40 h-9"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Classes</SelectItem>
            {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
          <Input className="pl-9 h-9" placeholder="Search name or admission #..." value={searchQ} onChange={e => setSearchQ(e.target.value)} />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[{v:undefined,l:"All"},{v:"paid",l:"Paid"},{v:"unpaid",l:"Unpaid"},{v:"partial",l:"Partial"}].map(f => (
            <button key={f.l} onClick={() => setStatusFilter(f.v)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
                (f.v===undefined && !statusFilter) || statusFilter===f.v
                  ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* ── Loading ── */}
      {isLoading ? (
        viewMode === "card"
          ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
          : <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !displayFees.length ? (
        <div className="text-center py-16 text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No fee records found</p>
        </div>

      /* ── CARD VIEW ── */
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayFees.map(fee => {
            const st  = getStatus(fee.status);
            const StatusIcon = st.icon;
            const fine     = Number(feeExtra(fee).fine     ?? 0);
            const discount = Number(feeExtra(fee).discount ?? 0);
            const admNo    = feeExtra(fee).admissionNumber as string ?? "—";
            const effTotal = Math.max(0, fee.amount + fine - discount);
            const remaining = fee.remainingAmount ?? 0;
            return (
              <div key={fee.id} className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${st.light}`}>
                <div className={`h-2 bg-gradient-to-r ${st.grad}`} />
                <div className="p-4 flex-1 flex flex-col gap-3">
                  {/* Student info */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 truncate text-base">{fee.studentName || "—"}</p>
                      <p className="text-[11px] font-mono text-purple-600 font-semibold mt-0.5">{admNo}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {fee.className && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{fee.className}</span>}
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border ${st.badge}`}>
                          <StatusIcon className="w-3 h-3" />{st.label}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-gray-400 font-medium">{fee.month}</p>
                      <p className={`text-xl font-black mt-0.5 ${fee.status === "paid" ? "text-emerald-600" : fee.status === "partial" ? "text-amber-600" : "text-red-600"}`}>
                        PKR {effTotal.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Fee breakdown */}
                  <div className="bg-white/70 rounded-xl p-3 space-y-1.5 text-xs border border-white/50">
                    <div className="flex justify-between text-gray-600"><span>Fee Amount</span><span className="font-semibold text-gray-800">PKR {fee.amount.toLocaleString()}</span></div>
                    {fine > 0 && <div className="flex justify-between text-orange-600"><span>Fine</span><span>+PKR {fine.toLocaleString()}</span></div>}
                    {discount > 0 && <div className="flex justify-between text-blue-600"><span>Discount</span><span>-PKR {discount.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-emerald-600 border-t pt-1.5"><span>Paid</span><span className="font-bold">PKR {(fee.paidAmount ?? 0).toLocaleString()}</span></div>
                    {remaining > 0 && <div className="flex justify-between text-red-600 font-bold"><span>Remaining</span><span>PKR {remaining.toLocaleString()}</span></div>}
                    <div className="flex justify-between text-gray-400"><span>Due</span><span>{fee.dueDate}</span></div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-1 border-t border-gray-200/70 flex-wrap">
                    {!isStudent && fee.status !== "paid" && (
                      <button onClick={() => { setPayOpen(fee.id); setPayAmount(String(fee.remainingAmount ?? 0)); }}
                        className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
                        💳 Pay Now
                      </button>
                    )}
                    {fee.status === "paid" && (
                      <button onClick={() => {
                        const fineN = Number(feeExtra(fee).fine ?? 0), discN = Number(feeExtra(fee).discount ?? 0);
                        setReceipt({ receiptNo: `RCP-${fee.id}`, studentName: fee.studentName ?? "—", admissionNumber: feeExtra(fee).admissionNumber as string ?? "—", className: fee.className ?? "—", month: fee.month, amountPaid: fee.paidAmount ?? 0, remaining: 0, newStatus: "paid", paidDate: fee.paidDate ? new Date(fee.paidDate).toLocaleDateString("en-PK", { dateStyle: "long" }) : new Date().toLocaleDateString("en-PK", { dateStyle: "long" }) });
                      }} className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition-colors border border-emerald-200">
                        <Printer className="w-3.5 h-3.5" /> Receipt
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => openEdit(fee)} className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors border border-blue-200">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => setDeleteTarget(fee)} className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors border border-red-200">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      /* ── LIST VIEW ── */
      ) : (
        <div className="rounded-xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[820px]">
              <thead>
                <tr className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white">
                  {["#","Student","Adm #","Class","Month","Amount","Fine","Disc","Paid","Remaining","Due Date","Status",""].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayFees.map((fee, idx) => {
                  const st = getStatus(fee.status);
                  const StatusIcon = st.icon;
                  const fine = Number(feeExtra(fee).fine ?? 0);
                  const disc = Number(feeExtra(fee).discount ?? 0);
                  const admNo = feeExtra(fee).admissionNumber as string ?? "—";
                  return (
                    <tr key={fee.id} className={`border-b hover:bg-blue-50/30 transition-colors ${idx%2===0 ? "bg-white" : "bg-gray-50/60"}`}>
                      <td className="py-2.5 px-3 text-gray-400 text-xs">{idx+1}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-900 whitespace-nowrap">{fee.studentName || "—"}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-purple-600 font-bold whitespace-nowrap">{admNo}</td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap"><span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold">{fee.className || "—"}</span></td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{fee.month}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">PKR {fee.amount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-orange-600 whitespace-nowrap">{fine > 0 ? `+${fine.toLocaleString()}` : "—"}</td>
                      <td className="py-2.5 px-3 text-blue-600 whitespace-nowrap">{disc > 0 ? `-${disc.toLocaleString()}` : "—"}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-600 whitespace-nowrap">PKR {(fee.paidAmount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-bold text-red-600 whitespace-nowrap">PKR {(fee.remainingAmount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap text-xs">{fee.dueDate}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${st.badge}`}>
                          <StatusIcon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {!isStudent && fee.status !== "paid" && (
                            <button onClick={() => { setPayOpen(fee.id); setPayAmount(String(fee.remainingAmount ?? 0)); }}
                              className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700">Pay</button>
                          )}
                          {fee.status === "paid" && (
                            <button onClick={() => {
                              setReceipt({ receiptNo: `RCP-${fee.id}`, studentName: fee.studentName ?? "—", admissionNumber: feeExtra(fee).admissionNumber as string ?? "—", className: fee.className ?? "—", month: fee.month, amountPaid: fee.paidAmount ?? 0, remaining: 0, newStatus: "paid", paidDate: fee.paidDate ? new Date(fee.paidDate).toLocaleDateString("en-PK", { dateStyle: "long" }) : new Date().toLocaleDateString("en-PK", { dateStyle: "long" }) });
                            }} className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"><Printer className="w-3.5 h-3.5" /></button>
                          )}
                          {isAdmin && <button onClick={() => openEdit(fee)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50"><Pencil className="w-3.5 h-3.5" /></button>}
                          {isAdmin && <button onClick={() => setDeleteTarget(fee)} disabled={deletingId === fee.id} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50">{deletingId===fee.id ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Trash2 className="w-3.5 h-3.5"/>}</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={5} className="py-2.5 px-3 text-xs font-semibold text-blue-800">Total ({displayFees.length} records)</td>
                  <td className="py-2.5 px-3 font-bold text-gray-800 whitespace-nowrap">PKR {displayFees.reduce((s,f)=>s+f.amount,0).toLocaleString()}</td>
                  <td colSpan={2} />
                  <td className="py-2.5 px-3 font-bold text-emerald-700 whitespace-nowrap">PKR {displayFees.reduce((s,f)=>s+(f.paidAmount??0),0).toLocaleString()}</td>
                  <td className="py-2.5 px-3 font-bold text-red-700 whitespace-nowrap">PKR {displayFees.reduce((s,f)=>s+(f.remainingAmount??0),0).toLocaleString()}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── Pay Dialog ── */}
      <Dialog open={payOpen !== null} onOpenChange={o => { if (!o) { setPayOpen(null); setPayAmount(""); setPayDiscount("0"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Record Payment — {currentFee?.studentName}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {currentFee && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Fee Amount:</span><span className="font-semibold">PKR {currentFee.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Previously Paid:</span><span className="font-semibold text-emerald-600">PKR {(currentFee.paidAmount ?? 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Remaining:</span><span className="font-bold text-red-600">PKR {(currentFee.remainingAmount ?? 0).toLocaleString()}</span></div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium block mb-1.5">Payment Amount (PKR) *</label>
              <Input type="number" placeholder="Enter amount paid" value={payAmount} onChange={e => setPayAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1.5">Discount (PKR)</label>
              <Input type="number" placeholder="0" value={payDiscount} onChange={e => setPayDiscount(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setPayOpen(null); setPayAmount(""); setPayDiscount("0"); }}>Cancel</Button>
              <Button onClick={handlePay} disabled={!payAmount || payMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {payMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={!!editFee} onOpenChange={o => { if (!o) setEditFee(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Fee Record — {editFee?.studentName}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="amount"  render={({ field }) => (<FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="month"   render={({ field }) => (<FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="dueDate" render={({ field }) => (<FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>)} />
              <FormField control={editForm.control} name="fine"    render={({ field }) => (<FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>)} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditFee(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>{editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Update</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Fee Record?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600"><strong>{deleteTarget?.studentName}</strong> — {deleteTarget?.month} fee record will be permanently deleted.</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" disabled={!!deletingId} onClick={() => deleteTarget && handleDelete(deleteTarget)}>
              {deletingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Dialog ── */}
      <Dialog open={!!receipt} onOpenChange={o => { if (!o) setReceipt(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle className="w-5 h-5" /> Payment Recorded!
            </DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 pt-1">
              <div className={`p-4 rounded-xl text-center ${receipt.remaining <= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
                <p className={`text-2xl font-black ${receipt.remaining <= 0 ? "text-emerald-700" : "text-amber-700"}`}>PKR {receipt.amountPaid.toLocaleString()}</p>
                <p className="text-sm font-semibold mt-1 text-gray-700">{receipt.remaining <= 0 ? "✓ Fully Paid" : `Remaining: PKR ${receipt.remaining.toLocaleString()}`}</p>
              </div>
              <div className="text-sm space-y-1 text-gray-600">
                <p><strong>Student:</strong> {receipt.studentName}</p>
                <p><strong>Month:</strong> {receipt.month}</p>
                <p><strong>Class:</strong> {receipt.className}</p>
              </div>
              <Button onClick={handlePrintReceipt} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                <Printer className="w-4 h-4 mr-2" /> Print Receipt (School + Parent Copy)
              </Button>
              <Button variant="outline" onClick={() => setReceipt(null)} className="w-full">Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
