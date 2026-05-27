import { useState, useEffect, useCallback } from "react";
import { useListClasses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen,
  DollarSign,
  GraduationCap,
  FlaskConical,
  CalendarDays,
  Bus,
  Pencil,
  Save,
  LayoutList,
  Printer,
  CheckCircle2,
  Trash2,
} from "lucide-react";

// ─── Theme ───────────────────────────────────────────────────────────────────
const NAVY   = "#1a2a5e";
const ORANGE = "#e07b1a";

// ─── Fee Types ────────────────────────────────────────────────────────────────
const FEE_TYPES = [
  { key: "monthly",   label: "Monthly Fee",    icon: CalendarDays,  light: "bg-blue-50",   text: "text-blue-600"   },
  { key: "admission", label: "Admission Fee",  icon: GraduationCap, light: "bg-purple-50", text: "text-purple-600" },
  { key: "exam",      label: "Exam Fee",       icon: FlaskConical,  light: "bg-orange-50", text: "text-orange-600" },
  { key: "annual",    label: "Annual Charges", icon: BookOpen,      light: "bg-green-50",  text: "text-green-600"  },
  { key: "transport", label: "Transport Fee",  icon: Bus,           light: "bg-rose-50",   text: "text-rose-600"   },
  { key: "Arrears",    label:"Previous Arrears", icon: BookOpen,      light: "bg-green-50",  text: "text-green-600"  },
] as const;

type FeeKey = typeof FEE_TYPES[number]["key"];

interface FeeRow {
  id?: number;
  classId: number;
  monthly:   number;
  admission: number;
  exam:      number;
  annual:    number;
  transport: number;
  Arrears: number;
}
type FeesMap = Record<number, FeeRow>;

// ─── Auth helpers ─────────────────────────────────────────────────────────────
function getToken(): string {
  return localStorage.getItem("token") ?? localStorage.getItem("kips_token") ?? "";
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function getUserRole(): string {
  try {
    const token = getToken();
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]!));
    return payload.role ?? "";
  } catch {
    return "";
  }
}

// ─── Field mapping: frontend ↔ backend ───────────────────────────────────────
function toBackend(fees: Omit<FeeRow, "id">) {
  return {
    classId:      fees.classId,
    monthlyFee:   fees.monthly,
    admissionFee: fees.admission,
    examFee:      fees.exam,
    libraryFee:   fees.annual,
    transportFee: fees.transport,
  };
}

function fromBackend(row: Record<string, unknown>): FeeRow {
  return {
    id:        Number(row.id),
    classId:   Number(row.classId),
    monthly:   Number(row.monthlyFee   ?? 0),
    admission: Number(row.admissionFee ?? 0),
    exam:      Number(row.examFee      ?? 0),
    annual:    Number(row.libraryFee   ?? 0),
    transport: Number(row.transportFee ?? 0),
  };
}

// ─── Edit/Add Dialog ──────────────────────────────────────────────────────────
function EditDialog({
  open,
  className,
  grade,
  initial,
  onClose,
  onSave,
}: {
  open:      boolean;
  className: string;
  grade:     string;
  initial:   Partial<Record<FeeKey, number>>;
  onClose:   () => void;
  onSave:    (fees: Partial<Record<FeeKey, number>>) => Promise<void>;
}) {
  const [draft,  setDraft]  = useState<Partial<Record<FeeKey, string>>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const init: Partial<Record<FeeKey, string>> = {};
      FEE_TYPES.forEach(ft => {
        init[ft.key] = initial[ft.key] ? String(initial[ft.key]) : "";
      });
      setDraft(init);
    }
  }, [open]);

  const handleSave = async () => {
    const out: Partial<Record<FeeKey, number>> = {};
    FEE_TYPES.forEach(ft => {
      const v = Number(draft[ft.key] ?? 0);
      out[ft.key] = v > 0 ? v : 0;
    });
    setSaving(true);
    await onSave(out);
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center shadow"
              style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}
            >
              <LayoutList className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold" style={{ color: NAVY }}>{className}</p>
              <p className="text-xs font-normal text-gray-400">{grade} — Fee Structure</p>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {FEE_TYPES.map(ft => {
            const Icon = ft.icon;
            return (
              <div key={ft.key} className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${ft.light}`}>
                  <Icon className={`w-4 h-4 ${ft.text}`} />
                </div>
                <span className="text-sm font-medium text-gray-700 w-36 flex-shrink-0">
                  {ft.label}
                </span>
                <div className="relative flex-1">
                  <span className="absolute left-3 top-2.5 text-xs text-gray-400 font-semibold">PKR</span>
                  <Input
                    type="number"
                    min={0}
                    className="pl-12 text-right font-bold"
                    placeholder="0"
                    value={draft[ft.key] ?? ""}
                    onChange={e => setDraft(p => ({ ...p, [ft.key]: e.target.value }))}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}
            className="text-white hover:opacity-90"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm Dialog ────────────────────────────────────────────────────
function DeleteDialog({
  open,
  className,
  onClose,
  onConfirm,
}: {
  open:      boolean;
  className: string;
  onClose:   () => void;
  onConfirm: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle style={{ color: "#dc2626" }}>Fee Structure Delete Karein?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-gray-600 py-2">
          <strong>{className}</strong> ki fee structure database se hata di jayegi.
        </p>
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={deleting}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={async () => { setDeleting(true); await onConfirm(); setDeleting(false); }}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FeeStructure() {
  const { toast } = useToast();
  const { data: classes, isLoading: classesLoading } = useListClasses();

  const [feesMap,       setFeesMap]       = useState<FeesMap>({});
  const [loadingFees,   setLoadingFees]   = useState(true);

  const [editClassId,   setEditClassId]   = useState<number | null>(null);
  const [editClassName, setEditClassName] = useState("");
  const [editGrade,     setEditGrade]     = useState("");
  const [editOpen,      setEditOpen]      = useState(false);

  const [deleteClassId,   setDeleteClassId]   = useState<number | null>(null);
  const [deleteClassName, setDeleteClassName] = useState("");
  const [deleteOpen,      setDeleteOpen]      = useState(false);

  const isAdmin = getUserRole() === "admin";

  // ── Database se load ─────────────────────────────────────────────────────
  const loadFromDb = useCallback(async () => {
    try {
      setLoadingFees(true);
      const res = await fetch("/api/fee-structures", { headers: authHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows: Record<string, unknown>[] = await res.json();
      const map: FeesMap = {};
      for (const row of rows) {
        const parsed = fromBackend(row);
        map[parsed.classId] = parsed;
      }
      setFeesMap(map);
    } catch (err) {
      console.error("Fee load error:", err);
      toast({ title: "Load error", description: "Fee structures load nahi hue.", variant: "destructive" });
    } finally {
      setLoadingFees(false);
    }
  }, []);

  useEffect(() => { loadFromDb(); }, [loadFromDb]);

  // ── Edit open ────────────────────────────────────────────────────────────
  const handleEdit = (classId: number, className: string, grade: string) => {
    setEditClassId(classId);
    setEditClassName(className);
    setEditGrade(grade);
    setEditOpen(true);
  };

  // ── Save (add or update) ─────────────────────────────────────────────────
  const handleSave = async (fees: Partial<Record<FeeKey, number>>) => {
    if (!editClassId) return;
    try {
      const body = toBackend({
        classId:   editClassId,
        monthly:   fees.monthly   ?? 0,
        admission: fees.admission ?? 0,
        exam:      fees.exam      ?? 0,
        annual:    fees.annual    ?? 0,
        transport: fees.transport ?? 0,
      });
      const res = await fetch("/api/fee-structures", {
        method:  "POST",
        headers: authHeaders(),
        body:    JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error ?? `HTTP ${res.status}`);
      }
      const saved: Record<string, unknown> = await res.json();
      setFeesMap(prev => ({ ...prev, [editClassId]: fromBackend(saved) }));
      toast({ title: "Saved!", description: `${editClassName} ki fees database mein save ho gayin.` });
      setEditOpen(false);
      setEditClassId(null);
    } catch (err) {
      toast({ title: "Save failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDeleteOpen = (classId: number, className: string) => {
    setDeleteClassId(classId);
    setDeleteClassName(className);
    setDeleteOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteClassId) return;
    const existing = feesMap[deleteClassId];
    if (!existing?.id) {
      // No DB record yet — just clear local state
      setFeesMap(prev => { const n = { ...prev }; delete n[deleteClassId]; return n; });
      setDeleteOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/fee-structures/${existing.id}`, {
        method:  "DELETE",
        headers: authHeaders(),
      });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      setFeesMap(prev => { const n = { ...prev }; delete n[deleteClassId]; return n; });
      toast({ title: "Deleted", description: `${deleteClassName} ki fee structure hata di gayi.` });
    } catch (err) {
      toast({ title: "Delete failed", description: err instanceof Error ? err.message : "Error", variant: "destructive" });
    } finally {
      setDeleteOpen(false);
      setDeleteClassId(null);
    }
  };

  const isLoading       = classesLoading || loadingFees;
  const configuredCount = Object.values(feesMap).filter(f => f.monthly > 0).length;
  const avgMonthly      = (() => {
    const vals = Object.values(feesMap).map(f => f.monthly).filter(v => v > 0);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  })();

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}
          >
            <LayoutList className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: NAVY }}>Fee Structure</h1>
            <p className="text-gray-500 text-sm">Har class ki monthly fees yahan set karein</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="no-print">
          <Printer className="w-4 h-4 mr-2" /> Print
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Classes", value: classes?.length ?? 0,                                    bg: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` },
          { label: "Configured",    value: `${configuredCount}/${classes?.length ?? 0}`,            bg: "linear-gradient(135deg,#10b981,#059669)"   },
          { label: "Avg Monthly",   value: avgMonthly ? `PKR ${avgMonthly.toLocaleString()}` : "—", bg: `linear-gradient(135deg,${ORANGE},#c96a10)` },
          { label: "Fee Types",     value: FEE_TYPES.length,                                        bg: "linear-gradient(135deg,#8b5cf6,#6d28d9)"   },
        ].map(c => (
          <Card key={c.label} className="border-0 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4" style={{ background: c.bg }}>
                <p className="text-white/75 text-xs font-semibold uppercase tracking-wide">{c.label}</p>
                <p className="text-white text-xl font-bold mt-1">{c.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Fee Types Legend */}
      <div className="flex flex-wrap gap-2">
        {FEE_TYPES.map(ft => {
          const Icon = ft.icon;
          return (
            <div key={ft.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${ft.light}`}>
              <Icon className={`w-3.5 h-3.5 ${ft.text}`} />
              <span className={`text-xs font-semibold ${ft.text}`}>{ft.label}</span>
            </div>
          );
        })}
      </div>

      {/* Table */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: NAVY }}>
            <DollarSign className="w-4 h-4" style={{ color: ORANGE }} />
            Class-wise Fee Structure (Monthly)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: "#f8faff" }} className="border-b">
                    <th className="text-left py-3 px-4 font-semibold" style={{ color: NAVY }}>Class</th>
                    {FEE_TYPES.map(ft => {
                      const Icon = ft.icon;
                      return (
                        <th key={ft.key} className="text-right py-3 px-3 font-semibold" style={{ color: NAVY }}>
                          <span className="flex items-center justify-end gap-1">
                            <Icon className={`w-3.5 h-3.5 ${ft.text}`} />
                            <span className="hidden lg:inline">{ft.label}</span>
                            <span className="lg:hidden">{ft.label.split(" ")[0]}</span>
                          </span>
                        </th>
                      );
                    })}
                    {isAdmin && <th className="py-3 px-4 text-center font-semibold" style={{ color: NAVY }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {(classes ?? []).map((cls, idx) => {
                    const fees       = feesMap[cls.id];
                    const configured = fees && fees.monthly > 0;

                    return (
                      <tr
                        key={cls.id}
                        className="border-b hover:bg-indigo-50/30 transition-colors"
                        style={{ background: idx % 2 === 0 ? "#fff" : "#fafbff" }}
                      >
                        {/* Class name */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm flex-shrink-0"
                              style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}
                            >
                              <BookOpen className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900">{cls.name}</p>
                              <p className="text-xs text-gray-400">{cls.grade}</p>
                            </div>
                            {configured && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-1 flex-shrink-0" />
                            )}
                          </div>
                        </td>

                        {/* Fee columns — per month values */}
                        {FEE_TYPES.map(ft => (
                          <td key={ft.key} className="py-3 px-3 text-right">
                            {fees && (fees[ft.key as FeeKey] ?? 0) > 0 ? (
                              <span className="font-semibold text-gray-800">
                                {Number(fees[ft.key as FeeKey]).toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        ))}

                        {/* Admin actions */}
                        {isAdmin && (
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs font-semibold"
                                style={{ borderColor: NAVY + "33", color: NAVY }}
                                onClick={() => handleEdit(cls.id, cls.name, cls.grade ?? "")}
                              >
                                <Pencil className="w-3 h-3 mr-1" />
                                {configured ? "Edit" : "Add"}
                              </Button>
                              {configured && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-semibold border-red-200 text-red-600 hover:bg-red-50"
                                  onClick={() => handleDeleteOpen(cls.id, cls.name)}
                                >
                                  <Trash2 className="w-3 h-3 mr-1" />
                                  Delete
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      {editClassId !== null && (
        <EditDialog
          open={editOpen}
          className={editClassName}
          grade={editGrade}
          initial={feesMap[editClassId] ?? {}}
          onClose={() => { setEditOpen(false); setEditClassId(null); }}
          onSave={handleSave}
        />
      )}

      {/* Delete Dialog */}
      <DeleteDialog
        open={deleteOpen}
        className={deleteClassName}
        onClose={() => { setDeleteOpen(false); setDeleteClassId(null); }}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
