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

export default function StudentDetail() {
  const [, params]      = useRoute("/students/:id");
  const [, setLocation] = useLocation();
  const { toast }       = useToast();
  const qc              = useQueryClient();
  const studentId       = Number(params?.id);
  const fileRef         = useRef<HTMLInputElement>(null);

  const [mode, setMode]             = useState<"view"|"edit">("view");
  const [photoPreview, setPhotoPreview] = useState<string|null>(null);   // base64 preview
  const [photoFile, setPhotoFile]   = useState<File|null>(null);
  const [saving, setSaving]         = useState(false);

  const [f, setF] = useState({
    name:"", fatherName:"", motherName:"", dateOfBirth:"",
    gender:"", address:"", phone:"", emergencyContact:"",
    classId:"", section:"", rollNumber:"", feeAmount:"", status:"active",
  });

  const { data: student, isLoading } = useGetStudent(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) },
  });
  const { data: classes = [] } = useListClasses();
  const updateMut = useUpdateStudent();

  /* Fill form when student loads */
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
      classId:          s.classId          ? String(s.classId) : "",
      section:          s.section          ?? "",
      rollNumber:       s.rollNumber       ?? "",
      feeAmount:        s.feeAmount        ? String(s.feeAmount) : "",
      status:           s.status           ?? "active",
    });
    // Reset any staged photo when student reloads
    setPhotoPreview(null);
    setPhotoFile(null);
  }, [student]);

  /* Image file selected */
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = ev => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  /* Save */
  const handleSave = async () => {
    if (!f.name.trim()) { toast({ variant:"destructive", title:"Name is required" }); return; }
    setSaving(true);
    try {
      /* 1) Upload new photo first */
      if (photoFile) {
        const fd = new FormData();
        fd.append("image", photoFile);
        const res = await fetch(`/api/students/${studentId}/image`, {
          method: "POST",
          headers: authHeader() as HeadersInit,
          body: fd,
        });
        if (!res.ok) toast({ variant:"destructive", title:"Photo upload failed — other changes will still save" });
      }

      /* 2) Update student fields */
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
          classId:          f.classId          ? Number(f.classId) : undefined,
          section:          f.section          || undefined,
          rollNumber:       f.rollNumber       || undefined,
          feeAmount:        f.feeAmount        ? Number(f.feeAmount) : undefined,
          status:           f.status as any,
        } as any,
      });

      await qc.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
      await qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: "✅ Student updated successfully" });
      setPhotoPreview(null);
      setPhotoFile(null);
      setMode("view");
    } catch {
      toast({ variant:"destructive", title:"Failed to save — please try again" });
    } finally {
      setSaving(false);
    }
  };

  /* ─── Loading / not found ─────────────────────────────────────────────── */
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
      <Button variant="outline" className="mt-4" onClick={() => setLocation("/students")}>
        ← Back to Students
      </Button>
    </div>
  );

  const s = student as any;

  /* Decide which photo to show:
     - in edit mode: staged preview → existing imageUrl → null
     - in view mode: existing imageUrl → null                       */
  const displayPhoto = mode === "edit"
    ? (photoPreview ?? s.imageUrl ?? null)
    : (s.imageUrl ?? null);

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── Top bar ────────────────────────────────────────────────────── */}
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
            <Button type="button" size="sm"
              variant={mode === "view" ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5"
              onClick={() => { setMode("view"); setPhotoPreview(null); setPhotoFile(null); }}>
              <Eye className="w-3.5 h-3.5" /> View
            </Button>
            <Button type="button" size="sm"
              variant={mode === "edit" ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5"
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
              {/* PHOTO */}
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
              <CardContent className="pt-0 space-y-0">
                {[
                  ["Father Name",       s.fatherName],
                  ["Mother Name",       s.motherName],
                  ["Date of Birth",     s.dateOfBirth],
                  ["Gender",            s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : null],
                  ["Phone",             s.phone],
                  ["Emergency Contact", s.emergencyContact],
                  ["Address",           s.address],
                  ["Login Username",    s.username],
                ].map(([lbl, val]) => (
                  <div key={lbl} className="flex justify-between items-start py-1.5 border-b last:border-0">
                    <span className="text-xs text-gray-400 w-36 shrink-0">{lbl}</span>
                    <span className="text-sm text-gray-900 font-medium text-right break-all">{val || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Academic + status */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Academic Info</CardTitle></CardHeader>
                <CardContent className="pt-0 space-y-0">
                  {[
                    ["Class",         s.className],
                    ["Section",       s.section],
                    ["Roll Number",   s.rollNumber],
                    ["Monthly Fee",   s.feeAmount ? `PKR ${Number(s.feeAmount).toLocaleString()}` : null],
                    ["Admission No.", s.admissionNumber],
                  ].map(([lbl, val]) => (
                    <div key={lbl} className="flex justify-between items-center py-1.5 border-b last:border-0">
                      <span className="text-xs text-gray-400">{lbl}</span>
                      <span className="text-sm font-medium text-gray-900">{val || "—"}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Change Status</CardTitle></CardHeader>
                <CardContent className="pt-0 flex flex-col gap-2">
                  {(["active","inactive","left"] as const).map(st => (
                    <Button key={st} size="sm"
                      variant={s.status === st ? "default" : "outline"}
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
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* EDIT MODE                                                          */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {mode === "edit" && (
        <div className="space-y-4">

          {/* ── Photo section ────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Student Photo</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-5">
              {/* Photo circle */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full border-2 border-indigo-300 overflow-hidden bg-indigo-50 flex items-center justify-center">
                  {displayPhoto
                    ? <img src={displayPhoto} alt="Student"
                        className="w-full h-full object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    : <User className="w-10 h-10 text-indigo-300" />}
                </div>
                {/* Camera button overlay */}
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg transition-colors">
                  <Camera className="w-4 h-4" />
                </button>
              </div>

              {/* Right side text */}
              <div className="flex-1 min-w-0">
                {displayPhoto
                  ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        {photoFile ? `Nai photo: ${photoFile.name}` : "Mौjuda photo موجود ہے"}
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        Change karna chahain toh neeche click karein
                      </p>
                    </div>
                  )
                  : (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-1">
                        Koi photo nahi hai
                      </p>
                      <p className="text-xs text-gray-400 mb-3">
                        Student ki photo upload karein
                      </p>
                    </div>
                  )}
                <div className="flex gap-2 flex-wrap">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => fileRef.current?.click()}
                    className="gap-1.5">
                    <Camera className="w-3.5 h-3.5" />
                    {displayPhoto ? "Photo Change Karein" : "Photo Upload Karein"}
                  </Button>
                  {photoPreview && (
                    <Button type="button" variant="ghost" size="sm"
                      className="text-red-500 hover:text-red-700 gap-1.5"
                      onClick={() => { setPhotoPreview(null); setPhotoFile(null); if (fileRef.current) fileRef.current.value = ""; }}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                className="hidden" onChange={onFileChange} />
            </CardContent>
          </Card>

          {/* ── Personal info ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name *">
                <Input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} placeholder="Student full name" />
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
                <Input value={f.emergencyContact} onChange={e => setF(p => ({ ...p, emergencyContact: e.target.value }))} placeholder="Emergency number" />
              </Field>
              <Field label="Address" className="sm:col-span-2">
                <Input value={f.address} onChange={e => setF(p => ({ ...p, address: e.target.value }))} placeholder="Home address" />
              </Field>
            </CardContent>
          </Card>

          {/* ── Academic + fee ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Academic & Fee Info</CardTitle></CardHeader>
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
              <Field label="Monthly Fee (PKR)">
                <Input type="number" value={f.feeAmount} onChange={e => setF(p => ({ ...p, feeAmount: e.target.value }))} placeholder="2500" />
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

          {/* ── Action buttons ─────────────────────────────────────────────── */}
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

/* ── Small helper for labeled fields ─────────────────────────────────────── */
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className}`}>
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  );
}
