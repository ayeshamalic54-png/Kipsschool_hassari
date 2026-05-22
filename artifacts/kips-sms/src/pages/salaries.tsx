// ============================================================
// FILE PATH: src/pages/salaries.tsx
// COMPLETE REPLACEMENT FILE
// Changes vs original:
//   - Admin ke liye Pencil (edit) button added
//   - Admin ke liye Trash2 (delete) button added
//   - Edit dialog: staff, amount, month change kar sakte ho
//   - Delete confirm dialog
//   - apiFetch helper (PUT/DELETE) added
//   - useAuthStore se role check
// ============================================================
import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useListSalaries, useCreateSalary, usePaySalary,
  useListStaff, getListSalariesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm }  from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z }        from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, Printer, FileText,
  X, RefreshCw, CheckCircle, Pencil, Trash2,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
    body > *:not(#kips-print-portal) { display: none !important; }
    #kips-print-portal {
      display: block !important;
      position: absolute !important;
      top: 0 !important; left: 0 !important;
      width: 100% !important;
      background: white !important;
      font-family: Arial, sans-serif !important;
      color: #111827 !important;
      font-size: 11pt !important;
      padding: 14mm 14mm !important;
      box-sizing: border-box !important;
    }
    #kips-print-portal * { font-family: Arial, sans-serif !important; }
    table { border-collapse: collapse !important; width: 100% !important; page-break-inside: auto; }
    tr    { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

// ── Schemas ───────────────────────────────────────────────────────────────────
const createSchema = z.object({
  staffId: z.string().min(1, "Staff required"),
  amount:  z.string().min(1, "Amount required"),
  month:   z.string().min(1, "Month required"),
});

const editSchema = z.object({
  staffId: z.string().min(1, "Staff required"),
  amount:  z.string().min(1, "Amount required"),
  month:   z.string().min(1, "Month required"),
});

const deductionSchema = z.object({
  absentDays:          z.string().default("0"),
  lateDays:            z.string().default("0"),
  tax:                 z.string().default("0"),
  otherDeduction:      z.string().default("0"),
  otherDeductionLabel: z.string().default(""),
  allowance:           z.string().default("0"),
  allowanceLabel:      z.string().default(""),
});

// ── Type ──────────────────────────────────────────────────────────────────────
type Salary = {
  id:         number;
  staffId?:   number;
  staffName?: string | null;
  month:      string;
  amount:     number;
  status:     string;
  paidDate?:  string | null;
};

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

// ════════════════════════════════════════════════════════════════════════════
// ── Salary Slip Modal ─────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function SalarySlip({ salary, onClose }: { salary: Salary; onClose: () => void }) {
  const slipRef = useRef<HTMLDivElement>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [attLoaded, setAttLoaded]   = useState(false);

  const form = useForm<z.infer<typeof deductionSchema>>({
    resolver: zodResolver(deductionSchema),
    defaultValues: {
      absentDays: "0", lateDays: "0", tax: "0",
      otherDeduction: "0", otherDeductionLabel: "",
      allowance: "0", allowanceLabel: "",
    },
  });

  useEffect(() => {
    if (!salary.staffId || !salary.month) return;
    const month = salary.month.slice(0, 7);
    setAttLoading(true);
    fetch(`/api/attendance/summary?month=${month}&type=staff&staffId=${salary.staffId}`, {
      headers: authHeader() as HeadersInit,
    })
      .then(r => r.json())
      .then(data => {
        if (data && typeof data.absent === "number") {
          form.setValue("absentDays", String(data.absent));
          form.setValue("lateDays",   String(data.late));
          setAttLoaded(true);
        }
      })
      .catch(() => {})
      .finally(() => setAttLoading(false));
  }, [salary.staffId, salary.month]);

  const values      = form.watch();
  const basicSalary = salary.amount;
  // Read live deduction criteria from settings (cached by React Query elsewhere
  // or via a one-off fetch on mount). Fallbacks match prior hardcoded defaults
  // so legacy installs without settings keep working.
  const [cfg, setCfg] = useState<{ workingDaysPerMonth: number; absentPenaltyFraction: string; latePenaltyFraction: string; leavePenaltyFraction: string }>({
    workingDaysPerMonth: 26, absentPenaltyFraction: "1.00", latePenaltyFraction: "0.50", leavePenaltyFraction: "0.00",
  });
  useEffect(() => {
    fetch("/api/settings", { headers: authHeader() as HeadersInit })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setCfg(d); })
      .catch(() => {});
  }, []);
  const workingDays = cfg.workingDaysPerMonth || 26;
  const absentFrac  = Number(cfg.absentPenaltyFraction);
  const lateFrac    = Number(cfg.latePenaltyFraction);
  const perDay      = Math.round(basicSalary / workingDays);
  const absentDed   = Math.round(Number(values.absentDays || 0) * perDay * absentFrac);
  const lateDed     = Math.round(Number(values.lateDays   || 0) * perDay * lateFrac);
  const taxDed      = Number(values.tax        || 0);
  const otherDed    = Number(values.otherDeduction || 0);
  const allowance   = Number(values.allowance  || 0);
  const totalDeductions = absentDed + lateDed + taxDed + otherDed;
  const netSalary   = basicSalary + allowance - totalDeductions;

  const monthLabel = salary.month
    ? new Date(salary.month.slice(0, 7) + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" })
    : salary.month;

  const handlePrint = () => {
    const content = slipRef.current?.innerHTML;
    const w = window.open("", "_blank");
    if (!w || !content) return;
    const slip = `
      ${content}
      <div class="footer">
        <div class="sig">Employee Signature</div>
        <div class="sig">Principal Signature</div>
      </div>`;
    w.document.write(`<html><head><title>Salary Slip — ${salary.staffName}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        body { font-family: Arial, sans-serif; color: #111; margin: 0; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
        td, th { padding: 6px 10px; border: 1px solid #ddd; }
        th { background: #f0f4ff; font-weight: 600; text-align: left; }
        .net-row td { font-weight: bold; font-size: 15px; background: #1a2a5e; color: white; }
        .footer { margin-top: 40px; display: flex; justify-content: space-between; }
        .sig { border-top: 1px solid #333; width: 150px; text-align: center; padding-top: 4px; font-size: 12px; }
        .copy-label { font-size: 11px; font-weight: bold; color: #555; text-transform: uppercase;
          letter-spacing: 1px; border: 1px dashed #aaa; display: inline-block;
          padding: 2px 10px; margin-bottom: 8px; border-radius: 3px; }
        .divider { border: none; border-top: 2px dashed #bbb; margin: 30px 0; }
      </style></head><body>
      <div class="copy-label">School Copy</div>
      ${slip}
      <hr class="divider" />
      <div class="copy-label">Employee Copy</div>
      ${slip}
      </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" /> Salary Slip — {salary.staffName}
          </h2>
          <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Deductions form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Deductions & Allowances</h3>
              {attLoading  && <span className="text-xs text-blue-500 flex items-center gap-1"><RefreshCw className="w-3 h-3 animate-spin" /> Loading...</span>}
              {attLoaded && !attLoading && <span className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Auto-loaded</span>}
            </div>
            <Form {...form}>
              <form className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="absentDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Absent Days</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                      {absentDed > 0 && <p className="text-xs text-red-500">-PKR {absentDed.toLocaleString()}</p>}
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="lateDays" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Late Days (½ day)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                      {lateDed > 0 && <p className="text-xs text-red-500">-PKR {lateDed.toLocaleString()}</p>}
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="tax" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Tax / Income Tax (PKR)</FormLabel>
                    <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="otherDeductionLabel" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Other Deduction</FormLabel>
                      <FormControl><Input placeholder="e.g. Loan" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="otherDeduction" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Amount (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <FormField control={form.control} name="allowanceLabel" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-emerald-600">+ Allowance Label</FormLabel>
                      <FormControl><Input placeholder="e.g. Transport" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="allowance" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-emerald-600">Amount (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" {...field} className="h-8 text-sm" /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </form>
            </Form>
            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-xs text-blue-700 space-y-1 border border-blue-100">
              <div className="flex justify-between"><span>Basic Salary:</span><span className="font-semibold">PKR {basicSalary.toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Per Day Rate:</span><span>PKR {perDay.toLocaleString()}</span></div>
              {allowance > 0 && <div className="flex justify-between text-emerald-600"><span>+ Allowance:</span><span>PKR {allowance.toLocaleString()}</span></div>}
              <div className="flex justify-between text-red-600"><span>Total Deductions:</span><span>-PKR {totalDeductions.toLocaleString()}</span></div>
              <div className="flex justify-between text-emerald-700 font-bold text-sm border-t pt-1 mt-1">
                <span>NET SALARY:</span><span>PKR {netSalary.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Right: Slip preview */}
          <div className="border rounded-xl p-4 bg-gray-50 overflow-auto" ref={slipRef}>
            <div style={{ textAlign: "center", borderBottom: "2px solid #1a2a5e", paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: "bold", color: "#1a2a5e" }}>KIPS School Hassari</div>
              <div style={{ fontSize: 11, color: "#666" }}>Bright Future — School Portal</div>
            </div>
            <div style={{ textAlign: "center", background: "#1a2a5e", color: "white", padding: "4px 8px", borderRadius: 4, marginBottom: 10, fontSize: 12, fontWeight: "bold" }}>
              SALARY SLIP — {monthLabel}
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, marginBottom: 8 }}>
              <tbody>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Employee</td><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>{salary.staffName}</td></tr>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Month</td><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>{monthLabel}</td></tr>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Working Days</td><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>26</td></tr>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Absent Days</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>{values.absentDays || 0}</td></tr>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", fontWeight: 600 }}>Late Days</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#f59e0b" }}>{values.lateDays || 0}</td></tr>
              </tbody>
            </table>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
              <thead>
                <tr style={{ background: "#f0f4ff" }}>
                  <th style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "left" }}>Description</th>
                  <th style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "right" }}>PKR</th>
                </tr>
              </thead>
              <tbody>
                <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd" }}>Basic Salary</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right" }}>{basicSalary.toLocaleString()}</td></tr>
                {allowance > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#16a34a" }}>+ {values.allowanceLabel || "Allowance"}</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#16a34a" }}>+{allowance.toLocaleString()}</td></tr>}
                {absentDed > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- Absent ({values.absentDays}d × {perDay.toLocaleString()})</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{absentDed.toLocaleString()}</td></tr>}
                {lateDed  > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- Late ({values.lateDays}d × {Math.round(perDay / 2).toLocaleString()})</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{lateDed.toLocaleString()}</td></tr>}
                {taxDed   > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- Tax</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{taxDed.toLocaleString()}</td></tr>}
                {otherDed > 0 && <tr><td style={{ padding: "3px 6px", border: "1px solid #ddd", color: "#dc2626" }}>- {values.otherDeductionLabel || "Other"}</td><td style={{ padding: "3px 6px", border: "1px solid #ddd", textAlign: "right", color: "#dc2626" }}>-{otherDed.toLocaleString()}</td></tr>}
                <tr style={{ background: "#fff7f7" }}><td style={{ padding: "4px 6px", border: "1px solid #ddd", fontWeight: "bold" }}>Total Deductions</td><td style={{ padding: "4px 6px", border: "1px solid #ddd", textAlign: "right", fontWeight: "bold", color: "#dc2626" }}>-{totalDeductions.toLocaleString()}</td></tr>
                <tr style={{ background: "#1a2a5e", color: "white" }}><td style={{ padding: 6, border: "1px solid #1a2a5e", fontWeight: "bold" }}>NET SALARY</td><td style={{ padding: 6, border: "1px solid #1a2a5e", textAlign: "right", fontWeight: "bold" }}>PKR {netSalary.toLocaleString()}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="p-4 border-t flex justify-end gap-2 bg-gray-50 rounded-b-2xl">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handlePrint} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
            <Printer className="w-4 h-4 mr-2" /> Print Salary Slip
          </Button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── Main Salaries Page ────────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
export default function Salaries() {
  const [open, setOpen]                     = useState(false);
  const [statusFilter, setStatusFilter]     = useState<string | undefined>();
  const [slipSalary, setSlipSalary]         = useState<Salary | null>(null);

  // ── Edit / Delete state ───────────────────────────────────────────────────
  const [editTarget, setEditTarget]         = useState<Salary | null>(null);
  const [editSaving, setEditSaving]         = useState(false);
  const [deleteTarget, setDeleteTarget]     = useState<Salary | null>(null);
  const [deletingId, setDeletingId]         = useState<number | null>(null);

  const { toast }   = useToast();
  const queryClient = useQueryClient();
  const { user }    = useAuthStore();
  const isAdmin     = user?.role === "admin";

  const { data: salaries, isLoading } = useListSalaries(
    statusFilter ? { status: statusFilter as "paid" | "unpaid" } : {}
  );
  const { data: staff }  = useListStaff();
  const createMutation   = useCreateSalary();
  const payMutation      = usePaySalary();

  useEffect(() => {
    const existing = document.getElementById("kips-print-styles");
    if (existing) existing.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  // ── Create form ───────────────────────────────────────────────────────────
  const createForm = useForm<z.infer<typeof createSchema>>({ resolver: zodResolver(createSchema) });

  const onCreateSubmit = (values: z.infer<typeof createSchema>) => {
    createMutation.mutate(
      { data: { staffId: Number(values.staffId), amount: Number(values.amount), month: values.month } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSalariesQueryKey() });
          toast({ title: "Salary record created" });
          setOpen(false);
          createForm.reset();
        },
        onError: () => toast({ variant: "destructive", title: "Failed to create salary record" }),
      }
    );
  };

  // ── Edit form ─────────────────────────────────────────────────────────────
  const editForm = useForm<z.infer<typeof editSchema>>({ resolver: zodResolver(editSchema) });

  const openEdit = (sal: Salary) => {
    setEditTarget(sal);
    editForm.reset({
      staffId: String(sal.staffId ?? ""),
      amount:  String(sal.amount),
      month:   sal.month.slice(0, 7),   // "2026-05"
    });
  };

  const onEditSubmit = async (values: z.infer<typeof editSchema>) => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await apiFetch(`/api/salaries/${editTarget.id}`, {
        method: "PUT",
        body: JSON.stringify({
          staffId: Number(values.staffId),
          amount:  Number(values.amount),
          month:   values.month,
        }),
      });
      queryClient.invalidateQueries({ queryKey: getListSalariesQueryKey() });
      toast({ title: "Salary record updated" });
      setEditTarget(null);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Update failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setEditSaving(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (sal: Salary) => {
    setDeletingId(sal.id);
    try {
      await apiFetch(`/api/salaries/${sal.id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: getListSalariesQueryKey() });
      toast({ title: "Salary record deleted" });
      setDeleteTarget(null);
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Delete failed", description: e instanceof Error ? e.message : "" });
    } finally {
      setDeletingId(null);
    }
  };

  // ── Pay ───────────────────────────────────────────────────────────────────
  const handlePay = (id: number) => {
    if (!confirm("Mark this salary as paid?")) return;
    payMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSalariesQueryKey() });
        toast({ title: "Salary marked as paid" });
      },
      onError: () => toast({ variant: "destructive", title: "Payment failed" }),
    });
  };

  // ── Summary numbers ───────────────────────────────────────────────────────
  const totalPaid    = salaries?.filter(s => s.status === "paid").reduce((a, s) => a + s.amount, 0)   ?? 0;
  const totalPending = salaries?.filter(s => s.status === "unpaid").reduce((a, s) => a + s.amount, 0) ?? 0;

  const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

  // Print table cell styles
  const th  = { padding: "8px 10px", background: "#dbeafe", color: "#1e3a8a", fontWeight: 700, fontSize: 10, textAlign: "left" as const, border: "1px solid #93c5fd" };
  const td  = { padding: "7px 10px", border: "1px solid #e5e7eb", fontSize: 10, color: "#1f2937", background: "#ffffff" };
  const tdA = { ...td, background: "#f0f9ff" };

  // ── Print portal ──────────────────────────────────────────────────────────
  const printPortal = createPortal(
    <div id="kips-print-portal" style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif", background: "white", color: "#111827" }}>
      {/* Letterhead */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e3a8a" }}>KIPS School Hassari</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#ea580c", fontWeight: 700 }}>Bright Future — School Portal</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#6b7280" }}>{printDate}</p>
        </div>
      </div>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>Salary Report</h2>
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#6b7280" }}>Staff salary management & payroll summary</p>
      </div>
      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Total Records", value: (salaries ?? []).length,                         color: "#1d4ed8" },
          { label: "Total Paid",    value: `PKR ${totalPaid.toLocaleString()}`,    color: "#065f46" },
          { label: "Pending",       value: `PKR ${totalPending.toLocaleString()}`, color: "#b91c1c" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 0", border: `2px solid ${c.color}`, borderRadius: 8, padding: "10px 8px", textAlign: "center", background: "#f9fafb" }}>
            <p style={{ margin: 0, fontSize: 8, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.7 }}>{c.label}</p>
            <p style={{ margin: "6px 0 0", fontSize: 14, fontWeight: 900, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>
      {/* Table */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 4, height: 18, background: "#1d4ed8", borderRadius: 2 }} />
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.7 }}>
          Salary Records — {(salaries ?? []).length}
        </h3>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["#","Staff Member","Month","Basic (PKR)","Paid Date","Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {!(salaries ?? []).length
            ? <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No salary records found</td></tr>
            : (salaries ?? []).map((sal, i) => (
              <tr key={sal.id}>
                <td style={i % 2 === 0 ? td : tdA}>{i + 1}</td>
                <td style={{ ...(i % 2 === 0 ? td : tdA), fontWeight: 700 }}>{sal.staffName || "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{sal.month}</td>
                <td style={{ ...(i % 2 === 0 ? td : tdA), fontWeight: 700 }}>PKR {sal.amount.toLocaleString()}</td>
                <td style={i % 2 === 0 ? td : tdA}>{sal.paidDate || "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{sal.status}</td>
              </tr>
            ))
          }
        </tbody>
        {(salaries ?? []).length > 0 && (
          <tfoot>
            <tr style={{ background: "#dbeafe" }}>
              <td colSpan={3} style={th}>Summary</td>
              <td style={{ ...th, color: "#065f46" }}>Paid: PKR {totalPaid.toLocaleString()}</td>
              <td style={{ ...th, color: "#b91c1c" }}>Pending: PKR {totalPending.toLocaleString()}</td>
              <td style={th} />
            </tr>
          </tfoot>
        )}
      </table>
      {/* Footer */}
      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 28, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
        <p style={{ margin: 0, fontSize: 8, color: "#9ca3af" }}>KIPS School Hassari — Bright Future School Management Portal</p>
        <p style={{ margin: 0, fontSize: 8, color: "#9ca3af" }}>Generated: {printDate}</p>
      </div>
    </div>,
    document.body
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {printPortal}
      {slipSalary && <SalarySlip salary={slipSalary} onClose={() => setSlipSalary(null)} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salaries</h1>
            <p className="text-gray-500 text-sm mt-1">Staff salary management & payslips with deductions</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            {/* Create button — admin + teacher */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white">
                  <Plus className="w-4 h-4 mr-2" /> Add Record
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Salary Record</DialogTitle></DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField control={createForm.control} name="staffId" render={({ field }) => (
                      <FormItem><FormLabel>Staff Member *</FormLabel>
                        <Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl>
                          <SelectContent>{staff?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}</SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={createForm.control} name="amount" render={({ field }) => (
                      <FormItem><FormLabel>Basic Salary (PKR) *</FormLabel><FormControl><Input type="number" placeholder="35000" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={createForm.control} name="month" render={({ field }) => (
                      <FormItem><FormLabel>Month *</FormLabel><FormControl><Input type="month" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Create
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Records", value: (salaries?.length ?? 0).toString(),          gradient: "from-blue-500 to-cyan-500" },
            { label: "Total Paid",    value: `PKR ${totalPaid.toLocaleString()}`,    gradient: "from-emerald-500 to-green-500" },
            { label: "Pending",       value: `PKR ${totalPending.toLocaleString()}`, gradient: "from-red-500 to-rose-600"      },
          ].map(c => (
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${c.gradient} p-4`}>
                  <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                  <p className="text-white text-xl font-bold mt-1">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Status filters */}
        <div className="flex gap-2">
          {[{ val: undefined, label: "All" }, { val: "paid", label: "Paid" }, { val: "unpaid", label: "Unpaid" }].map(f => (
            <Button key={f.label} size="sm"
              variant={statusFilter === f.val ? "default" : "outline"}
              onClick={() => setStatusFilter(f.val)}
            >{f.label}</Button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading
              ? <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {["Staff Member","Month","Basic (PKR)","Paid Date","Status","Actions"].map(h => (
                          <th key={h} className="text-left py-3 px-3 font-semibold text-gray-600">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {!salaries?.length
                        ? <tr><td colSpan={6} className="py-12 text-center text-gray-400">No salary records found</td></tr>
                        : salaries.map(sal => (
                          <tr key={sal.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-3 font-medium text-gray-900">{sal.staffName || "—"}</td>
                            <td className="py-3 px-3 text-gray-600">{sal.month}</td>
                            <td className="py-3 px-3 font-bold text-gray-900">PKR {sal.amount.toLocaleString()}</td>
                            <td className="py-3 px-3 text-gray-500">{sal.paidDate || "—"}</td>
                            <td className="py-3 px-3">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${sal.status === "paid" ? "bg-emerald-100 text-emerald-700 border-emerald-200" : "bg-red-100 text-red-700 border-red-200"}`}>
                                {sal.status}
                              </span>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1">
                                {/* Salary Slip */}
                                <Button size="sm" variant="outline"
                                  className="h-7 text-xs border-blue-200 text-blue-600 hover:bg-blue-50"
                                  onClick={() => setSlipSalary(sal as Salary)}
                                >
                                  <FileText className="w-3 h-3 mr-1" /> Slip
                                </Button>

                                {/* Pay button */}
                                {sal.status === "unpaid" && (
                                  <Button size="sm"
                                    className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                    onClick={() => handlePay(sal.id)}
                                    disabled={payMutation.isPending}
                                  >Pay</Button>
                                )}

                                {/* Edit — admin only */}
                                {isAdmin && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 w-7 p-0 text-blue-600 border-blue-200 hover:bg-blue-50"
                                    title="Edit salary"
                                    onClick={() => openEdit(sal as Salary)}
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                )}

                                {/* Delete — admin only */}
                                {isAdmin && (
                                  <Button size="sm" variant="outline"
                                    className="h-7 w-7 p-0 text-red-600 border-red-200 hover:bg-red-50"
                                    title="Delete salary"
                                    onClick={() => setDeleteTarget(sal as Salary)}
                                    disabled={deletingId === sal.id}
                                  >
                                    {deletingId === sal.id
                                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      : <Trash2 className="w-3.5 h-3.5" />}
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))
                      }
                    </tbody>
                  </table>
                </div>
              )
            }
          </CardContent>
        </Card>
      </div>

      {/* ── Edit Salary Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!editTarget} onOpenChange={o => { if (!o) setEditTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salary Record Edit Karo</DialogTitle></DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField control={editForm.control} name="staffId" render={({ field }) => (
                <FormItem><FormLabel>Staff Member *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {staff?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Basic Salary (PKR) *</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editForm.control} name="month" render={({ field }) => (
                <FormItem>
                  <FormLabel>Month *</FormLabel>
                  <FormControl><Input type="month" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              {editTarget?.status === "paid" && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-amber-700">
                  ⚠ This salary is already marked as paid — only amount and month can be edited, status will not change
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
                <Button type="submit" disabled={editSaving}>
                  {editSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Update
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirm Dialog ────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={o => { if (!o) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Salary Record Delete?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            <strong>{deleteTarget?.staffName}</strong> — {deleteTarget?.month} salary record will be permanently deleted.
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
    </>
  );
}
