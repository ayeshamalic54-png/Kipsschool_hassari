import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetStudent, useUpdateStudent, useListClasses,
  getGetStudentQueryKey, getListStudentsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Eye, Loader2, Camera, User, Printer, X } from "lucide-react";

function authHeader(): Record<string, string> {
  const t = localStorage.getItem("kips_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

const STATUS_COLORS: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700",
  inactive: "bg-gray-100 text-gray-500",
  left:     "bg-red-100 text-red-600",
};

// Fee category definitions – matched by "notes" field in feesTable
const FEE_CATS = [
  { key: "admissionFee", label: "Admission Fee",  match: /admission/i,  monthPrefix: "Admission" },
  { key: "examFee",      label: "Exam Fee",        match: /exam/i,       monthPrefix: "Exam"      },
  { key: "annualFee",    label: "Annual Fee",      match: /annual/i,     monthPrefix: "Annual"    },
  { key: "transportFee", label: "Transport Fee",   match: /transport/i,  monthPrefix: "Transport" },
  { key: "booksFee",     label: "Books Fee",       match: /books?/i,     monthPrefix: "Books"     },
] as const;

type FeeKey = typeof FEE_CATS[number]["key"];

interface FeeRecord {
  id: number;
  amount: number;
  paidAmount: number;
  month: string;
  notes: string | null;
  status: string;
}

interface IndividualFees {
  admissionFee: string;
  examFee:      string;
  annualFee:    string;
  transportFee: string;
  booksFee:     string;
}

// Map existing fee records → per-category {amount, id}
function mapFeeRecords(rows: FeeRecord[]): { values: IndividualFees; ids: Partial<Record<FeeKey, number>> } {
  const values: IndividualFees = { admissionFee: "", examFee: "", annualFee: "", transportFee: "", booksFee: "" };
  const ids: Partial<Record<FeeKey, number>> = {};
  for (const cat of FEE_CATS) {
    const match = rows.find(r => r.notes && cat.match.test(r.notes));
    if (match) {
      values[cat.key] = String(match.amount);
      ids[cat.key]    = match.id;
    }
  }
  return { values, ids };
}

// ── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}

// ── Info row helper ───────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b last:border-0">
      <span className="text-xs text-gray-400 shrink-0 w-36">{label}</span>
      <span className="text-sm font-medium text-gray-900 text-right break-all">{value || "—"}</span>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function StudentDetail() {
  const [, params]      = useRoute("/students/:id");
  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const qc              = useQueryClient();
  const studentId       = Number(params?.id);
  const fileRef         = useRef<HTMLInputElement>(null);

  const [mode,          setMode]          = useState<"view"|"edit">("view");
  const [photoPreview,  setPhotoPreview]  = useState<string|null>(null);
  const [photoFile,     setPhotoFile]     = useState<File|null>(null);
  const [saving,        setSaving]        = useState(false);

  // Core student fields
  const [f, setF] = useState({
    name:"", fatherName:"", motherName:"", dateOfBirth:"",
    gender:"", address:"", phone:"", emergencyContact:"",
    classId:"", section:"", rollNumber:"", feeAmount:"", status:"active",
  });

  // Individual fee fields + their existing record IDs
  const [fees, setFees]     = useState<IndividualFees>({ admissionFee:"", examFee:"", annualFee:"", transportFee:"", booksFee:"" });
  const [feeIds, setFeeIds] = useState<Partial<Record<FeeKey, number>>>({});
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>([]);

  const { data: student, isLoading } = useGetStudent(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) },
  });
  const { data: classes = [] } = useListClasses();
  const updateMut = useUpdateStudent();

  // Fill form when student loads
  useEffect(() => {
    if (!student) return;
    const s = student as any;
    setF({
      name:             s.name             ?? "",
      fatherName:       s.fatherName       ?? "",
      motherName:       s.motherName       ?? "",
      dateOfBirth:      s.dateOfBirth      ?? "",
      gender:           s.gender           ?? "",
      address:          s.address          ?? "",
      phone:            s.phone            ?? "",
      emergencyContact: s.emergencyContact ?? "",
      classId:          s.classId ? String(s.classId) : "",
      section:          s.section          ?? "",
      rollNumber:       s.rollNumber       ?? "",
      feeAmount:        s.feeAmount ? String(s.feeAmount) : "",
      status:           s.status          ?? "active",
    });
    setPhotoPreview(null);
    setPhotoFile(null);
  }, [student]);

  // Fetch individual fee records for this student
  useEffect(() => {
    if (!studentId) return;
    fetch(`/api/fees?studentId=${studentId}`, { headers: authHeader() })
      .then(r => r.ok ? r.json() : [])
      .then((rows: FeeRecord[]) => {
        setFeeRecords(rows);
        const { values, ids } = mapFeeRecords(rows);
        setFees(values);
        setFeeIds(ids);
      })
      .catch(() => {});
  }, [studentId]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Upsert individual fee record ────────────────────────────────────────────
  const upsertFee = async (cat: typeof FEE_CATS[number], amount: number) => {
    const existingId = feeIds[cat.key];
    const today   = new Date();
    const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    const headers  = { "Content-Type": "application/json", ...authHeader() };

    if (existingId) {
      // Update existing record amount
      await fetch(`/api/fees/${existingId}`, {
        method:  "PUT",
        headers,
        body: JSON.stringify({ amount }),
      });
    } else {
      // Create new fee record
      await fetch("/api/fees", {
        method:  "POST",
        headers,
        body: JSON.stringify({
          studentId,
          amount,
          month:   `${cat.monthPrefix}-${monthKey}`,
          dueDate: today.toISOString().slice(0, 10),
          notes:   cat.label,
        }),
      });
    }
  };

  // ── Save handler ─────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!f.name.trim()) { toast({ variant:"destructive", title:"Name is required" }); return; }
    setSaving(true);
    try {
      // Upload photo if changed
      if (photoFile) {
        const fd = new FormData();
        fd.append("image", photoFile);
        await fetch(`/api/students/${studentId}/image`, {
          method:  "POST",
          headers: authHeader() as HeadersInit,
          body:    fd,
        });
      }

      // Update student core record
      await updateMut.mutateAsync({
        id: studentId,
        data: {
          name:             f.name             || undefined,
          fatherName:       f.fatherName       || undefined,
          motherName:       f.motherName       || undefined,
          dateOfBirth:      f.dateOfBirth      || undefined,
          gender:           (f.gender as any)  || undefined,
          address:          f.address          || undefined,
          phone:            f.phone            || undefined,
          emergencyContact: f.emergencyContact || undefined,
          classId:          f.classId ? Number(f.classId) : undefined,
          section:          f.section          || undefined,
          rollNumber:       f.rollNumber       || undefined,
          feeAmount:        f.feeAmount ? Number(f.feeAmount) : undefined,
          status:           f.status as any,
        } as any,
      });

      // Upsert individual fee records (skip if empty)
      for (const cat of FEE_CATS) {
        const amount = Number(fees[cat.key] || 0);
        if (amount > 0) {
          await upsertFee(cat, amount);
        }
      }

      // Refresh fee records
      fetch(`/api/fees?studentId=${studentId}`, { headers: authHeader() })
        .then(r => r.ok ? r.json() : [])
        .then((rows: FeeRecord[]) => {
          setFeeRecords(rows);
          const { values, ids } = mapFeeRecords(rows);
          setFees(values);
          setFeeIds(ids);
        });

      await qc.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
      await qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: "Student updated successfully" });
      setPhotoPreview(null);
      setPhotoFile(null);
      setMode("view");
    } catch {
      toast({ variant:"destructive", title:"Failed to save — please try again" });
    } finally {
      setSaving(false);
    }
  };

  // ── Derived: total fee from individual inputs ─────────────────────────────
  const totalIndividualFee =
    Object.values(fees).reduce((sum, v) => sum + Number(v || 0), 0) +
    Number(f.feeAmount || 0);

  // ── Loading / not found ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }
  if (!student) return (
    <div className="text-center py-20 text-gray-500">
      <p className="text-lg font-semibold">Student not found</p>
      <Button variant="outline" className="mt-4" onClick={() => setLocation("/students")}>← Back</Button>
    </div>
  );

  const s           = student as any;
  const displayPhoto = mode === "edit" ? (photoPreview ?? s.imageUrl ?? null) : (s.imageUrl ?? null);

  // Build known-category breakdown for view mode
  const knownFeeBreakdown = FEE_CATS
    .map(cat => {
      const rec = feeRecords.find(r => r.notes && cat.match.test(r.notes));
      return rec ? { label: cat.label, amount: rec.amount, paid: rec.paidAmount, status: rec.status } : null;
    })
    .filter(Boolean) as { label: string; amount: number; paid: number; status: string }[];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{s.name}</h1>
            <p className="text-xs font-mono text-indigo-400">{s.admissionNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <Button size="sm" variant={mode === "view" ? "default" : "ghost"} className="h-8 px-3 gap-1.5"
              onClick={() => { setMode("view"); setPhotoPreview(null); setPhotoFile(null); }}>
              <Eye className="w-3.5 h-3.5" /> View
            </Button>
            <Button size="sm" variant={mode === "edit" ? "default" : "ghost"} className="h-8 px-3 gap-1.5"
              onClick={() => setMode("edit")}>
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mode === "view" && (
        <div className="space-y-4">
          {/* Photo + summary */}
          <Card>
            <CardContent className="pt-5 flex items-center gap-5">
              <div className="w-24 h-24 rounded-full border-2 border-indigo-200 overflow-hidden bg-indigo-50 flex items-center justify-center shrink-0">
                {displayPhoto
                  ? <img src={displayPhoto} alt={s.name} className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  : <User className="w-10 h-10 text-indigo-300" />}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {s.className ?? "—"}{s.section ? ` — ${s.section}` : ""}
                  {s.rollNumber ? `  ·  Roll: ${s.rollNumber}` : ""}
                </p>
                <span className={`inline-block mt-2 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[s.status] ?? STATUS_COLORS.active}`}>
                  {s.status}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Personal */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
              <CardContent className="pt-0">
                {[
                  ["Father Name",       s.fatherName],
                  ["Mother Name",       s.motherName],
                  ["Date of Birth",     s.dateOfBirth],
                  ["Gender",            s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : null],
                  ["Phone",             s.phone],
                  ["Emergency Contact", s.emergencyContact],
                  ["Address",           s.address],
                  ["Username",          s.username],
                ].map(([lbl, val]) => <InfoRow key={lbl as string} label={lbl as string} value={val as string} />)}
              </CardContent>
            </Card>

            {/* Academic + status */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Academic & Fee Info</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {[
                    ["Class",         s.className],
                    ["Section",       s.section],
                    ["Roll Number",   s.rollNumber],
                    ["Monthly Fee",   s.feeAmount ? `PKR ${Number(s.feeAmount).toLocaleString()}` : null],
                    ["Admission No.", s.admissionNumber],
                  ].map(([lbl, val]) => <InfoRow key={lbl as string} label={lbl as string} value={val as string} />)}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Change Status</CardTitle></CardHeader>
                <CardContent className="pt-0 flex flex-col gap-2">
                  {(["active","inactive","left"] as const).map(st => (
                    <Button key={st} size="sm" variant={s.status === st ? "default" : "outline"}
                      className="capitalize justify-start"
                      disabled={s.status === st || updateMut.isPending}
                      onClick={() => updateMut.mutate({ id: studentId, data:{ status: st } as any }, {
                        onSuccess: () => {
                          qc.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
                          qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                          toast({ title: `Status changed to ${st}` });
                        },
                        onError: () => toast({ variant:"destructive", title:"Update failed" }),
                      })}>
                      Mark as {st}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Fee breakdown from fee records */}
          {knownFeeBreakdown.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm">Fee Breakdown (Recorded Fees)</CardTitle></CardHeader>
              <CardContent className="pt-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-xs text-gray-500 font-semibold">Fee Type</th>
                      <th className="text-right py-2 text-xs text-gray-500 font-semibold">Amount</th>
                      <th className="text-right py-2 text-xs text-gray-500 font-semibold">Paid</th>
                      <th className="text-right py-2 text-xs text-gray-500 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {knownFeeBreakdown.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 text-gray-700">{row.label}</td>
                        <td className="py-2 text-right font-medium">PKR {row.amount.toLocaleString()}</td>
                        <td className="py-2 text-right text-emerald-700">PKR {row.paid.toLocaleString()}</td>
                        <td className="py-2 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            row.status === "paid"    ? "bg-emerald-100 text-emerald-700" :
                            row.status === "partial" ? "bg-yellow-100 text-yellow-700"  :
                            "bg-red-100 text-red-600"}`}>
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* EDIT MODE                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mode === "edit" && (
        <div className="space-y-4">

          {/* Photo */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Student Photo</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-5">
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full border-2 border-indigo-300 overflow-hidden bg-indigo-50 flex items-center justify-center">
                  {displayPhoto
                    ? <img src={displayPhoto} alt="Student" className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <User className="w-10 h-10 text-indigo-300" />}
                </div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg">
                  <Camera className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
                  <Camera className="w-3.5 h-3.5" /> {displayPhoto ? "Change Photo" : "Upload Photo"}
                </Button>
                {photoPreview && (
                  <Button type="button" variant="ghost" size="sm" className="text-red-500 gap-1.5"
                    onClick={() => { setPhotoPreview(null); setPhotoFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                    <X className="w-3.5 h-3.5" /> Remove
                  </Button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={onFileChange} />
            </CardContent>
          </Card>

          {/* Personal info */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name *" className="sm:col-span-2">
                <Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Full name" />
              </Field>
              <Field label="Father Name">
                <Input value={f.fatherName} onChange={e => setF(p => ({ ...p, fatherName: e.target.value }))} placeholder="Father's name" />
              </Field>
              <Field label="Mother Name">
                <Input value={f.motherName} onChange={e => setF(p => ({ ...p, motherName: e.target.value }))} placeholder="Mother's name" />
              </Field>
              <Field label="Date of Birth">
                <Input type="date" value={f.dateOfBirth} onChange={e => setF(p => ({ ...p, dateOfBirth: e.target.value }))} />
              </Field>
              <Field label="Gender">
                <Select value={f.gender} onValueChange={v => setF(p => ({ ...p, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Phone">
                <Input value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} placeholder="0300-0000000" />
              </Field>
              <Field label="Emergency Contact">
                <Input value={f.emergencyContact} onChange={e => setF(p => ({ ...p, emergencyContact: e.target.value }))} />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={f.address} onChange={e => setF(p => ({ ...p, address: e.target.value }))} placeholder="Home address" />
              </Field>
            </CardContent>
          </Card>

          {/* Academic */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Academic Info</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Class">
                <Select value={f.classId} onValueChange={v => setF(p => ({ ...p, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {(classes as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Section">
                <Input value={f.section} onChange={e => setF(p => ({ ...p, section: e.target.value }))} placeholder="A, B, C…" />
              </Field>
              <Field label="Roll Number">
                <Input value={f.rollNumber} onChange={e => setF(p => ({ ...p, rollNumber: e.target.value }))} placeholder="01" />
              </Field>
              <Field label="Status">
                <Select value={f.status} onValueChange={v => setF(p => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </CardContent>
          </Card>

          {/* ── Fee Breakdown (editable) ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fee Details</CardTitle>
              <p className="text-xs text-gray-400 mt-0.5">
                Har fee alag se save hogi. 0 ya khali chhorne se record nahi banega.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Monthly fee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Monthly Fee (PKR)">
                  <Input
                    type="number" min="0" placeholder="0"
                    value={f.feeAmount}
                    onChange={e => setF(p => ({ ...p, feeAmount: e.target.value }))}
                  />
                </Field>
              </div>

              <div className="border-t pt-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  One-Time / Additional Fees
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {FEE_CATS.map(cat => (
                    <Field key={cat.key} label={cat.label + " (PKR)"}>
                      <div className="relative">
                        <Input
                          type="number" min="0" placeholder="0"
                          value={fees[cat.key]}
                          onChange={e => setFees(p => ({ ...p, [cat.key]: e.target.value }))}
                          className={feeIds[cat.key] ? "border-emerald-300 focus:ring-emerald-300" : ""}
                        />
                        {feeIds[cat.key] && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-emerald-600 font-medium bg-emerald-50 px-1.5 py-0.5 rounded">
                            Saved
                          </span>
                        )}
                      </div>
                      {feeIds[cat.key] ? (
                        <p className="text-xs text-emerald-600">Existing record — amount update ho jayegi</p>
                      ) : (
                        <p className="text-xs text-gray-400">Amount daalen toh naya record banega</p>
                      )}
                    </Field>
                  ))}
                </div>
              </div>

              {/* Live total summary */}
              {totalIndividualFee > 0 && (
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 mt-2">
                  <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wide mb-2">Fee Summary</p>
                  <div className="space-y-1 text-sm">
                    {Number(f.feeAmount) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Monthly Fee</span>
                        <span className="font-medium">PKR {Number(f.feeAmount).toLocaleString()}</span>
                      </div>
                    )}
                    {FEE_CATS.map(cat => Number(fees[cat.key]) > 0 && (
                      <div key={cat.key} className="flex justify-between">
                        <span className="text-gray-600">{cat.label}</span>
                        <span className="font-medium">PKR {Number(fees[cat.key]).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-indigo-200">
                    <span className="text-sm font-bold text-gray-800">Total</span>
                    <span className="text-base font-bold text-red-600">PKR {totalIndividualFee.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" disabled={saving}
              onClick={() => { setMode("view"); setPhotoPreview(null); setPhotoFile(null); }}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving || !f.name.trim()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-[130px]">
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
