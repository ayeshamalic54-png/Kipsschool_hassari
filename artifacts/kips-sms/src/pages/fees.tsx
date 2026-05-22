// ============================================================
// FILE PATH: src/pages/fees.tsx
// COMPLETE REPLACEMENT FILE
// Changes:
//   - TWO TABS: "Fee Records" (existing) + "Fee Structure" (new)
//   - Fee Structure tab: admin har class ki monthly fee set kare
//   - Fee Structure: edit + delete admin ke liye
//   - Add Fee Record: class select karo → amount auto-fill ho jata hai
// ============================================================
import { useState, useEffect } from "react";
import {
  useListFees, useCreateFee, usePayFee,
  useListStudents, useListClasses,
  getListFeesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button }        from "@/components/ui/button";
import { Input }         from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, CheckCircle, Clock,
  AlertCircle, Printer, Pencil, Trash2,
  BookOpen, LayoutList,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import type { FeeRecord } from "@workspace/api-client-react";

const NAVY = "#1a2a5e";

// ── Auth helper ───────────────────────────────────────────────────────────────
function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader(),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "Request failed");
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

// ── Types ─────────────────────────────────────────────────────────────────────
type FeeStructure = {
  id:           number;
  classId:      number;
  className:    string | null;
  monthlyFee:   number;
  admissionFee: number;
  lateFine:     number;
  notes:        string | null;
};

// ── Status config ─────────────────────────────────────────────────────────────
const statusConfig = {
  paid:    { icon: CheckCircle, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  unpaid:  { icon: AlertCircle, className: "bg-red-100 text-red-700 border-red-200"             },
  partial: { icon: Clock,       className: "bg-amber-100 text-amber-700 border-amber-200"        },
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

const feeStructureSchema = z.object({
  classId:      z.string().min(1, "Class required"),
  monthlyFee:   z.string().min(1, "Monthly fee required"),
  admissionFee: z.string().optional(),
  lateFine:     z.string().optional(),
  notes:        z.string().optional(),
});

// ── Receipt ───────────────────────────────────────────────────────────────────
interface Receipt {
  receiptNo:       string;
  studentName:     string;
  admissionNumber: string;
  className:       string;
  month:           string;
  amountPaid:      number;
  remaining:       number;
  newStatus:       string;
  paidDate:        string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function buildReceiptHtml(receipt: Receipt, logoSrc: string): string {
  const paidFull = receipt.remaining <= 0;
  const e = escapeHtml;
  const copyHtml = (copyLabel: string) => `
    <div class="receipt">
      <div class="copy-tag">${e(copyLabel)}</div>

      <div class="header">
        <img src="${e(logoSrc)}" alt="KIPS" class="logo" />
        <div class="header-text">
          <div class="school-name">KIPS School Hassari</div>
          <div class="tagline">Bright Future — Quality Education</div>
        </div>
      </div>

      <div class="title-bar">FEE PAYMENT RECEIPT</div>

      <div class="meta">
        <span><b>Receipt #:</b> ${e(receipt.receiptNo)}</span>
        <span><b>Date:</b> ${e(receipt.paidDate)}</span>
      </div>

      <table class="info">
        <tr><td class="lbl">Student Name</td><td class="val"><b>${e(receipt.studentName)}</b></td></tr>
        <tr><td class="lbl">Admission No.</td><td class="val">${e(receipt.admissionNumber)}</td></tr>
        <tr><td class="lbl">Class</td><td class="val">${e(receipt.className)}</td></tr>
        <tr><td class="lbl">Month</td><td class="val"><b>${e(receipt.month)}</b></td></tr>
      </table>

      <div class="amount-box ${paidFull ? "paid" : "partial"}">
        <div class="amt-label">AMOUNT PAID</div>
        <div class="amt-value">PKR ${receipt.amountPaid.toLocaleString()}</div>
        ${paidFull
          ? `<div class="status">✓ FULLY PAID</div>`
          : `<div class="status">Remaining: PKR ${receipt.remaining.toLocaleString()}</div>`}
      </div>

      <div class="signatures">
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-label">Cashier</div>
        </div>
        <div class="sig">
          <div class="sig-line"></div>
          <div class="sig-label">Authorized Signature</div>
        </div>
      </div>

      <div class="footer">Thank you for your payment • Keep this receipt for your records</div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fee Receipt — ${receipt.studentName}</title>
<style>
  @page { size: A4 portrait; margin: 12mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;color:#111;background:#fff;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important;}
  .page{max-width:180mm;margin:0 auto;}
  .receipt{
    border:1.5px solid #1a2a5e;border-radius:6px;padding:14px 18px;margin-bottom:10px;
    position:relative;page-break-inside:avoid;
  }
  .copy-tag{
    position:absolute;top:-1px;right:14px;background:#1a2a5e;color:#fff;
    font-size:10px;font-weight:700;letter-spacing:1.5px;padding:3px 14px;
    border-radius:0 0 4px 4px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .header{display:flex;align-items:center;gap:12px;padding:6px 0 10px;border-bottom:1px solid #ddd}
  .logo{width:54px;height:54px;border-radius:50%;object-fit:cover;border:1.5px solid #1a2a5e}
  .school-name{font-size:18px;font-weight:800;color:#1a2a5e;letter-spacing:0.3px}
  .tagline{font-size:10px;color:#666;margin-top:1px}
  .title-bar{
    text-align:center;background:#1a2a5e;color:#fff;font-size:11px;font-weight:700;
    letter-spacing:3px;padding:5px;margin:10px 0;border-radius:3px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .meta{display:flex;justify-content:space-between;font-size:11px;margin-bottom:8px;color:#333}
  .info{width:100%;font-size:12px;border-collapse:collapse;margin-bottom:10px}
  .info td{padding:5px 8px;border-bottom:1px dotted #ccc}
  .info .lbl{color:#666;width:35%}
  .info .val{color:#111}
  .amount-box{
    text-align:center;padding:12px;margin-bottom:10px;border-radius:4px;color:#fff;
    -webkit-print-color-adjust:exact;print-color-adjust:exact;
  }
  .amount-box.paid{background:#059669}
  .amount-box.partial{background:#0891b2}
  .amt-label{font-size:10px;letter-spacing:2px;opacity:0.9}
  .amt-value{font-size:24px;font-weight:800;margin:3px 0}
  .status{font-size:11px;font-weight:600;margin-top:4px}
  .signatures{display:grid;grid-template-columns:1fr 1fr;gap:30px;margin:14px 0 8px}
  .sig{text-align:center}
  .sig-line{border-top:1px solid #333;margin-bottom:3px;height:1px}
  .sig-label{font-size:10px;color:#666;letter-spacing:0.5px}
  .footer{text-align:center;font-size:9px;color:#888;padding-top:6px;border-top:1px dashed #ddd;font-style:italic}
  .cut-line{text-align:center;font-size:9px;color:#999;letter-spacing:3px;padding:4px 0;margin:2px 0;border-top:1px dashed #ccc;border-bottom:1px dashed #ccc}
  @media print {
    body{padding:0}
    .no-print{display:none}
    .receipt{border-color:#000}
  }
  .no-print{position:fixed;top:10px;right:10px;background:#1a2a5e;color:#fff;padding:8px 14px;
    border-radius:4px;font-size:12px;cursor:pointer;border:none;font-weight:600;
    box-shadow:0 2px 6px rgba(0,0,0,0.2);}
</style></head>
<body>
<button class="no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
<div class="page">
  ${copyHtml("SCHOOL COPY")}
  <div class="cut-line">✂  CUT HERE  ✂</div>
  ${copyHtml("PARENT COPY")}
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`;
}

// ════════════════════════════════════════════════════════════════════════════
// ── Fee Structure Tab ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function FeeStructureTab({ isAdmin }: { isAdmin: boolean }) {
  const [structures, setStructures]         = useState<FeeStructure[]>([]);
  const [loading, setLoading]               = useState(true);
  const [editTarget, setEditTarget]         = useState<FeeStructure | null>(null);
  const [deleteTarget, setDeleteTarget]     = useState<FeeStructure | null>(null);
  const [addOpen, setAddOpen]               = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [deletingId, setDeletingId]         = useState<number | null>(null);
  const { toast }                           = useToast();
  const { data: classes }                   = useListClasses({});

  const loadStructures = async () => {
    setLoading(true);
    try {
      const data = await apiFetch("/api/fee-structures");
      setStructures(Array.isArray(data) ? data : []);
    } catch {
      toast({ variant: "destructive", title: "Failed to load fee structures" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStructures(); }, []);

  // ── Add form ──────────────────────────────────────────────────────────────
  const addForm = useForm<z.infer<typeof feeStructureSchema>>({
    resolver: zodResolver(feeStructureSchema),
    defaultValues: { admissionFee: "0", lateFine: "0" },
  });

  const onAddSubmit = async (values: z.infer<typeof feeStructureSchema>) => {
    setSaving(true);
    try {
      await apiFetch("/api/fee-structures", {
        method: "POST",
        body: JSON.stringify({
          classId:      Number(values.classId),
          monthlyFee:   Number(values.monthlyFee),
          admissionFee: Number(values.admissionFee ?? 0),
          lateFine:     Number(values.lateFine     ?? 0),
          notes:        values.notes ?? null,
        }),
      });
      toast({ title: "Fee structure saved" });
      addForm.reset({ admissionFee: "0", lateFine: "0" });
      setAddOpen(false);
      await loadStructures();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Save failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  // ── Edit form ─────────────────────────────────────────────────────────────
  const editForm = useForm<z.infer<typeof feeStructureSchema>>({
    resolver: zodResolver(feeStructureSchema),
  });

  const openEdit = (fs: FeeStructure) => {
    setEditTarget(fs);
    editForm.reset({
      classId:      String(fs.classId),
      monthlyFee:   String(fs.monthlyFee),
      admissionFee: String(fs.admissionFee),
      lateFine:     String(fs.lateFine),
      notes:        fs.notes ?? "",
    });
  };

  const onEditSubmit = async (values: z.infer<typeof feeStructureSchema>) => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await apiFetch(`/api/fee-structures/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          monthlyFee:   Number(values.monthlyFee),
          admissionFee: Number(values.admissionFee ?? 0),
          lateFine:     Number(values.lateFine     ?? 0),
          notes:        values.notes ?? null,
        }),
      });
      toast({ title: "Fee structure updated" });
      setEditTarget(null);
      await loadStructures();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (fs: FeeStructure) => {
    setDeletingId(fs.id);
    try {
      await apiFetch(`/api/fee-structures/${fs.id}`, { method: "DELETE" });
      toast({ title: "Fee structure deleted" });
      setDeleteTarget(null);
      await loadStructures();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setDeletingId(null);
    }
  };

  // Classes already configured — filter out ones that already have a structure (for add form)
  const configuredClassIds = new Set(structures.map(s => s.classId));
  const availableClasses   = classes?.filter(c => !configuredClassIds.has(c.id)) ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Fee Structure</h2>
          <p className="text-sm text-gray-500">Standard monthly fee per class — auto-fills when creating fee records</p>
        </div>
        {isAdmin && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white" disabled={availableClasses.length === 0}>
                <Plus className="w-4 h-4 mr-2" />
                {availableClasses.length === 0 ? "All Classes Set" : "Set Class Fee"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Set Class Fee Structure</DialogTitle></DialogHeader>
              <Form {...addForm}>
                <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                  <FormField control={addForm.control} name="classId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Class *</FormLabel>
                      <Select onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {availableClasses.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="monthlyFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Fee (PKR) *</FormLabel>
                      <FormControl><Input type="number" placeholder="2500" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={addForm.control} name="admissionFee" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Admission Fee (PKR)</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={addForm.control} name="lateFine" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Late Fine/day (PKR)</FormLabel>
                        <FormControl><Input type="number" placeholder="0" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={addForm.control} name="notes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes (optional)</FormLabel>
                      <FormControl><Input placeholder="Koi note..." {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : structures.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <BookOpen className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">No fee structure set</p>
              {isAdmin && <p className="text-sm mt-1">Use the "Set Class Fee" button above to get started</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["Class", "Monthly Fee", "Admission Fee", "Late Fine/day", "Notes", ...(isAdmin ? ["Actions"] : [])].map(h => (
                      <th key={h} className="text-left py-3 px-4 font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {structures.map(fs => (
                    <tr key={fs.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-semibold text-gray-900">{fs.className ?? `Class #${fs.classId}`}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">PKR {fs.monthlyFee.toLocaleString()}</td>
                      <td className="py-3 px-4 text-gray-600">
                        {fs.admissionFee > 0 ? `PKR ${fs.admissionFee.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-orange-600">
                        {fs.lateFine > 0 ? `PKR ${fs.lateFine.toLocaleString()}` : "—"}
                      </td>
                      <td className="py-3 px-4 text-gray-500 text-xs">{fs.notes || "—"}</td>
                      {isAdmin && (
                        <td className="py-3 px-4">
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline"
                              className="h-7 w-7 p-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                              title="Edit"
                              onClick={() => openEdit(fs)}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50"
                              title="Delete"
                              onClick={() => setDeleteTarget(fs)}
                              disabled={deletingId === fs.id}
                            >
                              {deletingId === fs.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fee Structure Edit Karo — {editTarget?.className}</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              {/* classId hidden — class change nahi hoti, sirf fees */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm text-blue-700 font-medium">
                Class: {editTarget?.className}
              </div>
              <FormField control={editForm.control} name="monthlyFee" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Fee (PKR) *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={editForm.control} name="admissionFee" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admission Fee (PKR)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="lateFine" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Late Fine/day (PKR)</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                  </FormItem>
                )} />
              </div>
              <FormField control={editForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Update
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fee Structure Delete?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Fee structure for <strong>{deleteTarget?.className}</strong> will be deleted.
            Existing fee records will not be affected.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive"
              disabled={!!deletingId}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deletingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── Main Fees Page ────────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export default function Fees() {
  const [addOpen, setAddOpen]           = useState(false);
  const [payOpen, setPayOpen]           = useState<number | null>(null);
  const [editFee, setEditFee]           = useState<FeeRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeeRecord | null>(null);
  const [deletingId, setDeletingId]     = useState<number | null>(null);
  const [editSaving, setEditSaving]     = useState(false);
  const [payAmount, setPayAmount]       = useState("");
  const [payDiscount, setPayDiscount]   = useState("0");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [classFilter, setClassFilter]   = useState<string | undefined>();
  const [receipt, setReceipt]           = useState<Receipt | null>(null);

  // Fee structure auto-fill
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [studentSearch, setStudentSearch]     = useState<string>("");

  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === "admin";
  const isStudent   = user?.role === "student";

  // Fetch ALL fees — apply filters client-side so the list stays in sync
  // after payments without waiting for a separately-cached filtered query.
  const { data: fees, isLoading } = useListFees({});
  const { data: students } = useListStudents({});
  const { data: classes }  = useListClasses({});

  const selectedClassName = classFilter ? classes?.find(c => String(c.id) === classFilter)?.name : undefined;
  const displayFees = (fees ?? [])
    .filter(f => !selectedClassName || f.className === selectedClassName)
    .filter(f => {
      if (!statusFilter) return true;
      if (statusFilter === "paid")   return f.status === "paid";
      if (statusFilter === "unpaid") return f.status === "unpaid" || f.status === "partial";
      if (statusFilter === "partial") return f.status === "partial";
      return true;
    });
  const createMutation     = useCreateFee();
  const payMutation        = usePayFee();
  const currentFee         = fees?.find(f => f.id === payOpen);

  // Load fee structures for auto-fill
  useEffect(() => {
    apiFetch("/api/fee-structures")
      .then(data => setFeeStructures(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // When student selected → auto-fill class fee
  const handleStudentChange = (studentId: string, onChange: (val: string) => void) => {
    onChange(studentId);
    const student    = students?.find(s => s.id === Number(studentId));
    const classId    = student?.classId;
    if (classId) {
      setSelectedClassId(String(classId));
      const structure = feeStructures.find(s => s.classId === classId);
      if (structure) {
        addForm.setValue("amount", String(structure.monthlyFee));
        addForm.setValue("fine",   String(structure.lateFine ?? 0));
      }
    }
  };

  // ── Add Fee form ──────────────────────────────────────────────────────────
  const addForm = useForm<z.infer<typeof addFeeSchema>>({
    resolver: zodResolver(addFeeSchema),
    defaultValues: { fine: "0", discount: "0" },
  });

  const onAddSubmit = (values: z.infer<typeof addFeeSchema>) => {
    createMutation.mutate({
      data: {
        studentId: Number(values.studentId),
        amount:    Number(values.amount),
        month:     values.month,
        dueDate:   values.dueDate,
        fine:      Number(values.fine ?? 0),
        discount:  Number(values.discount ?? 0),
      } as never
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        toast({ title: "Fee record created" });
        setAddOpen(false);
        addForm.reset({ fine: "0", discount: "0" });
        setSelectedClassId("");
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create fee record" }),
    });
  };

  // ── Edit Fee form ─────────────────────────────────────────────────────────
  const editForm = useForm<z.infer<typeof editFeeSchema>>({
    resolver: zodResolver(editFeeSchema),
  });

  const openEdit = (fee: FeeRecord) => {
    setEditFee(fee);
    editForm.reset({
      amount:  String(fee.amount),
      month:   fee.month,
      dueDate: fee.dueDate,
      fine:    String((fee as unknown as Record<string, unknown>).fine ?? 0),
    });
  };

  const onEditSubmit = async (values: z.infer<typeof editFeeSchema>) => {
    if (!editFee) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/fees/${editFee.id}`, {
        method: "PUT",
        body: JSON.stringify({
          amount:  Number(values.amount),
          month:   values.month,
          dueDate: values.dueDate,
          fine:    Number(values.fine ?? 0),
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      toast({ title: "Fee record updated" });
      setEditFee(null);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete Fee ────────────────────────────────────────────────────────────
  const handleDelete = async (fee: FeeRecord) => {
    setDeletingId(fee.id);
    try {
      await apiFetch(`/api/fees/${fee.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
      toast({ title: "Fee record deleted" });
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Pay Fee ───────────────────────────────────────────────────────────────
  const handlePay = () => {
    if (!payOpen || !payAmount || !currentFee) return;
    const paid = Number(payAmount);
    const disc = Math.max(0, Number(payDiscount ?? 0));
    payMutation.mutate({ id: payOpen, data: { paidAmount: paid, discount: disc } as never }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey(), refetchType: "all" });
        // Also refresh dashboard and accounts so the new payment shows up there
        queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"], refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts/income"], refetchType: "all" });
        queryClient.invalidateQueries({ queryKey: ["/api/accounts/summary"], refetchType: "all" });
        const fine = Number((currentFee as unknown as Record<string, unknown>).fine ?? 0);
        const effectiveTotal = currentFee.amount + fine - disc;
        const totalPaid = (currentFee.paidAmount ?? 0) + paid;
        const remaining = Math.max(0, effectiveTotal - totalPaid);
        setReceipt({
          receiptNo:       `RCP-${Date.now().toString().slice(-6)}`,
          studentName:     currentFee.studentName     ?? "—",
          admissionNumber: (currentFee as unknown as Record<string, unknown>).admissionNumber as string ?? "—",
          className:       currentFee.className       ?? "—",
          month:           currentFee.month,
          amountPaid:      paid,
          remaining,
          newStatus:       remaining <= 0 ? "paid" : "partial",
          paidDate:        new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
        });
        setPayOpen(null);
        setPayAmount("");
        setPayDiscount("0");
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  // Generate the receipt as a PDF and open it in a new tab so the user can
  // save or print it from the native PDF viewer.
  const handleDownloadReceiptPdf = async () => {
    if (!receipt) return;
    const logoSrc = `${window.location.origin}/kips-logo.jpeg`;

    // Render the receipt content directly into the current document. This
    // avoids the iframe/cross-document quirks that left the page blank.
    const html = buildReceiptHtml(receipt, logoSrc);
    const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
    const bodyMatch  = html.match(/<body>([\s\S]*?)<\/body>/);
    const styleText  = styleMatch ? styleMatch[1] : "";
    const bodyHtml   = bodyMatch  ? bodyMatch[1]  : html;

    const host = document.createElement("div");
    host.id = "kips-receipt-render";
    // Keep it visually off-screen but fully rendered (do NOT use display:none
    // or visibility:hidden — html2canvas needs a real layout).
    host.style.cssText = "position:fixed;left:0;top:0;width:210mm;background:#fff;z-index:-1;opacity:0;pointer-events:none;";
    host.innerHTML = `<style>${styleText}</style>${bodyHtml}`;
    // Remove the floating "Print / Save as PDF" button injected by buildReceiptHtml
    host.querySelectorAll(".no-print").forEach(n => n.remove());
    document.body.appendChild(host);

    try {
      // Wait for both logos to finish loading
      const imgs = Array.from(host.querySelectorAll("img")) as HTMLImageElement[];
      await Promise.all(imgs.map(img => new Promise<void>(resolve => {
        if (img.complete && img.naturalWidth > 0) return resolve();
        img.onload  = () => resolve();
        img.onerror = () => resolve();
        setTimeout(resolve, 2000);
      })));

      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const target = host.querySelector(".page") as HTMLElement | null;
      if (!target) throw new Error("Receipt page element not found");

      const canvas = await html2canvas(target, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        allowTaint: true,
        logging: false,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const margin = 8;
      const usableW = pdfW - margin * 2;
      const usableH = pdfH - margin * 2;
      const ratio = canvas.height / canvas.width;
      let imgW = usableW;
      let imgH = imgW * ratio;
      if (imgH > usableH) {
        imgH = usableH;
        imgW = imgH / ratio;
      }
      pdf.addImage(imgData, "JPEG", (pdfW - imgW) / 2, margin, imgW, imgH);

      const blobUrl = pdf.output("bloburl");
      const win = window.open(blobUrl as unknown as string, "_blank");
      if (!win) {
        const fileName = `receipt_${receipt.studentName.replace(/\s+/g, "_")}_${receipt.month.replace(/\s+/g, "_")}.pdf`;
        pdf.save(fileName);
      }
    } catch (err) {
      console.error("PDF generation failed", err);
      toast({ variant: "destructive", title: "PDF generation failed", description: "Please try again." });
    } finally {
      host.remove();
    }
  };

  // Open the receipt in a new tab so the user can also print it via the
  // browser's native print dialog (Save as PDF is also available there).
  const handlePrintReceipt = () => {
    if (!receipt) return;
    const logoSrc = `${window.location.origin}/kips-logo.jpeg`;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) {
      toast({ variant: "destructive", title: "Popup blocked", description: "Use Download PDF instead." });
      return;
    }
    w.document.write(buildReceiptHtml(receipt, logoSrc));
    w.document.close();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 text-sm mt-1">Manage fee records and payments</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1" /> Print
        </Button>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4">
        <div className="flex items-center gap-4 border-b pb-4">
          <img src="/kips-logo.jpeg" alt="KIPS" className="w-14 h-14 rounded-full object-cover" />
          <div>
            <h2 className="text-xl font-bold" style={{ color: NAVY }}>KIPS School Hassari</h2>
            <p className="text-sm text-gray-500">Fee Report — {new Date().toLocaleDateString("en-PK", { dateStyle: "long" })}</p>
          </div>
        </div>
      </div>

      {/* Fee Records (Fee Structure has its own dedicated page in the sidebar) */}
      <div className="no-print">
        <div className="space-y-4">

          {/* Summary Cards */}
          {!isLoading && fees && fees.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  label: "Total Records",
                  value: fees.length,
                  sub: null,
                  gradient: "from-blue-500 to-indigo-600",
                  icon: "📋",
                },
                {
                  label: "Total Amount",
                  value: `PKR ${fees.reduce((s, f) => s + f.amount, 0).toLocaleString()}`,
                  sub: null,
                  gradient: "from-violet-500 to-purple-600",
                  icon: "💰",
                },
                {
                  label: "Total Paid",
                  value: `PKR ${fees.reduce((s, f) => s + (f.paidAmount ?? 0), 0).toLocaleString()}`,
                  sub: `${fees.filter(f => f.status === "paid").length} fully paid`,
                  gradient: "from-emerald-500 to-green-600",
                  icon: "✓",
                },
                {
                  label: "Outstanding",
                  value: `PKR ${fees.reduce((s, f) => s + (f.remainingAmount ?? 0), 0).toLocaleString()}`,
                  sub: `${fees.filter(f => f.status === "unpaid").length} unpaid`,
                  gradient: "from-rose-500 to-red-600",
                  icon: "⚠",
                },
              ].map(c => (
                <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-br ${c.gradient} p-4`}>
                      <div className="flex items-start justify-between">
                        <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                        <span className="text-white/60 text-base">{c.icon}</span>
                      </div>
                      <p className="text-white font-bold mt-1 text-base leading-tight">{c.value}</p>
                      {c.sub && <p className="text-white/70 text-xs mt-0.5">{c.sub}</p>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Status + Class filters */}
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={classFilter ?? "all"} onValueChange={v => setClassFilter(v === "all" ? undefined : v)}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="All Classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {[
                { val: undefined, label: "All"     },
                { val: "paid",    label: "Paid"    },
                { val: "unpaid",  label: "Unpaid"  },
                { val: "partial", label: "Partial" },
              ].map(f => (
                <Button key={f.label} size="sm"
                  variant={statusFilter === f.val ? "default" : "outline"}
                  onClick={() => setStatusFilter(f.val)}
                >{f.label}</Button>
              ))}
            </div>
            {!isStudent && (
              <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { addForm.reset({ fine: "0", discount: "0" }); setSelectedClassId(""); setStudentSearch(""); } }}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-emerald-600 to-green-600 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Add Fee Record
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Fee Record</DialogTitle>
                    {feeStructures.length > 0 && (
                      <p className="text-xs text-emerald-600 mt-1">✓ Amount will auto-fill when a student is selected</p>
                    )}
                  </DialogHeader>
                  <Form {...addForm}>
                    <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4">
                      {/* Step 1: Class selector */}
                      <div className="space-y-2">
                        <label className="text-sm font-medium leading-none">
                          Class * <span className="text-xs text-gray-500 font-normal">(select first)</span>
                        </label>
                        <Select
                          value={selectedClassId}
                          onValueChange={cid => {
                            setSelectedClassId(cid);
                            addForm.setValue("studentId", "");
                            const structure = feeStructures.find(s => s.classId === Number(cid));
                            if (structure) {
                              addForm.setValue("amount", String(structure.monthlyFee));
                              addForm.setValue("fine",   String(structure.lateFine ?? 0));
                            }
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="Select class first" /></SelectTrigger>
                          <SelectContent className="max-h-72 overflow-y-auto">
                            {classes?.map(c => (
                              <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Step 2: Student selector — filtered by class, with search by admission# or name */}
                      <FormField control={addForm.control} name="studentId" render={({ field }) => {
                        const allInClass = selectedClassId
                          ? (students ?? [])
                              .filter(s => Number(s.classId) === Number(selectedClassId))
                              .slice()
                              .sort((a, b) =>
                                (a.admissionNumber ?? "").localeCompare(b.admissionNumber ?? "", undefined, { numeric: true })
                              )
                          : [];
                        const q = studentSearch.trim().toLowerCase();
                        const studentsInClass = q
                          ? allInClass.filter(s =>
                              (s.admissionNumber ?? "").toLowerCase().includes(q) ||
                              (s.name ?? "").toLowerCase().includes(q)
                            )
                          : allInClass;
                        const selectedStudent = allInClass.find(s => String(s.id) === field.value);
                        return (
                          <FormItem>
                            <FormLabel>
                              Student * <span className="text-xs text-gray-500 font-normal">
                                {selectedClassId
                                  ? (q ? `(${studentsInClass.length} of ${allInClass.length} matching)` : `(${allInClass.length} students)`)
                                  : "(select class first)"}
                              </span>
                            </FormLabel>
                            {/* Search input — type admission # or name */}
                            <Input
                              placeholder={selectedClassId ? "Search by admission # or name..." : "Choose a class above first"}
                              value={studentSearch}
                              onChange={e => setStudentSearch(e.target.value)}
                              disabled={!selectedClassId}
                              className="mb-2"
                            />
                            {/* Live results list */}
                            {selectedClassId && (
                              <div className="border rounded-md max-h-56 overflow-y-auto bg-white">
                                {studentsInClass.length === 0 ? (
                                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                    {q ? "No students match your search" : "No students in this class"}
                                  </div>
                                ) : (
                                  studentsInClass.map(s => {
                                    const isSelected = String(s.id) === field.value;
                                    return (
                                      <button
                                        key={s.id}
                                        type="button"
                                        onClick={() => { handleStudentChange(String(s.id), field.onChange); setStudentSearch(""); }}
                                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 transition-colors ${
                                          isSelected ? "bg-emerald-50 text-emerald-800 font-medium" : "hover:bg-gray-50"
                                        }`}
                                      >
                                        <span className="font-mono text-xs text-purple-600 mr-2">{s.admissionNumber}</span>
                                        {s.name}
                                        {isSelected && <span className="ml-2 text-emerald-600">✓</span>}
                                      </button>
                                    );
                                  })
                                )}
                              </div>
                            )}
                            {selectedStudent && (
                              <p className="text-xs text-emerald-700 mt-1">
                                ✓ Selected: <strong>{selectedStudent.admissionNumber}</strong> — {selectedStudent.name}
                              </p>
                            )}
                            <FormMessage />
                          </FormItem>
                        );
                      }} />

                      {/* Fee structure status banner */}
                      {selectedClassId && feeStructures.find(s => s.classId === Number(selectedClassId)) && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded px-3 py-2 text-xs text-emerald-700">
                          ✓ Amount auto-filled from <strong>{classes?.find(c => c.id === Number(selectedClassId))?.name}</strong> fee structure
                        </div>
                      )}
                      {selectedClassId && !feeStructures.find(s => s.classId === Number(selectedClassId)) && (
                        <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-800">
                          ⚠ No fee structure set for <strong>{classes?.find(c => c.id === Number(selectedClassId))?.name}</strong>. Add one in the <strong>Fee Structure</strong> page so the amount auto-fills next time. You can still type the amount below manually.
                        </div>
                      )}

                      <FormField control={addForm.control} name="amount" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (PKR) *</FormLabel>
                          <FormControl><Input type="number" placeholder="2500" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
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

          {/* Fee Records Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-6 space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm print:text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {["#","Student","Adm#","Class","Month","Amount","Fine","Discount","Paid","Remaining","Due Date","Status","Actions"].map(h => (
                          <th key={h} className={`text-left py-3 px-3 font-semibold text-gray-600 ${h === "Actions" ? "print:hidden" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!displayFees?.length ? (
                        <tr>
                          <td colSpan={13} className="py-12 text-center text-gray-400">No fee records found</td>
                        </tr>
                      ) : displayFees.map((fee, idx) => {
                        const st = statusConfig[fee.status as keyof typeof statusConfig] || statusConfig.unpaid;
                        return (
                          <tr key={fee.id} className="border-b hover:bg-gray-50">
                            <td className="py-2.5 px-3 text-gray-500 font-medium w-10">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-medium text-gray-900">{fee.studentName || "—"}</td>
                            <td className="py-2.5 px-3 text-xs font-mono text-purple-600">{(fee as unknown as Record<string, unknown>).admissionNumber as string || "—"}</td>
                            <td className="py-2.5 px-3 text-gray-600">{fee.className || "—"}</td>
                            <td className="py-2.5 px-3 text-gray-600">{fee.month}</td>
                            <td className="py-2.5 px-3 font-medium">PKR {fee.amount.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-orange-600">
                              {((fee as unknown as Record<string, unknown>).fine as number ?? 0) > 0
                                ? `PKR ${((fee as unknown as Record<string, unknown>).fine as number).toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-blue-600">
                              {((fee as unknown as Record<string, unknown>).discount as number ?? 0) > 0
                                ? `PKR ${((fee as unknown as Record<string, unknown>).discount as number).toLocaleString()}`
                                : "—"}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-600">PKR {(fee.paidAmount ?? 0).toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-semibold text-red-600">PKR {(fee.remainingAmount ?? 0).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-gray-500">{fee.dueDate}</td>
                            <td className="py-2.5 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.className}`}>{fee.status}</span>
                            </td>
                            <td className="py-2.5 px-3 print:hidden">
                              <div className="flex gap-1 items-center">
                                {!isStudent && fee.status !== "paid" && (
                                  <Button size="sm"
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2"
                                    onClick={() => { setPayOpen(fee.id); setPayAmount(String(fee.remainingAmount ?? 0)); }}
                                  >Pay</Button>
                                )}
                                {fee.status === "paid" && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-2"
                                    title="Reprint receipt"
                                    onClick={() => {
                                      const fineN = Number((fee as unknown as Record<string, unknown>).fine ?? 0);
                                      const discN = Number((fee as unknown as Record<string, unknown>).discount ?? 0);
                                      const effTotal = fee.amount + fineN - discN;
                                      const totalPaid = fee.paidAmount ?? 0;
                                      setReceipt({
                                        receiptNo:       `RCP-${fee.id}`,
                                        studentName:     fee.studentName ?? "—",
                                        admissionNumber: (fee as unknown as Record<string, unknown>).admissionNumber as string ?? "—",
                                        className:       fee.className ?? "—",
                                        month:           fee.month,
                                        amountPaid:      totalPaid,
                                        remaining:       Math.max(0, effTotal - totalPaid),
                                        newStatus:       "paid",
                                        paidDate:        fee.paidDate
                                          ? new Date(fee.paidDate).toLocaleDateString("en-PK", { dateStyle: "long" })
                                          : new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
                                      });
                                    }}
                                  >
                                    <Printer className="w-3.5 h-3.5 mr-1" /> Slip
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 w-7 p-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    title="Edit"
                                    onClick={() => openEdit(fee)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                    title="Delete"
                                    onClick={() => setDeleteTarget(fee)}
                                    disabled={deletingId === fee.id}
                                  >
                                    {deletingId === fee.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Pay Dialog ─────────────────────────────────────────────────────────── */}
      <Dialog open={!!payOpen} onOpenChange={() => { setPayOpen(null); setPayAmount(""); setPayDiscount("0"); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fee Payment</DialogTitle>
            <p className="text-xs text-gray-500 mt-0.5">
              {currentFee?.studentName} — {currentFee?.month}
            </p>
          </DialogHeader>
          {currentFee && (() => {
            const fine = Number((currentFee as unknown as Record<string, unknown>).fine ?? 0);
            const disc = Math.max(0, Number(payDiscount || 0));
            const effectiveTotal = Math.max(0, currentFee.amount + fine - disc);
            const alreadyPaid = currentFee.paidAmount ?? 0;
            const netRemaining = Math.max(0, effectiveTotal - alreadyPaid);
            return (
              <div className="space-y-4">
                {/* Fee Summary */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Fee Amount:</span>
                    <span className="font-medium">PKR {currentFee.amount.toLocaleString()}</span>
                  </div>
                  {fine > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Fine:</span>
                      <span className="text-orange-600">+PKR {fine.toLocaleString()}</span>
                    </div>
                  )}
                  {disc > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Discount:</span>
                      <span className="text-blue-600">-PKR {disc.toLocaleString()}</span>
                    </div>
                  )}
                  {alreadyPaid > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Previously Paid:</span>
                      <span className="text-emerald-600">PKR {alreadyPaid.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1.5 mt-1">
                    <span className="font-semibold text-gray-700">Now Remaining:</span>
                    <span className="text-red-600 font-bold">PKR {netRemaining.toLocaleString()}</span>
                  </div>
                </div>

                {/* Discount */}
                {isAdmin && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Discount (PKR) <span className="text-gray-400 font-normal">— optional</span></label>
                    <Input
                      type="number"
                      min="0"
                      value={payDiscount}
                      onChange={e => setPayDiscount(e.target.value)}
                      className="mt-1"
                      placeholder="0"
                    />
                  </div>
                )}

                {/* Amount to collect */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Amount Received (PKR) <span className="text-red-500">*</span></label>
                  <Input
                    type="number"
                    min="0"
                    max={netRemaining}
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="mt-1 text-lg font-semibold"
                    placeholder={String(netRemaining)}
                  />
                  {Number(payAmount) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      After payment: remaining = PKR {Math.max(0, netRemaining - Number(payAmount)).toLocaleString()}
                      {Number(payAmount) >= netRemaining ? " ✓ Fully Paid" : ""}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => { setPayOpen(null); setPayAmount(""); setPayDiscount("0"); }}>Cancel</Button>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={handlePay}
                    disabled={!payAmount || Number(payAmount) <= 0 || payMutation.isPending}
                  >
                    {payMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                    Confirm Payment
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Edit Fee Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={!!editFee} onOpenChange={o => { if (!o) setEditFee(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fee Record Edit Karo</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>Amount (PKR) *</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="month" render={({ field }) => (
                <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="dueDate" render={({ field }) => (
                <FormItem><FormLabel>Due Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={editForm.control} name="fine" render={({ field }) => (
                <FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditFee(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Update
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Fee Record Delete?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            <strong>{deleteTarget?.studentName}</strong> — {deleteTarget?.month} fee record will be permanently deleted.
          </p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive"
              disabled={!!deletingId}
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              {deletingId ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null} Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Receipt Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={!!receipt} onOpenChange={o => { if (!o) setReceipt(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment Successful ✓</DialogTitle></DialogHeader>
          {receipt && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Student:</span><span className="font-medium">{receipt.studentName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Month:</span><span>{receipt.month}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Paid:</span><span className="text-emerald-700 font-bold">PKR {receipt.amountPaid.toLocaleString()}</span></div>
                {receipt.remaining > 0
                  ? <div className="flex justify-between"><span className="text-gray-500">Remaining:</span><span className="text-red-600 font-semibold">PKR {receipt.remaining.toLocaleString()}</span></div>
                  : <div className="flex justify-between"><span className="text-gray-500">Status:</span><span className="text-emerald-600 font-bold">✓ Fully Paid</span></div>
                }
              </div>
              <div className="flex justify-end gap-2 flex-wrap">
                <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
                <Button onClick={handlePrintReceipt} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
                <Button onClick={handleDownloadReceiptPdf} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Printer className="w-4 h-4 mr-2" /> Download PDF
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
