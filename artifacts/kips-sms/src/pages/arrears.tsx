import { useState, useEffect, useCallback } from "react";
import { useListClasses } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, Users, DollarSign, TrendingDown,
  Plus, Pencil, Trash2, X, ChevronDown, ChevronUp,
  Search, CalendarDays, ReceiptText,
} from "lucide-react";

const NAVY   = "#1a2a5e";
const ORANGE = "#e07b1a";

interface ArrearRecord {
  id:              number;
  studentId:       number;
  studentName:     string | null;
  admissionNumber: string | null;
  fatherName:      string | null;
  classId:         number | null;
  className:       string | null;
  month:           string;
  dueDate:         string;
  amount:          number;
  fine:            number;
  paidAmount:      number;
  remainingAmount: number;
  status:          string;
  notes:           string | null;
}

interface Student {
  id:              number;
  name:            string;
  admissionNumber: string;
  classId:         number | null;
  fatherName:      string | null;
  status:          string;
}

function getToken(): string {
  return localStorage.getItem("token") ?? localStorage.getItem("kips_token") ?? "";
}
function authH(): Record<string, string> {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}
function getUserRole(): string {
  try {
    const t = getToken();
    if (!t) return "";
    const p = JSON.parse(atob(t.split(".")[1]!));
    return p.role ?? "";
  } catch { return ""; }
}

function statusBadge(status: string, remaining: number) {
  if (status === "paid" || remaining === 0)
    return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">Paid</Badge>;
  if (status === "partial")
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200">Partial</Badge>;
  return <Badge className="bg-red-100 text-red-700 border-red-200">Unpaid</Badge>;
}

// ── Add/Edit Dialog ────────────────────────────────────────────────────────────
function ArrearDialog({
  open, title, students, classes,
  initial, onClose, onSave,
}: {
  open:     boolean;
  title:    string;
  students: Student[];
  classes:  { id: number; name: string }[];
  initial?: Partial<ArrearRecord>;
  onClose:  () => void;
  onSave:   (data: Partial<ArrearRecord>) => Promise<void>;
}) {
  const [draft,  setDraft]  = useState<Partial<ArrearRecord>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(initial
        ? {
            studentId: initial.studentId,
            amount:    initial.amount    ?? 0,
            fine:      initial.fine      ?? 0,
            month:     initial.month     ?? "",
            dueDate:   initial.dueDate   ?? "",
            notes:     initial.notes     ?? "",
          }
        : {
            amount:  0,
            fine:    0,
            month:   new Date().toISOString().slice(0, 7),
            dueDate: (() => { const d = new Date(); d.setDate(10); return d.toISOString().slice(0, 10); })(),
          }
      );
    }
  }, [open]);

  const filteredStudents = draft.classId
    ? students.filter(s => String(s.classId) === String(draft.classId))
    : students;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2" style={{ color: NAVY }}>
            <AlertTriangle className="w-5 h-5" style={{ color: ORANGE }} />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Filter by Class (optional)</label>
            <Select
              value={draft.classId ? String(draft.classId) : "all"}
              onValueChange={v => setDraft(d => ({
                ...d,
                classId:   v === "all" ? undefined : Number(v),
                studentId: undefined,
              }))}>
              <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All classes</SelectItem>
                {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Student *</label>
            <Select
              value={draft.studentId ? String(draft.studentId) : ""}
              onValueChange={v => setDraft(d => ({ ...d, studentId: Number(v) }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select student..." />
              </SelectTrigger>
              <SelectContent>
                {filteredStudents.filter(s => s.status === "active").map(s => (
                  <SelectItem key={s.id} value={String(s.id)}>
                    {s.name} ({s.admissionNumber})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Month *</label>
              <Input type="month" value={draft.month ?? ""}
                onChange={e => setDraft(d => ({ ...d, month: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Due Date *</label>
              <Input type="date" value={draft.dueDate ?? ""}
                onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Amount (PKR) *</label>
              <Input type="number" min="0" value={draft.amount ?? ""}
                onChange={e => setDraft(d => ({ ...d, amount: Number(e.target.value) }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Fine (PKR)</label>
              <Input type="number" min="0" value={draft.fine ?? ""}
                onChange={e => setDraft(d => ({ ...d, fine: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1.5">Notes</label>
            <Input placeholder="e.g. 2 months outstanding" value={draft.notes ?? ""}
              onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            disabled={saving || !draft.studentId || !draft.amount || !draft.month || !draft.dueDate}
            onClick={async () => { setSaving(true); await onSave(draft); setSaving(false); }}
            style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}
            className="text-white">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Arrears() {
  const { toast } = useToast();
  const { data: classes } = useListClasses();

  const [records,        setRecords]        = useState<ArrearRecord[]>([]);
  const [students,       setStudents]       = useState<Student[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [search,         setSearch]         = useState("");
  const [filterClass,    setFilterClass]    = useState("all");
  const [filterStatus,   setFilterStatus]   = useState("all");
  const [expandedId,     setExpandedId]     = useState<number | null>(null);
  const [addOpen,        setAddOpen]        = useState(false);
  const [editRecord,     setEditRecord]     = useState<ArrearRecord | null>(null);
  const [deleteId,       setDeleteId]       = useState<number | null>(null);
  const [deleteStudName, setDeleteStudName] = useState("");

  const isAdmin = getUserRole() === "admin";

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [arrRes, studRes] = await Promise.all([
        fetch("/api/arrears", { headers: authH() }),
        fetch("/api/students", { headers: authH() }),
      ]);
      const arrData: Record<string, unknown>[] = arrRes.ok ? await arrRes.json() : [];
      const studData: Record<string, unknown>[] = studRes.ok ? await studRes.json() : [];

      setRecords(arrData.map(r => ({
        id:              Number(r.id),
        studentId:       Number(r.studentId),
        studentName:     (r.studentName as string | null) ?? null,
        admissionNumber: (r.admissionNumber as string | null) ?? null,
        fatherName:      (r.fatherName as string | null) ?? null,
        classId:         r.classId != null ? Number(r.classId) : null,
        className:       (r.className as string | null) ?? null,
        month:           String(r.month   ?? ""),
        dueDate:         String(r.dueDate ?? ""),
        amount:          Number(r.amount          ?? 0),
        fine:            Number(r.fine            ?? 0),
        paidAmount:      Number(r.paidAmount      ?? 0),
        remainingAmount: Number(r.remainingAmount ?? 0),
        status:          String(r.status ?? "unpaid"),
        notes:           (r.notes as string | null) ?? null,
      })));

      setStudents(studData.map(s => ({
        id:              Number(s.id),
        name:            String(s.name ?? ""),
        admissionNumber: String(s.admissionNumber ?? ""),
        classId:         s.classId != null ? Number(s.classId) : null,
        fatherName:      (s.fatherName as string | null) ?? null,
        status:          String(s.status ?? "active"),
      })));
    } catch (err) {
      console.error(err);
      toast({ title: "Load error", description: "Could not load arrear records.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtered list ────────────────────────────────────────────────────────────
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    if (q && !(
      (r.studentName?.toLowerCase().includes(q)) ||
      (r.admissionNumber?.toLowerCase().includes(q)) ||
      (r.className?.toLowerCase().includes(q))
    )) return false;
    if (filterClass !== "all" && String(r.classId) !== filterClass) return false;
    if (filterStatus !== "all") {
      if (filterStatus === "unpaid"  && r.status !== "unpaid")  return false;
      if (filterStatus === "partial" && r.status !== "partial") return false;
    }
    return true;
  });

  // ── Stats ────────────────────────────────────────────────────────────────────
  const totalOutstanding = records.reduce((s, r) => s + r.remainingAmount, 0);
  const uniqueStudents   = new Set(records.map(r => r.studentId)).size;
  const partialCount     = records.filter(r => r.status === "partial").length;

  // ── Save / Delete ────────────────────────────────────────────────────────────
  const handleSaveAdd = async (data: Partial<ArrearRecord>) => {
    try {
      const res = await fetch("/api/arrears", {
        method:  "POST",
        headers: authH(),
        body:    JSON.stringify({
          studentId: data.studentId,
          amount:    data.amount ?? 0,
          fine:      data.fine   ?? 0,
          month:     data.month,
          dueDate:   data.dueDate,
          notes:     data.notes ?? null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Arrear added" });
      setAddOpen(false);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const handleSaveEdit = async (data: Partial<ArrearRecord>) => {
    if (!editRecord) return;
    try {
      const res = await fetch(`/api/arrears/${editRecord.id}`, {
        method:  "PUT",
        headers: authH(),
        body:    JSON.stringify({
          amount:  data.amount,
          fine:    data.fine,
          month:   data.month,
          dueDate: data.dueDate,
          notes:   data.notes,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Arrear updated" });
      setEditRecord(null);
      loadData();
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/arrears/${deleteId}`, { method: "DELETE", headers: authH() });
      if (!res.ok && res.status !== 204) throw new Error(`HTTP ${res.status}`);
      toast({ title: "Arrear removed" });
      setDeleteId(null);
    } catch (err) {
      toast({ title: "Error", description: String(err), variant: "destructive" });
    } finally {
      loadData();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Arrears</h1>
            <p className="text-sm text-gray-500">Overdue and outstanding fee records</p>
          </div>
        </div>
        {isAdmin && (
          <Button onClick={() => setAddOpen(true)}
            style={{ background: `linear-gradient(135deg, ${NAVY}, #2d4a9e)` }}
            className="text-white">
            <Plus className="w-4 h-4 mr-2" /> Add Arrear
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Arrear Records", value: records.length,                                              icon: ReceiptText,  bg: "linear-gradient(135deg,#dc2626,#b91c1c)"  },
          { label: "Students Affected",    value: uniqueStudents,                                              icon: Users,        bg: `linear-gradient(135deg,${ORANGE},#c96a10)` },
          { label: "Outstanding Amount",   value: `PKR ${totalOutstanding.toLocaleString()}`,                  icon: DollarSign,   bg: `linear-gradient(135deg,${NAVY},#2d4a9e)`  },
          { label: "Partial Payments",     value: `${partialCount} record${partialCount !== 1 ? "s" : ""}`,   icon: TrendingDown, bg: "linear-gradient(135deg,#7c3aed,#5b21b6)"  },
        ].map(c => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="border-0 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="p-4 flex items-start justify-between" style={{ background: c.bg }}>
                  <div>
                    <p className="text-white/70 text-xs font-semibold uppercase tracking-wide">{c.label}</p>
                    <p className="text-white text-lg font-bold mt-1">{c.value}</p>
                  </div>
                  <Icon className="w-6 h-6 text-white/40" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-48 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search student name, admission no., class..." value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            {(search || filterClass !== "all" || filterStatus !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFilterClass("all"); setFilterStatus("all"); }}>
                <X className="w-4 h-4 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Records List */}
      <Card>
        <CardHeader className="pb-2 border-b">
          <CardTitle className="text-base flex items-center gap-2" style={{ color: NAVY }}>
            <AlertTriangle className="w-4 h-4 text-red-600" />
            Arrear Records ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              {[1,2,3,4].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-200" />
              <p className="font-medium">No arrear records found</p>
              {records.length > 0 && <p className="text-sm mt-1">Try adjusting your filters</p>}
              {records.length === 0 && <p className="text-sm mt-1 text-emerald-600">All fees are up to date!</p>}
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map(record => (
                <div key={record.id} className="p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-sm shadow"
                        style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)" }}>
                        {(record.studentName ?? "?").charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">{record.studentName ?? "Unknown student"}</p>
                        <p className="text-xs text-gray-500">
                          {record.admissionNumber ?? "—"} · {record.className ?? "No class"}
                          {record.fatherName ? ` · s/o ${record.fatherName}` : ""}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {statusBadge(record.status, record.remainingAmount)}
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <CalendarDays className="w-3 h-3" />
                            {record.month} · Due: {record.dueDate}
                          </span>
                          {record.notes && (
                            <span className="text-xs text-amber-600 italic">"{record.notes}"</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="font-black text-lg text-red-600">PKR {record.remainingAmount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">Total: {record.amount.toLocaleString()}</p>
                      {record.fine > 0 && <p className="text-xs text-red-500">Fine: +{record.fine.toLocaleString()}</p>}
                      {record.paidAmount > 0 && <p className="text-xs text-emerald-600">Paid: {record.paidAmount.toLocaleString()}</p>}
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600"
                        onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}>
                        {expandedId === record.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </Button>
                      {isAdmin && (
                        <>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-blue-600"
                            onClick={() => setEditRecord(record)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-red-600"
                            onClick={() => { setDeleteId(record.id); setDeleteStudName(record.studentName ?? ""); }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Expanded breakdown */}
                  {expandedId === record.id && (
                    <div className="mt-3 ml-12 p-3 rounded-lg bg-gray-50 border border-gray-200 text-xs space-y-1.5">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                          { label: "Original Amount", value: `PKR ${record.amount.toLocaleString()}`,        color: "" },
                          { label: "Fine",            value: `PKR ${record.fine.toLocaleString()}`,          color: record.fine > 0 ? "text-red-600" : "" },
                          { label: "Paid So Far",     value: `PKR ${record.paidAmount.toLocaleString()}`,    color: record.paidAmount > 0 ? "text-emerald-600" : "" },
                          { label: "Still Owed",      value: `PKR ${record.remainingAmount.toLocaleString()}`, color: "text-red-700 font-bold" },
                        ].map(f => (
                          <div key={f.label}>
                            <p className="text-gray-400 uppercase tracking-wide" style={{ fontSize: 9 }}>{f.label}</p>
                            <p className={`font-semibold mt-0.5 ${f.color}`}>{f.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <ArrearDialog open={addOpen} title="Add Arrear Record"
        students={students} classes={classes ?? []}
        onClose={() => setAddOpen(false)} onSave={handleSaveAdd} />

      {/* Edit Dialog */}
      {editRecord && (
        <ArrearDialog open={!!editRecord} title="Edit Arrear Record"
          students={students} classes={classes ?? []}
          initial={editRecord}
          onClose={() => setEditRecord(null)} onSave={handleSaveEdit} />
      )}

      {/* Delete Confirm */}
      <Dialog open={!!deleteId} onOpenChange={v => !v && setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Delete Arrear Record?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            This will permanently remove the arrear record for <strong>{deleteStudName}</strong>.
          </p>
          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
