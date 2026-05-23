import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useListFees, useListStudents, useListClasses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ClipboardList, Printer, AlertTriangle, GraduationCap, ArrowRight,
  Users, CheckCircle2, XCircle, ChevronRight, TrendingUp, AlertCircle,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

setAuthTokenGetter(() => localStorage.getItem("kips_token"));

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

interface StudentArrears {
  studentId: number; studentName: string; admissionNumber: string;
  className: string; months: { month: string; amount: number; remaining: number; fine: number }[];
  totalArrears: number;
}

// ── Class card gradient palette ───────────────────────────────────────────────
const CLASS_GRADIENTS = [
  { from: "#6366f1", to: "#8b5cf6", light: "#ede9fe", border: "#a78bfa", text: "#4c1d95" },
  { from: "#0ea5e9", to: "#2563eb", light: "#dbeafe", border: "#93c5fd", text: "#1e3a8a" },
  { from: "#10b981", to: "#059669", light: "#d1fae5", border: "#6ee7b7", text: "#064e3b" },
  { from: "#f59e0b", to: "#d97706", light: "#fef3c7", border: "#fcd34d", text: "#78350f" },
  { from: "#ef4444", to: "#dc2626", light: "#fee2e2", border: "#fca5a5", text: "#7f1d1d" },
  { from: "#ec4899", to: "#db2777", light: "#fce7f3", border: "#f9a8d4", text: "#831843" },
  { from: "#14b8a6", to: "#0d9488", light: "#ccfbf1", border: "#5eead4", text: "#134e4a" },
  { from: "#8b5cf6", to: "#7c3aed", light: "#ede9fe", border: "#c4b5fd", text: "#4c1d95" },
  { from: "#f97316", to: "#ea580c", light: "#ffedd5", border: "#fdba74", text: "#7c2d12" },
  { from: "#06b6d4", to: "#0284c7", light: "#e0f2fe", border: "#7dd3fc", text: "#0c4a6e" },
];

function getGradient(idx: number) { return CLASS_GRADIENTS[idx % CLASS_GRADIENTS.length]; }

// ── Promotion API call (direct fetch) ─────────────────────────────────────────
async function promoteStudents(payload: {
  fromClassId: number; toClassId: number; studentIds: number[];
}) {
  const token = localStorage.getItem("kips_token");
  const res = await fetch("/api/students/promote", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Promotion failed");
  return res.json() as Promise<{ promoted: number; fromClass: string; toClass: string; feeUpdated: boolean; newFeeAmount: number | null }>;
}

// ── Fix staff logins API call ──────────────────────────────────────────────────
async function fixStaffLogins() {
  const token = localStorage.getItem("kips_token");
  const res = await fetch("/api/staff/fix-logins", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<{ fixed: number; total: number; message: string }>;
}

// ══════════════════════════════════════════════════════════════════════════════
export default function Arrears() {
  const [activeTab, setActiveTab] = useState<"arrears" | "promotion">("arrears");
  const { data: fees, isLoading: feesLoading } = useListFees({});
  const { data: students, isLoading: studentsLoading } = useListStudents({});
  const { data: classes, isLoading: classesLoading } = useListClasses();
  const { toast } = useToast();

  const [promoteDialogOpen, setPromoteDialogOpen] = useState(false);
  const [selectedFromClass, setSelectedFromClass] = useState<number | null>(null);
  const [selectedToClassId, setSelectedToClassId] = useState<string>("");
  const [includeArrearStudents, setIncludeArrearStudents] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [fixingLogins, setFixingLogins] = useState(false);

  useEffect(() => {
    const existing = document.getElementById("kips-print-styles");
    if (existing) existing.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles"; el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const today = new Date().toISOString().slice(0, 10);

  // ── Arrears computation ──────────────────────────────────────────────────────
  const overdueFees = (fees ?? []).filter(f =>
    (f.status === "unpaid" || f.status === "partial") && f.dueDate < today
  );
  const byStudent: Record<number, StudentArrears> = {};
  for (const f of overdueFees) {
    const sid = f.studentId;
    if (!byStudent[sid]) byStudent[sid] = {
      studentId: sid, studentName: f.studentName ?? "—",
      admissionNumber: f.admissionNumber ?? "—", className: f.className ?? "—",
      months: [], totalArrears: 0,
    };
    const remaining = f.remainingAmount ?? (f.amount - (f.paidAmount ?? 0));
    const fine = f.fine ?? 0;
    byStudent[sid].months.push({ month: f.month, amount: f.amount, remaining, fine });
    byStudent[sid].totalArrears += remaining + fine;
  }
  const arrears = Object.values(byStudent).sort((a, b) => b.totalArrears - a.totalArrears);
  const grandTotal = arrears.reduce((s, a) => s + a.totalArrears, 0);

  // ── Promotion computation ─────────────────────────────────────────────────────
  const studentArrearIds = new Set(arrears.map(a => a.studentId));

  const classSummaries = (classes ?? []).map((cls, idx) => {
    const clsStudents = (students ?? []).filter(s => s.classId === cls.id && s.status === "active");
    const arrearStudents = clsStudents.filter(s => studentArrearIds.has(s.id));
    return {
      cls, idx,
      totalStudents: clsStudents.length,
      arrearStudents: arrearStudents.length,
      clearStudents: clsStudents.length - arrearStudents.length,
      studentList: clsStudents,
    };
  }).filter(c => c.totalStudents > 0);

  // Students in selected from-class
  const fromClassStudents = selectedFromClass
    ? (students ?? []).filter(s => s.classId === selectedFromClass && s.status === "active")
    : [];
  const fromClassArrearIds = new Set(
    fromClassStudents.filter(s => studentArrearIds.has(s.id)).map(s => s.id)
  );
  const eligibleStudents = includeArrearStudents
    ? fromClassStudents
    : fromClassStudents.filter(s => !fromClassArrearIds.has(s.id));

  const fromClassInfo = classSummaries.find(c => c.cls.id === selectedFromClass);

  const handlePromote = async () => {
    if (!selectedFromClass || !selectedToClassId || eligibleStudents.length === 0) return;
    setPromoting(true);
    try {
      const result = await promoteStudents({
        fromClassId: selectedFromClass,
        toClassId: Number(selectedToClassId),
        studentIds: eligibleStudents.map(s => s.id),
      });
      toast({
        title: `${result.promoted} students promoted!`,
        description: `${result.fromClass} → ${result.toClass}${result.feeUpdated ? ` · Fee updated to PKR ${result.newFeeAmount?.toLocaleString()}` : ""}`,
      });
      setPromoteDialogOpen(false);
      setSelectedFromClass(null);
      setSelectedToClassId("");
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Promotion failed", description: String((e as Error).message) });
    } finally {
      setPromoting(false);
    }
  };

  const handleFixLogins = async () => {
    setFixingLogins(true);
    try {
      const result = await fixStaffLogins();
      toast({ title: "Staff logins fixed", description: result.message });
    } catch {
      toast({ variant: "destructive", title: "Failed to fix logins" });
    } finally {
      setFixingLogins(false);
    }
  };

  // ── Print portal ──────────────────────────────────────────────────────────────
  const thO = { padding: "7px 10px", background: "#fed7aa", color: "#7c2d12", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #fb923c" };
  const thI = { padding: "6px 8px", background: "#fef3c7", color: "#78350f", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #fcd34d" };
  const td  = { padding: "6px 8px", border: "1px solid #e5e7eb", fontSize: 9, color: "#1f2937", background: "#ffffff" };
  void thO;

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
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#c2410c" }}>Fee Arrears Report</h2>
      </div>
      {arrears.length === 0 ? (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>No arrears found</div>
      ) : arrears.map((s, si) => (
        <div key={s.studentId} style={{ marginBottom: 18, border: "2px solid #e07b1a", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ background: "#fff7ed", padding: "8px 12px", display: "flex", justifyContent: "space-between", borderBottom: "1px solid #fed7aa" }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: 11, color: "#7c2d12" }}>{si + 1}. {s.studentName}</span>
              <span style={{ marginLeft: 10, fontSize: 9, color: "#92400e" }}>{s.admissionNumber}</span>
              <span style={{ marginLeft: 8, fontSize: 9, color: "#6b7280" }}>{s.className}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 8, color: "#6b7280" }}>Total Arrears</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: "#b91c1c" }}>PKR {s.totalArrears.toLocaleString()}</p>
            </div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr>{["Month","Fee","Remaining","Fine","Total Due"].map(h => <th key={h} style={thI}>{h}</th>)}</tr></thead>
            <tbody>
              {s.months.map(m => (
                <tr key={m.month}>
                  <td style={td}>{m.month}</td>
                  <td style={td}>PKR {m.amount.toLocaleString()}</td>
                  <td style={{ ...td, color: "#b91c1c" }}>PKR {m.remaining.toLocaleString()}</td>
                  <td style={{ ...td, color: "#c2410c" }}>{m.fine > 0 ? `PKR ${m.fine.toLocaleString()}` : "—"}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#7f1d1d" }}>PKR {(m.remaining + m.fine).toLocaleString()}</td>
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

  // ── Render ────────────────────────────────────────────────────────────────────
  const isLoading = feesLoading || studentsLoading || classesLoading;

  return (
    <>
      {printPortal}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between no-print">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-orange-600" />
              Arrears &amp; Promotion
            </h1>
            <p className="text-gray-500 text-sm mt-1">Manage fee arrears and promote students to next class</p>
          </div>
          {activeTab === "arrears" && (
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Print
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit no-print">
          {([
            { key: "arrears",   label: "Fee Arrears",       icon: AlertTriangle },
            { key: "promotion", label: "Student Promotion",  icon: GraduationCap },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all",
                activeTab === tab.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── TAB: FEE ARREARS ───────────────────────────────────────────────── */}
        {activeTab === "arrears" && (
          isLoading ? (
            <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>
          ) : arrears.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-gray-500 font-medium">No arrears found</p>
                <p className="text-gray-400 text-sm mt-1">All fees are up to date</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <span className="text-sm text-red-700 font-medium">
                  {arrears.length} students have overdue fees — Total Arrears: PKR {grandTotal.toLocaleString()}
                </span>
              </div>
              <div className="space-y-4">
                {arrears.map(s => (
                  <Card key={s.studentId} className="overflow-hidden border-l-4" style={{ borderLeftColor: "#e07b1a" }}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-900 text-base">{s.studentName}</h3>
                          <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                            <span className="font-mono text-purple-600">{s.admissionNumber}</span>
                            <span>{s.className}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Total Arrears</p>
                          <p className="text-xl font-bold text-red-600">PKR {s.totalArrears.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-xs text-gray-500 border-b">
                              <th className="text-left py-1.5 pr-4">Month</th>
                              <th className="text-right pr-4">Fee</th>
                              <th className="text-right pr-4">Remaining</th>
                              <th className="text-right pr-4">Fine</th>
                              <th className="text-right">Total Due</th>
                            </tr>
                          </thead>
                          <tbody>
                            {s.months.map(m => (
                              <tr key={m.month} className="border-b last:border-0">
                                <td className="py-1.5 pr-4 font-medium text-gray-700">{m.month}</td>
                                <td className="py-1.5 pr-4 text-right text-gray-600">PKR {m.amount.toLocaleString()}</td>
                                <td className="py-1.5 pr-4 text-right text-red-600">PKR {m.remaining.toLocaleString()}</td>
                                <td className="py-1.5 pr-4 text-right text-orange-600">{m.fine > 0 ? `PKR ${m.fine.toLocaleString()}` : "—"}</td>
                                <td className="py-1.5 text-right font-semibold text-red-700">PKR {(m.remaining + m.fine).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="border-t pt-4 flex justify-end">
                <div className="bg-red-50 border border-red-200 rounded-xl px-6 py-3 text-right">
                  <p className="text-sm text-gray-500">Grand Total Arrears</p>
                  <p className="text-2xl font-bold text-red-700">PKR {grandTotal.toLocaleString()}</p>
                </div>
              </div>
            </>
          )
        )}

        {/* ── TAB: STUDENT PROMOTION ─────────────────────────────────────────── */}
        {activeTab === "promotion" && (
          <div className="space-y-5">
            {/* Info banner */}
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-indigo-800">Annual Student Promotion</p>
                <p className="text-xs text-indigo-600 mt-0.5">
                  Select a class below to promote students to the next class. Fee amounts will automatically update based on the fee structure of the target class.
                </p>
              </div>
            </div>

            {/* Fix staff logins button */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-amber-800">Staff Login Issue?</p>
                  <p className="text-xs text-amber-600">Click to create missing login accounts for all staff members (password: kips123)</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 text-amber-700 hover:bg-amber-100 shrink-0"
                onClick={handleFixLogins}
                disabled={fixingLogins}
              >
                {fixingLogins ? "Fixing..." : "Fix Staff Logins"}
              </Button>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
              </div>
            ) : classSummaries.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No classes with students found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {classSummaries.map(({ cls, idx, totalStudents, arrearStudents, clearStudents }) => {
                  const g = getGradient(idx);
                  return (
                    <div
                      key={cls.id}
                      className="rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow border"
                      style={{ borderColor: g.border, background: g.light }}
                    >
                      {/* Header strip */}
                      <div
                        className="px-5 py-4 text-white"
                        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-widest opacity-80">Class</p>
                            <h3 className="text-xl font-extrabold leading-tight mt-0.5">{cls.name}</h3>
                            {cls.grade && cls.grade !== cls.name && (
                              <p className="text-xs opacity-70 mt-0.5">{cls.grade}</p>
                            )}
                          </div>
                          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                            <GraduationCap className="w-6 h-6 text-white" />
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="px-5 py-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" style={{ color: g.from }} />
                            <span className="text-sm font-medium" style={{ color: g.text }}>Total Students</span>
                          </div>
                          <Badge style={{ background: g.from, color: "#fff", border: "none" }}>{totalStudents}</Badge>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                            <span className="text-sm font-medium text-green-700">Fee Clear</span>
                          </div>
                          <Badge className="bg-green-100 text-green-700 border-green-200">{clearStudents}</Badge>
                        </div>

                        {arrearStudents > 0 && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <XCircle className="w-4 h-4 text-red-500" />
                              <span className="text-sm font-medium text-red-700">With Arrears</span>
                            </div>
                            <Badge className="bg-red-100 text-red-700 border-red-200">{arrearStudents}</Badge>
                          </div>
                        )}
                      </div>

                      {/* Promote button */}
                      <div className="px-5 pb-5">
                        <button
                          onClick={() => {
                            setSelectedFromClass(cls.id);
                            setSelectedToClassId("");
                            setIncludeArrearStudents(false);
                            setPromoteDialogOpen(true);
                          }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm text-white transition-opacity hover:opacity-90"
                          style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                        >
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

      {/* ── Promotion Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={promoteDialogOpen} onOpenChange={setPromoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <GraduationCap className="w-5 h-5 text-indigo-600" />
              Promote Students
            </DialogTitle>
            <DialogDescription>
              Move students from <strong>{fromClassInfo?.cls.name}</strong> to the selected next class.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* From → To */}
            <div className="flex items-center gap-3">
              <div className="flex-1 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-center">
                <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wide">From</p>
                <p className="text-base font-bold text-indigo-800 mt-0.5">{fromClassInfo?.cls.name ?? "—"}</p>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
              <div className="flex-1">
                <Select value={selectedToClassId} onValueChange={setSelectedToClassId}>
                  <SelectTrigger className="rounded-lg">
                    <SelectValue placeholder="Select target class" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes ?? [])
                      .filter(c => c.id !== selectedFromClass)
                      .map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Arrear students toggle */}
            <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
              <div>
                <Label htmlFor="arrear-toggle" className="text-sm font-semibold text-gray-800 cursor-pointer">
                  Include students with arrears
                </Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  {fromClassInfo
                    ? includeArrearStudents
                      ? `All ${fromClassInfo.totalStudents} students will be promoted`
                      : `${fromClassInfo.clearStudents} clear + ${fromClassInfo.arrearStudents} arrear students held back`
                    : ""}
                </p>
              </div>
              <Switch
                id="arrear-toggle"
                checked={includeArrearStudents}
                onCheckedChange={setIncludeArrearStudents}
              />
            </div>

            {/* Summary */}
            {selectedToClassId && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 space-y-1.5">
                <p className="text-sm font-semibold text-green-800">Promotion Summary</p>
                <div className="text-xs text-green-700 space-y-1">
                  <div className="flex justify-between">
                    <span>Students to promote:</span>
                    <span className="font-bold">{eligibleStudents.length}</span>
                  </div>
                  {!includeArrearStudents && (fromClassInfo?.arrearStudents ?? 0) > 0 && (
                    <div className="flex justify-between text-orange-600">
                      <span>Held back (arrears):</span>
                      <span className="font-bold">{fromClassInfo?.arrearStudents}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-gray-500">
                    <span>Fee will auto-update:</span>
                    <span className="font-bold">Yes (from target class fee structure)</span>
                  </div>
                </div>
              </div>
            )}

            {eligibleStudents.length === 0 && selectedToClassId && (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-700">
                No eligible students to promote. Enable "Include students with arrears" or check the class.
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPromoteDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handlePromote}
              disabled={!selectedToClassId || eligibleStudents.length === 0 || promoting}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {promoting ? "Promoting..." : `Promote ${eligibleStudents.length} Students`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
