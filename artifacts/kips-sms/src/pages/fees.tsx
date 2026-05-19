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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

function buildReceiptHtml(receipt: Receipt, logoSrc: string): string {
  const copyHtml = (copyLabel: string) => `
    <div class="receipt">
      <div class="copy-label">${copyLabel}</div>
      <div class="header">
        <img src="${logoSrc}" alt="KIPS" />
        <div>
          <div class="school-name">KIPS School Hassari</div>
          <div class="subtitle">Fee Receipt</div>
        </div>
      </div>
      <div class="row-meta"><span class="label">Receipt No.</span><span class="mono">${receipt.receiptNo}</span></div>
      <div class="row-meta"><span class="label">Date</span><span>${receipt.paidDate}</span></div>
      <div class="divider"></div>
      <div class="row"><span class="label">Student</span><span class="val">${receipt.studentName}</span></div>
      <div class="row"><span class="label">Adm. No.</span><span class="adm">${receipt.admissionNumber}</span></div>
      <div class="row"><span class="label">Class</span><span class="val">${receipt.className}</span></div>
      <div class="row"><span class="label">Month</span><span class="val">${receipt.month}</span></div>
      <div class="divider"></div>
      <div class="row amount-row">
        <span class="label green">Amount Paid</span>
        <span class="green bold">PKR ${receipt.amountPaid.toLocaleString()}</span>
      </div>
      ${receipt.remaining > 0
        ? `<div class="row"><span class="label red">Remaining Balance</span><span class="red bold">PKR ${receipt.remaining.toLocaleString()}</span></div>`
        : `<div class="row"><span class="label green">Status</span><span class="green bold">✓ FULLY PAID</span></div>`}
      <div class="divider"></div>
      <div class="approved-row"><span class="approved-text">✦ Approved by Admin ✦</span></div>
      <div class="footer">
        <span>Cashier: ________________</span>
        <span class="muted">Thank you for your payment</span>
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Fee Receipt</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#f3f4f6;padding:20px;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .page{max-width:420px;margin:0 auto}
  .receipt{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:16px;position:relative}
  .copy-label{position:absolute;top:12px;right:14px;background:#1a2a5e;color:#fff;font-size:9px;font-weight:700;
    letter-spacing:1px;text-transform:uppercase;padding:3px 8px;border-radius:20px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header{display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:2px solid #1a2a5e;margin-bottom:12px}
  .header img{width:52px;height:52px;border-radius:50%;border:2px solid #e07b1a;object-fit:cover}
  .school-name{font-size:16px;font-weight:700;color:#1a2a5e}
  .subtitle{font-size:11px;color:#9ca3af;margin-top:2px}
  .row-meta{display:flex;justify-content:space-between;font-size:11px;color:#6b7280;margin-bottom:5px}
  .mono{font-family:monospace;font-weight:700;color:#1f2937;font-size:12px}
  .divider{border-top:1px solid #e5e7eb;margin:10px 0}
  .row{display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px}
  .label{color:#6b7280}.val{color:#111827;font-weight:500}.adm{font-family:monospace;color:#7c3aed;font-weight:600}
  .green{color:#059669!important}.red{color:#dc2626!important}.bold{font-weight:700}
  .amount-row{font-size:14px}
  .approved-row{text-align:center;margin:6px 0 4px}
  .approved-text{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1px;color:#1a2a5e;
    background:#eef2ff;border:1px solid #c7d2fe;border-radius:20px;padding:3px 14px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer{display:flex;justify-content:space-between;font-size:10px;color:#9ca3af;margin-top:4px}
  .muted{color:#d1d5db}
  .cut-line{text-align:center;font-size:10px;color:#d1d5db;border-top:1px dashed #d1d5db;
    padding-top:6px;margin-bottom:6px;letter-spacing:2px}
  @media print{body{background:#fff;padding:0}
    .receipt{border-radius:0;border:none;border-bottom:1px solid #e5e7eb;margin-bottom:8px}}
</style></head>
<body><div class="page">
  ${copyHtml("School Copy")}
  <div class="cut-line">✂ &nbsp; CUT HERE &nbsp; ✂</div>
  ${copyHtml("Student Copy")}
</div>
<script>window.onload=function(){window.print()}<\/script>
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
      <div className="flex items-center justify-between">
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
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [receipt, setReceipt]           = useState<Receipt | null>(null);

  // Fee structure auto-fill
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === "admin";
  const isStudent   = user?.role === "student";

  const { data: fees, isLoading } = useListFees(
    statusFilter ? { status: statusFilter as "paid" | "unpaid" | "partial" } : {}
  );
  const { data: students } = useListStudents({});
  const { data: classes }  = useListClasses({});
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
    defaultValues: { fine: "0" },
  });

  const onAddSubmit = (values: z.infer<typeof addFeeSchema>) => {
    createMutation.mutate({
      data: {
        studentId: Number(values.studentId),
        amount:    Number(values.amount),
        month:     values.month,
        dueDate:   values.dueDate,
        fine:      Number(values.fine ?? 0),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        toast({ title: "Fee record created" });
        setAddOpen(false);
        addForm.reset({ fine: "0" });
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
    payMutation.mutate({ id: payOpen, data: { paidAmount: paid } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListFeesQueryKey() });
        const totalPaid = (currentFee.paidAmount ?? 0) + paid;
        const remaining = currentFee.amount - totalPaid;
        setReceipt({
          receiptNo:       `RCP-${Date.now().toString().slice(-6)}`,
          studentName:     currentFee.studentName     ?? "—",
          admissionNumber: (currentFee as unknown as Record<string, unknown>).admissionNumber as string ?? "—",
          className:       currentFee.className       ?? "—",
          month:           currentFee.month,
          amountPaid:      paid,
          remaining:       Math.max(0, remaining),
          newStatus:       remaining <= 0 ? "paid" : "partial",
          paidDate:        new Date().toLocaleDateString("en-PK", { dateStyle: "long" }),
        });
        setPayOpen(null);
        setPayAmount("");
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  const handlePrintReceipt = () => {
    if (!receipt) return;
    const logoSrc = `${window.location.origin}/kips-logo.jpeg`;
    const w = window.open("", "_blank", "width=500,height=700");
    if (!w) return;
    w.document.write(buildReceiptHtml(receipt, logoSrc));
    w.document.close();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fee Management</h1>
          <p className="text-gray-500 text-sm mt-1">Fee records manage karo aur class-wise fee structure set karo</p>
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

      {/* Tabs */}
      <Tabs defaultValue="records" className="no-print">
        <TabsList className="mb-4">
          <TabsTrigger value="records" className="flex items-center gap-2">
            <LayoutList className="w-4 h-4" /> Fee Records
          </TabsTrigger>
          <TabsTrigger value="structure" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" /> Fee Structure
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Fee Records ─────────────────────────────────────────────── */}
        <TabsContent value="records" className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            {/* Status filters */}
            <div className="flex gap-2 flex-wrap">
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
              <Dialog open={addOpen} onOpenChange={o => { setAddOpen(o); if (!o) { addForm.reset({ fine: "0" }); setSelectedClassId(""); } }}>
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
                      <FormField control={addForm.control} name="studentId" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Student *</FormLabel>
                          <Select onValueChange={val => handleStudentChange(val, field.onChange)}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                            <SelectContent>
                              {students?.map(s => (
                                <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.admissionNumber})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />

                      {/* Class info display (read-only, auto from student) */}
                      {selectedClassId && (
                        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 text-xs text-blue-700">
                          Class: <strong>{classes?.find(c => c.id === Number(selectedClassId))?.name ?? selectedClassId}</strong>
                          {feeStructures.find(s => s.classId === Number(selectedClassId)) && (
                            <span className="ml-2">— Auto-filled from fee structure ✓</span>
                          )}
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
                      <FormField control={addForm.control} name="fine" render={({ field }) => (
                        <FormItem><FormLabel>Fine (PKR)</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl></FormItem>
                      )} />
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
                        {["Student","Adm#","Class","Month","Amount","Paid","Remaining","Fine","Due Date","Status","Actions"].map(h => (
                          <th key={h} className={`text-left py-3 px-3 font-semibold text-gray-600 ${h === "Actions" ? "print:hidden" : ""}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!fees?.length ? (
                        <tr>
                          <td colSpan={11} className="py-12 text-center text-gray-400">Koi fee record nahi mila</td>
                        </tr>
                      ) : fees.map(fee => {
                        const st = statusConfig[fee.status as keyof typeof statusConfig] || statusConfig.unpaid;
                        return (
                          <tr key={fee.id} className="border-b hover:bg-gray-50">
                            <td className="py-2.5 px-3 font-medium text-gray-900">{fee.studentName || "—"}</td>
                            <td className="py-2.5 px-3 text-xs font-mono text-purple-600">{(fee as unknown as Record<string, unknown>).admissionNumber as string || "—"}</td>
                            <td className="py-2.5 px-3 text-gray-600">{fee.className || "—"}</td>
                            <td className="py-2.5 px-3 text-gray-600">{fee.month}</td>
                            <td className="py-2.5 px-3 font-medium">PKR {fee.amount.toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-emerald-600">PKR {(fee.paidAmount ?? 0).toLocaleString()}</td>
                            <td className="py-2.5 px-3 font-semibold text-red-600">PKR {(fee.remainingAmount ?? 0).toLocaleString()}</td>
                            <td className="py-2.5 px-3 text-orange-600">
                              {((fee as unknown as Record<string, unknown>).fine as number ?? 0) > 0
                                ? `PKR ${((fee as unknown as Record<string, unknown>).fine as number).toLocaleString()}`
                                : "—"}
                            </td>
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
        </TabsContent>

        {/* ── TAB 2: Fee Structure ───────────────────────────────────────────── */}
        <TabsContent value="structure">
          <FeeStructureTab isAdmin={isAdmin} />
        </TabsContent>
      </Tabs>

      {/* ── Pay Dialog ─────────────────────────────────────────────────────────── */}
      <Dialog open={!!payOpen} onOpenChange={() => { setPayOpen(null); setPayAmount(""); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Payment Record Karo</DialogTitle></DialogHeader>
          {currentFee && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-gray-500">Student:</span><span className="font-medium">{currentFee.studentName}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Month:</span><span>{currentFee.month}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total:</span><span className="font-bold">PKR {currentFee.amount.toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Paid:</span><span className="text-emerald-600">PKR {(currentFee.paidAmount ?? 0).toLocaleString()}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Remaining:</span><span className="text-red-600 font-bold">PKR {(currentFee.remainingAmount ?? 0).toLocaleString()}</span></div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Amount Received (PKR)</label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="mt-1"
                  placeholder="Enter amount"
                  max={currentFee.remainingAmount ?? currentFee.amount}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setPayOpen(null); setPayAmount(""); }}>Cancel</Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handlePay}
                  disabled={!payAmount || payMutation.isPending}
                >
                  {payMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                  Payment Confirm Karo
                </Button>
              </div>
            </div>
          )}
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
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReceipt(null)}>Close</Button>
                <Button onClick={handlePrintReceipt} className="bg-blue-600 hover:bg-blue-700 text-white">
                  <Printer className="w-4 h-4 mr-2" /> Receipt Print Karo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
