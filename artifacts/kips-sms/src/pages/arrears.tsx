import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useListFees, useListStudents, useListClasses } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  ClipboardList, Printer, AlertTriangle, GraduationCap, ArrowRight,
  Users, CheckCircle2, XCircle, ChevronRight, TrendingUp, AlertCircle,
  Plus, Pencil, Trash2, Info, KeyRound,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Auth token helper ─────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem("kips_token");
const authHeaders = () => ({
  "Content-Type": "application/json",
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

// ── API helpers ───────────────────────────────────────────────────────────────
async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, { ...options, headers: { ...authHeaders(), ...(options?.headers ?? {}) } });
  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error ?? "Request failed");
  return json;
}

const createFeeRecord = (data: Record<string, unknown>) =>
  apiFetch("/api/fees", { method: "POST", body: JSON.stringify(data) });

const updateFeeRecord = (id: number, data: Record<string, unknown>) =>
  apiFetch(`/api/fees/${id}`, { method: "PUT", body: JSON.stringify(data) });

const deleteFeeRecord = (id: number) =>
  apiFetch(`/api/fees/${id}`, { method: "DELETE" });

const fixStaffLogins = () =>
  apiFetch("/api/staff/fix-logins", { method: "POST" });

const promoteStudents = (payload: { fromClassId: number; toClassId: number; studentIds: number[] }) =>
  apiFetch("/api/students/promote", { method: "POST", body: JSON.stringify(payload) });

// ── Print styles ──────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body > *:not(#kips-print-portal) { display: none !important; }
    #kips-print-portal {
      display: block !important; position: absolute !important;
      top: 0 !important; left: 0 !important; width: 100% !important;
      background: white !important; font-family: Arial, sans-serif !important;
      color: #111827 !important; font-size: 11pt !important;
      padding: 14mm 14mm !important; box-sizing: border-box !important;
    }
    table { border-collapse: collapse !important; width: 100% !important; }
    tr { page-break-inside: avoid; } thead { display: table-header-group; }
  }
`;
const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

// ── Types ─────────────────────────────────────────────────────────────────────
interface ArrearRow {
  id: number;
  month: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  fine: number;
  dueDate: string;
  notes: string | null;
  status: string;
}
interface StudentArrears {
  studentId: number;
  studentName: string;
  admissionNumber: string;
  className: string;
  rows: ArrearRow[];
  totalArrears: number;
}

// ── Class card gradients ──────────────────────────────────────────────────────
const CLASS_GRADIENTS = [
  { from: "#6366f1", to: "#8b5cf6", light: "#ede9fe", border: "#a78bfa", text: "#4c1d95" },
  { from: "#0ea5e9", to: "#2563eb", light: "#dbeafe", border: "#93c5fd", text: "#1e3a8a" },
  { from: "#10b981", to: "#059669", light: "#d1fae5", border: "#6ee7b7", text: "#064e3b" },
  { from: "#f59e0b", to: "#d97706", light: "#fef3c7", border: "#fcd34d", text: "#78350f" },
  { from: "#ef4444", to: "#dc2626", light: "#fee2e2", border: "#fca5a5", text: "#7f1d1d" },
  { from: "#ec4899", to: "#db2777", light: "#fce7f3", border: "#f9a8d4", text: "#831843" },
  { from: "#14b8a6", to: "#0d9488", light: "#ccfbf1", border: "#5eead4", text: "#134e4a" },
  { from: "#f97316", to: "#ea580c", light: "#ffedd5", border: "#fdba74", text: "#7c2d12" },
  { from: "#06b6d4", to: "#0284c7", light: "#e0f2fe", border: "#7dd3fc", text: "#0c4a6e" },
  { from: "#8b5cf6", to: "#7c3aed", light: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
];
const getGradient = (i: number) => CLASS_GRADIENTS[i % CLASS_GRADIENTS.length];

// ── Empty form ────────────────────────────────────────────────────────────────
const emptyForm = () => ({
  studentId: "",
  month:    new Date().toISOString().slice(0, 7),
  amount:   "",
  fine:     "0",
  dueDate:  new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  notes:    "",
});

// ══════════════════════════════════════════════════════════════════════════════
export default function Arrears() {
  const [activeTab, setActiveTab] = useState<"arrears" | "promotion">("arrears");
  const { data: fees,     isLoading: feesLoading }     = useListFees({});
  const { data: students, isLoading: studentsLoading } = useListStudents({});
  const { data: classes,  isLoading: classesLoading }  = useListClasses();
  const queryClient = useQueryClient();
  const { toast }   = useToast();

  // ── Dialog state ─────────────────────────────────────────────────────────────
  const [addOpen,    setAddOpen]    = useState(false);
  const [editOpen,   setEditOpen]   = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editRow,    setEditRow]    = useState<ArrearRow & { studentName: string } | null>(null);
  const [deleteRow,  setDeleteRow]  = useState<ArrearRow & { studentName: string } | null>(null);
  const [form,       setForm]       = useState(emptyForm());
  const [saving,     setSaving]     = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // ── Promotion state ───────────────────────────────────────────────────────────
  const [promoteOpen,       setPromoteOpen]       = useState(false);
  const [selectedFromClass, setSelectedFromClass] = useState<number | null>(null);
  const [selectedToClassId, setSelectedToClassId] = useState("");
  const [includeArrears,    setIncludeArrears]    = useState(false);
  const [promoting,         setPromoting]         = useState(false);
  const [fixingLogins,      setFixingLogins]      = useState(false);

  // ── Print styles inject ───────────────────────────────────────────────────────
  useEffect(() => {
    document.getElementById("kips-print-styles")?.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles"; el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // ── Build arrears grouped by student ─────────────────────────────────────────
  const overdueFees = (fees ?? []).filter(f =>
    (f.status === "unpaid" || f.status === "partial") && f.dueDate < today
  );
  const byStudent: Record<number, StudentArrears> = {};
  for (const f of overdueFees) {
    if (!f.studentName || f.studentName === "—" || !f.className || f.className === "—") {
      continue;
    }
    const sid = f.studentId;
    if (!byStudent[sid]) byStudent[sid] = {
      studentId:       sid,
      studentName:     f.studentName ?? "—",
      admissionNumber: f.admissionNumber ?? "—",
      className:       f.className ?? "—",
      rows:            [],
      totalArrears:    0,
    };
    const remaining = f.remainingAmount ?? (f.amount - (f.paidAmount ?? 0));
    const fine      = f.fine ?? 0;
    byStudent[sid].rows.push({
      id:        f.id,
      month:     f.month,
      amount:    f.amount,
      paidAmount:f.paidAmount ?? 0,
      remaining,
      fine,
      dueDate:   f.dueDate,
      notes:     (f as Record<string, unknown>).notes as string | null ?? null,
      status:    f.status,
    });
    byStudent[sid].totalArrears += remaining + fine;
  }
  const arrears    = Object.values(byStudent).sort((a, b) => b.totalArrears - a.totalArrears);
  const grandTotal = arrears.reduce((s, a) => s + a.totalArrears, 0);

  // ── Promotion helpers ─────────────────────────────────────────────────────────
  const arrearStudentIds = new Set(arrears.map(a => a.studentId));
  const classSummaries   = (classes ?? []).map((cls, idx) => {
    const clsStudents = (students ?? []).filter(s => s.classId === cls.id && s.status === "active");
    const arrearCount = clsStudents.filter(s => arrearStudentIds.has(s.id)).length;
    return {
      cls, idx,
      total:      clsStudents.length,
      arrearCount,
      clearCount: clsStudents.length - arrearCount,
      list:       clsStudents,
    };
  }).filter(c => c.total > 0);

  const fromInfo    = classSummaries.find(c => c.cls.id === selectedFromClass);
  const fromStudents= fromInfo?.list ?? [];
  const eligible    = includeArrears ? fromStudents : fromStudents.filter(s => !arrearStudentIds.has(s.id));

  // ── Cache invalidation ────────────────────────────────────────────────────────
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["/api/fees"] });
  }, [queryClient]);

  // ── Add arrear ────────────────────────────────────────────────────────────────
  const handleAdd = async () => {
    if (!form.studentId || !form.amount || !form.month || !form.dueDate) {
      toast({ variant: "destructive", title: "Please fill all required fields" });
      return;
    }
    setSaving(true);
    try {
      await createFeeRecord({
        studentId:  Number(form.studentId),
        amount:     form.amount,
        fine:       form.fine || "0",
        month:      form.month,
        dueDate:    form.dueDate,
        status:     "unpaid",
        notes:      form.notes || null,
        paidAmount: "0",
      });
      toast({ title: "Arrear added", description: "Fee record created and will appear in student's fee section." });
      setAddOpen(false);
      setForm(emptyForm());
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Failed", description: String((e as Error).message) });
    } finally { setSaving(false); }
  };

  // ── Edit arrear ───────────────────────────────────────────────────────────────
  const handleEdit = async () => {
    if (!editRow) return;
    setSaving(true);
    try {
      await updateFeeRecord(editRow.id, {
        amount:  form.amount,
        fine:    form.fine || "0",
        month:   form.month,
        dueDate: form.dueDate,
        notes:   form.notes || null,
      });
      toast({ title: "Arrear updated successfully" });
      setEditOpen(false);
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Failed", description: String((e as Error).message) });
    } finally { setSaving(false); }
  };

  // ── Delete arrear ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await deleteFeeRecord(deleteRow.id);
      toast({ title: "Arrear deleted" });
      setDeleteOpen(false);
      invalidate();
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Failed", description: String((e as Error).message) });
    } finally { setDeleting(false); }
  };

  // ── Open edit dialog ──────────────────────────────────────────────────────────
  const openEdit = (row: ArrearRow, studentName: string) => {
    setEditRow({ ...row, studentName });
    setForm({ studentId: "", month: row.month, amount: String(row.amount), fine: String(row.fine), dueDate: row.dueDate, notes: row.notes ?? "" });
    setEditOpen(true);
  };

  // ── Promote students ──────────────────────────────────────────────────────────
  const handlePromote = async () => {
    if (!selectedFromClass || !selectedToClassId || eligible.length === 0) return;
    setPromoting(true);
    try {
      const result = await promoteStudents({
        fromClassId: selectedFromClass,
        toClassId:   Number(selectedToClassId),
        studentIds:  eligible.map(s => s.id),
      }) as { promoted: number; fromClass: string; toClass: string; feeUpdated: boolean; newFeeAmount: number | null };
      toast({
        title:       `${result.promoted} students promoted!`,
        description: `${result.fromClass} → ${result.toClass}${result.feeUpdated ? ` · Fee updated: PKR ${result.newFeeAmount?.toLocaleString()}` : ""}`,
      });
      setPromoteOpen(false);
      setSelectedFromClass(null);
      setSelectedToClassId("");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Promotion failed", description: String((e as Error).message) });
    } finally { setPromoting(false); }
  };

  // ── Fix staff logins ──────────────────────────────────────────────────────────
  const handleFixLogins = async () => {
    setFixingLogins(true);
    try {
      const r = await fixStaffLogins() as { fixed: number; message: string };
      toast({ title: "Staff logins fixed", description: r.message });
    } catch {
      toast({ variant: "destructive", title: "Failed to fix logins" });
    } finally { setFixingLogins(false); }
  };

  // ── Print portal ──────────────────────────────────────────────────────────────
  const thI = { padding: "6px 8px", background: "#fef3c7", color: "#78350f", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #fcd34d" };
  const td  = { padding: "6px 8px", border: "1px solid #e5e7eb", fontSize: 9, color: "#1f2937", background: "#ffffff" };

  const printPortal = createPortal(
    <div id="kips-print-portal" style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif", background: "white", color: "#111827" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 80, height: 80, objectFit: "contain" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e3a8a" }}>KIPS School Hassari</h1>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#ea580c", fontWeight: 700 }}>Bright Future — School Portal</p>
          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#6b7280" }}>{printDate}</p>
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#c2410c" }}>Fee Arrears Report</h2>
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#6b7280" }}>All overdue unpaid / partial fees grouped by student</p>
      </div>
      {arrears.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>No arrears — all fees are up to date</div>
      ) : arrears.map((s, si) => (
        <div key={s.studentId} style={{ marginBottom: 18, border: "2px solid #e07b1a", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#fff7ed", padding: "8px 12px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #fed7aa" }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 11, color: "#7c2d12" }}>{si + 1}. {s.studentName}</span>
              <span style={{ marginLeft: 10, fontSize: 9, color: "#92400e", fontFamily: "monospace" }}>{s.admissionNumber}</span>
              <span style={{ marginLeft: 8, fontSize: 9, color: "#6b7280" }}>{s.className}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 8, color: "#6b7280" }}>Total Arrears</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#b91c1c" }}>PKR {s.totalArrears.toLocaleString()}</p>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Month","Description","Fee","Paid","Remaining","Fine","Total Due"].map(h => <th key={h} style={thI}>{h}</th>)}</tr></thead>
            <tbody>
              {s.rows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.month}</td>
                  <td style={{ ...td, fontStyle: r.notes ? "normal" : "italic" }}>{r.notes ?? "—"}</td>
                  <td style={td}>PKR {r.amount.toLocaleString()}</td>
                  <td style={{ ...td, color: "#059669" }}>{r.paidAmount > 0 ? `PKR ${r.paidAmount.toLocaleString()}` : "—"}</td>
                  <td style={{ ...td, color: "#b91c1c" }}>PKR {r.remaining.toLocaleString()}</td>
                  <td style={{ ...td, color: "#c2410c" }}>{r.fine > 0 ? `PKR ${r.fine.toLocaleString()}` : "—"}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#7f1d1d" }}>PKR {(r.remaining + r.fine).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {arrears.length > 0 && (
        <div style={{ border: "2px solid #7f1d1d", borderRadius: 8, padding: "12px 16px", background: "#fef2f2", display: "flex", justifyContent: "space-between", marginTop: 10 }}>
          <p style={{ margin: 0, fontWeight: 800, fontSize: 12, color: "#7f1d1d" }}>Grand Total Arrears</p>
          <p style={{ margin: 0, fontWeight: 900, fontSize: 22, color: "#991b1b" }}>PKR {grandTotal.toLocaleString()}</p>
        </div>
      )}
    </div>,
    document.body
  );

  const isLoading = feesLoading || studentsLoading || classesLoading;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <>
      {printPortal}

      <div className="space-y-5">

        {/* Page header */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-orange-600" /> Arrears &amp; Promotion
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">Manage fee arrears and promote students to the next class</p>
          </div>
          <div className="flex gap-2">
            {activeTab === "arrears" && (
              <>
                <Button onClick={() => { setForm(emptyForm()); setAddOpen(true); }}
                  className="bg-orange-600 hover:bg-orange-700 text-white">
                  <Plus className="w-4 h-4 mr-1.5" /> Add Arrear
                </Button>
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="w-4 h-4 mr-1.5" /> Print
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit no-print">
          {([
            { key: "arrears",   label: "Fee Arrears",      icon: AlertTriangle },
            { key: "promotion", label: "Student Promotion", icon: GraduationCap },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={cn("flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                activeTab === t.key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* ══ TAB: FEE ARREARS ════════════════════════════════════════════════════ */}
        {activeTab === "arrears" && (
          isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full" />)}</div>
          ) : arrears.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-gray-600 font-semibold">No arrears found</p>
                <p className="text-gray-400 text-sm mt-1">All fees are up to date</p>
                <Button className="mt-5 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => { setForm(emptyForm()); setAddOpen(true); }}>
                  <Plus className="w-4 h-4 mr-1.5" /> Add Previous Arrear
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Students with Arrears", value: arrears.length,                         color: "blue"   },
                  { label: "Total Overdue Records",  value: overdueFees.length,                    color: "orange" },
                  { label: "Grand Total Arrears",    value: `PKR ${grandTotal.toLocaleString()}`,  color: "red"    },
                ].map(s => (
                  <div key={s.label} className={cn("rounded-xl border p-4 text-center",
                    s.color === "blue"   ? "bg-blue-50 border-blue-200"     :
                    s.color === "orange" ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200")}>
                    <p className={cn("text-xs font-semibold uppercase tracking-wide",
                      s.color === "blue" ? "text-blue-500" : s.color === "orange" ? "text-orange-500" : "text-red-500")}>{s.label}</p>
                    <p className={cn("text-2xl font-extrabold mt-1",
                      s.color === "blue" ? "text-blue-700" : s.color === "orange" ? "text-orange-700" : "text-red-700")}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Per-student cards */}
              {arrears.map(s => (
                <Card key={s.studentId} className="overflow-hidden border-l-4 border-l-orange-500">
                  <div className="bg-orange-50 border-b border-orange-100 px-5 py-3 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900 text-base">{s.studentName}</h3>
                      <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                        <span className="font-mono text-purple-600 font-semibold">{s.admissionNumber}</span>
                        <span className="bg-gray-100 px-2 py-0.5 rounded-full">{s.className}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Total Outstanding</p>
                      <p className="text-xl font-extrabold text-red-600">PKR {s.totalArrears.toLocaleString()}</p>
                    </div>
                  </div>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                            <th className="text-left px-4 py-2.5">Month</th>
                            <th className="text-left px-4 py-2.5">Description</th>
                            <th className="text-right px-4 py-2.5">Fee</th>
                            <th className="text-right px-4 py-2.5">Paid</th>
                            <th className="text-right px-4 py-2.5">Remaining</th>
                            <th className="text-right px-4 py-2.5">Fine</th>
                            <th className="text-right px-4 py-2.5">Total Due</th>
                            <th className="text-center px-4 py-2.5">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.map((row, ri) => (
                            <tr key={row.id} className={cn("border-b last:border-0 hover:bg-gray-50 transition-colors", ri % 2 === 0 ? "bg-white" : "bg-gray-50/30")}>
                              <td className="px-4 py-3 font-semibold text-gray-800">{row.month}</td>
                              <td className="px-4 py-3 max-w-[180px]">
                                {row.notes
                                  ? <span className="text-gray-700">{row.notes}</span>
                                  : <span className="text-gray-300 italic text-xs">No description</span>}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">PKR {row.amount.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-green-600">
                                {row.paidAmount > 0 ? `PKR ${row.paidAmount.toLocaleString()}` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-red-600">PKR {row.remaining.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right text-orange-600">
                                {row.fine > 0 ? `PKR ${row.fine.toLocaleString()}` : <span className="text-gray-300">—</span>}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-red-700">PKR {(row.remaining + row.fine).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button onClick={() => openEdit(row, s.studentName)}
                                    className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors">
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => { setDeleteRow({ ...row, studentName: s.studentName }); setDeleteOpen(true); }}
                                    className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              ))}

              {/* Grand total */}
              <div className="flex justify-end">
                <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-3 text-right">
                  <p className="text-sm text-gray-500">Grand Total Arrears</p>
                  <p className="text-2xl font-extrabold text-red-700">PKR {grandTotal.toLocaleString()}</p>
                </div>
              </div>
            </div>
          )
        )}

        {/* ══ TAB: STUDENT PROMOTION ═══════════════════════════════════════════════ */}
        {activeTab === "promotion" && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-800">Annual Student Promotion</p>
                <p className="text-xs text-indigo-600 mt-0.5">Promote a class to the next level. Fee amounts auto-update based on the target class fee structure.</p>
              </div>
            </div>

            {/* Staff credentials card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound className="w-4 h-4 text-slate-600" />
                <p className="text-sm font-semibold text-slate-800">Staff Login Credentials</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Username Format</p>
                  <p className="font-mono font-semibold text-slate-700">firstname.lastname.staff</p>
                  <p className="text-xs text-slate-400 mt-1">e.g. ali.khan.staff</p>
                </div>
                <div className="bg-white rounded-lg border border-slate-200 p-3">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Default Password</p>
                  <p className="font-mono font-semibold text-slate-700">kips123</p>
                  <p className="text-xs text-slate-400 mt-1">Can be changed after first login</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between rounded-lg bg-amber-50 border border-amber-100 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                  <p className="text-xs text-amber-700">Staff missing login access? Click to create accounts for all staff.</p>
                </div>
                <Button size="sm" variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100 text-xs h-7 shrink-0"
                  onClick={handleFixLogins} disabled={fixingLogins}>
                  {fixingLogins ? "Fixing..." : "Fix Logins"}
                </Button>
              </div>
            </div>

            {/* Class cards */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-2xl" />)}
              </div>
            ) : classSummaries.length === 0 ? (
              <Card><CardContent className="py-16 text-center">
                <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No classes with active students found</p>
              </CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {classSummaries.map(({ cls, idx, total, arrearCount, clearCount }) => {
                  const g = getGradient(idx);
                  return (
                    <div key={cls.id} className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border"
                      style={{ borderColor: g.border, background: g.light }}>
                      <div className="px-5 py-4 text-white"
                        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Class</p>
                            <h3 className="text-xl font-extrabold mt-0.5">{cls.name}</h3>
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3 space-y-2.5">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" style={{ color: g.from }} />
                            <span className="text-sm font-medium" style={{ color: g.text }}>Total Students</span>
                          </div>
                          <Badge style={{ background: g.from, color: "#fff", border: "none" }}>{total}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                            <span className="text-sm font-medium text-green-700">Fee Clear</span>
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-green-200">{clearCount}</Badge>
                        </div>
                        {arrearCount > 0 && (
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5 text-red-500" />
                              <span className="text-sm font-medium text-red-700">With Arrears</span>
                            </div>
                            <Badge className="bg-red-100 text-red-700 border-red-200">{arrearCount}</Badge>
                          </div>
                        )}
                      </div>
                      <div className="px-5 pb-4">
                        <button
                          onClick={() => { setSelectedFromClass(cls.id); setSelectedToClassId(""); setIncludeArrears(false); setPromoteOpen(true); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white hover:opacity-90 transition-opacity"
                          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}>
                          Promote Class <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ═══ ADD ARREAR DIALOG ═══════════════════════════════════════════════════ */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Plus className="w-5 h-5 text-orange-500" /> Add Previous Arrear</DialogTitle>
            <DialogDescription>Manually add an unpaid fee record. It will appear in the student's fee section automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Student <span className="text-red-500">*</span></Label>
              <Select value={form.studentId} onValueChange={v => setForm(f => ({ ...f, studentId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {(students ?? []).filter(s => s.status === "active").sort((a, b) => a.name.localeCompare(b.name)).map(s => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} — {s.admissionNumber} ({(s as Record<string, unknown>).className as string ?? "No Class"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month <span className="text-red-500">*</span></Label>
                <Input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date <span className="text-red-500">*</span></Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (PKR) <span className="text-red-500">*</span></Label>
                <Input type="number" placeholder="e.g. 2500" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fine (PKR)</Label>
                <Input type="number" placeholder="0" value={form.fine} onChange={e => setForm(f => ({ ...f, fine: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description / Notes</Label>
              <Textarea placeholder="e.g. Previous year arrear 2024-25, Annual charges, etc." rows={2}
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-xs text-blue-700">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              This record will be saved as "unpaid" and will automatically appear in the Fee Arrears list and the student's fee details.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={saving} className="bg-orange-600 hover:bg-orange-700 text-white">
              {saving ? "Saving..." : "Add Arrear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ EDIT ARREAR DIALOG ══════════════════════════════════════════════════ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="w-5 h-5 text-blue-500" /> Edit Arrear</DialogTitle>
            <DialogDescription>Student: <strong>{editRow?.studentName}</strong></DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Month</Label>
                <Input type="month" value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (PKR)</Label>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fine (PKR)</Label>
                <Input type="number" value={form.fine} onChange={e => setForm(f => ({ ...f, fine: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description / Notes</Label>
              <Textarea placeholder="Description of this arrear..." rows={2}
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEdit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ DELETE DIALOG ═══════════════════════════════════════════════════════ */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="w-5 h-5" /> Delete Arrear?</DialogTitle>
            <DialogDescription>
              This will permanently delete the arrear for <strong>{deleteRow?.studentName}</strong> — Month: <strong>{deleteRow?.month}</strong>, Amount: <strong>PKR {deleteRow?.amount.toLocaleString()}</strong>. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button onClick={handleDelete} disabled={deleting} variant="destructive">
              {deleting ? "Deleting..." : "Yes, Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ PROMOTION DIALOG ════════════════════════════════════════════════════ */}
      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><GraduationCap className="w-5 h-5 text-indigo-600" /> Promote Students</DialogTitle>
            <DialogDescription>Move students from <strong>{fromInfo?.cls.name}</strong> to the selected class.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
                <p className="text-xs text-indigo-500 font-semibold uppercase">From</p>
                <p className="font-bold text-indigo-800 mt-0.5">{fromInfo?.cls.name ?? "—"}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1">
                <Select value={selectedToClassId} onValueChange={setSelectedToClassId}>
                  <SelectTrigger><SelectValue placeholder="Select target class" /></SelectTrigger>
                  <SelectContent>
                    {(classes ?? []).filter(c => c.id !== selectedFromClass).map(c => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border bg-gray-50 px-4 py-3">
              <div>
                <Label htmlFor="inc-arrears" className="font-semibold text-sm cursor-pointer">
                  Include students with arrears
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {includeArrears
                    ? `All ${fromInfo?.total ?? 0} students will be promoted`
                    : `${fromInfo?.clearCount ?? 0} promoted · ${fromInfo?.arrearCount ?? 0} held back`}
                </p>
              </div>
              <Switch id="inc-arrears" checked={includeArrears} onCheckedChange={setIncludeArrears} />
            </div>

            {selectedToClassId && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-green-800">Promotion Summary</p>
                <div className="text-xs text-green-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Students to promote:</span>
                    <span className="font-bold">{eligible.length}</span>
                  </div>
                  {!includeArrears && (fromInfo?.arrearCount ?? 0) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Held back (arrears):</span>
                      <span className="font-bold">{fromInfo?.arrearCount}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>Fee auto-update:</span>
                    <span className="font-bold">Yes</span>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteOpen(false)}>Cancel</Button>
            <Button
              onClick={handlePromote}
              disabled={promoting || !selectedToClassId || eligible.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {promoting ? "Promoting..." : `Promote ${eligible.length} Student${eligible.length !== 1 ? "s" : ""}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
