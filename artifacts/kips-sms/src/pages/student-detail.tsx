import { useState, useRef, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetStudent, useUpdateStudent, useListClasses, getGetStudentQueryKey, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Pencil, Eye, Loader2, Camera, User, Trash2, Printer } from "lucide-react";

function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function StudentDetail() {
  const [, params]    = useRoute("/students/:id");
  const [, setLocation] = useLocation();
  const { toast }     = useToast();
  const qc            = useQueryClient();
  const studentId     = Number(params?.id);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  const [mode, setMode]               = useState<"view" | "edit">("view");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile]     = useState<File | null>(null);
  const [uploading, setUploading]     = useState(false);
  const [saving, setSaving]           = useState(false);

  // Form fields state
  const [form, setForm] = useState({
    name: "", fatherName: "", motherName: "", dateOfBirth: "",
    gender: "", address: "", phone: "", emergencyContact: "",
    classId: "", section: "", rollNumber: "",
    feeAmount: "", status: "active",
  });

  const { data: student, isLoading } = useGetStudent(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) },
  });
  const { data: classes = [] }       = useListClasses();
  const updateMutation               = useUpdateStudent();

  // Populate form when student loads
  useEffect(() => {
    if (!student) return;
    const s = student as any;
    setForm({
      name:             s.name            ?? "",
      fatherName:       s.fatherName      ?? "",
      motherName:       s.motherName      ?? "",
      dateOfBirth:      s.dateOfBirth     ?? "",
      gender:           s.gender          ?? "",
      address:          s.address         ?? "",
      phone:            s.phone           ?? "",
      emergencyContact: s.emergencyContact ?? "",
      classId:          s.classId         ? String(s.classId) : "",
      section:          s.section         ?? "",
      rollNumber:       s.rollNumber      ?? "",
      feeAmount:        s.feeAmount       ? String(s.feeAmount) : "",
      status:           s.status          ?? "active",
    });
  }, [student]);

  // ── Image change ────────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Upload photo if changed
      if (imageFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append("image", imageFile);
        await fetch(`/api/students/${studentId}/image`, {
          method: "POST",
          headers: authHeader() as HeadersInit,
          body: fd,
        });
        setUploading(false);
        setImageFile(null);
      }

      // 2. Update fields
      await updateMutation.mutateAsync({
        id: studentId,
        data: {
          name:             form.name             || undefined,
          fatherName:       form.fatherName        || undefined,
          motherName:       form.motherName        || undefined,
          dateOfBirth:      form.dateOfBirth       || undefined,
          gender:           (form.gender as any)   || undefined,
          address:          form.address           || undefined,
          phone:            form.phone             || undefined,
          emergencyContact: form.emergencyContact  || undefined,
          classId:          form.classId           ? Number(form.classId) : undefined,
          section:          form.section           || undefined,
          rollNumber:       form.rollNumber        || undefined,
          feeAmount:        form.feeAmount         ? Number(form.feeAmount) : undefined,
          status:           (form.status as any),
        } as any,
      });

      qc.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
      qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
      toast({ title: "Student updated successfully" });
      setMode("view");
      setImagePreview(null);
    } catch {
      toast({ variant: "destructive", title: "Failed to save changes" });
    } finally {
      setSaving(false);
      setUploading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!student) return <div className="text-center py-20 text-gray-500">Student not found</div>;

  const s         = student as any;
  const photoSrc  = imagePreview ?? (s.imageUrl || null);
  const statusColors: Record<string, string> = {
    active:   "bg-emerald-100 text-emerald-700",
    inactive: "bg-gray-100 text-gray-600",
    left:     "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{s.name}</h1>
            <p className="text-xs font-mono text-gray-400">{s.admissionNumber}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Print */}
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>

          {/* View / Edit toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <Button type="button" size="sm"
              variant={mode === "view" ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5"
              onClick={() => { setMode("view"); setImagePreview(null); setImageFile(null); }}
            >
              <Eye className="w-3.5 h-3.5" /> View
            </Button>
            <Button type="button" size="sm"
              variant={mode === "edit" ? "default" : "ghost"}
              className="h-8 px-3 gap-1.5"
              onClick={() => setMode("edit")}
            >
              <Pencil className="w-3.5 h-3.5" /> Edit
            </Button>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* VIEW MODE                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === "view" && (
        <div className="space-y-4">
          {/* Photo + name card */}
          <Card>
            <CardContent className="pt-5 flex items-center gap-5">
              <div className="w-20 h-20 rounded-full border-2 border-indigo-200 overflow-hidden bg-indigo-50 flex items-center justify-center shrink-0">
                {s.imageUrl
                  ? <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" />
                  : <User className="w-8 h-8 text-indigo-300" />}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{s.name}</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  {s.className ?? "—"}
                  {s.section ? ` — ${s.section}` : ""}
                  {s.rollNumber ? `  ·  Roll: ${s.rollNumber}` : ""}
                </p>
                <span className={`inline-block mt-1.5 text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[s.status] ?? statusColors.active}`}>
                  {s.status}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Personal */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-2 pt-0">
                {[
                  ["Father Name",        s.fatherName],
                  ["Mother Name",        s.motherName],
                  ["Date of Birth",      s.dateOfBirth],
                  ["Gender",             s.gender ? s.gender.charAt(0).toUpperCase() + s.gender.slice(1) : null],
                  ["Phone",              s.phone],
                  ["Emergency Contact",  s.emergencyContact],
                  ["Address",            s.address],
                  ["Username",           s.username],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-start py-1 border-b last:border-0">
                    <span className="text-xs text-gray-500 shrink-0 w-36">{label}</span>
                    <span className="text-sm font-medium text-gray-900 text-right">{value || "—"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Academic + Fee */}
            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Academic Info</CardTitle></CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {[
                    ["Class",        s.className],
                    ["Section",      s.section],
                    ["Roll Number",  s.rollNumber],
                    ["Monthly Fee",  s.feeAmount ? `PKR ${Number(s.feeAmount).toLocaleString()}` : null],
                    ["Adm. Number",  s.admissionNumber],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between items-center py-1 border-b last:border-0">
                      <span className="text-xs text-gray-500">{label}</span>
                      <span className="text-sm font-medium text-gray-900">{value || "—"}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Quick Actions</CardTitle></CardHeader>
                <CardContent className="flex flex-col gap-2 pt-0">
                  {(["active", "inactive", "left"] as const).map((st) => (
                    <Button key={st} size="sm"
                      variant={s.status === st ? "default" : "outline"}
                      className="capitalize justify-start"
                      disabled={s.status === st || updateMutation.isPending}
                      onClick={() =>
                        updateMutation.mutate({ id: studentId, data: { status: st } as any }, {
                          onSuccess: () => {
                            qc.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
                            qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                            toast({ title: `Status changed to ${st}` });
                          },
                          onError: () => toast({ variant: "destructive", title: "Update failed" }),
                        })
                      }
                    >
                      Mark as {st}
                    </Button>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* EDIT MODE                                                             */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {mode === "edit" && (
        <div className="space-y-4">

          {/* ── Photo upload ───────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Student Photo</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-5">
              {/* Current / preview photo */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 rounded-full border-2 border-indigo-200 overflow-hidden bg-indigo-50 flex items-center justify-center">
                  {photoSrc
                    ? <img src={photoSrc} alt="Student" className="w-full h-full object-cover" />
                    : <User className="w-10 h-10 text-indigo-300" />}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow hover:bg-indigo-700 transition-colors"
                >
                  <Camera className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1">
                {photoSrc
                  ? (
                    <p className="text-sm text-gray-600 mb-2">
                      {imageFile ? `Nai photo: ${imageFile.name}` : "Mौजودہ photo"}
                    </p>
                  )
                  : <p className="text-sm text-gray-400 mb-2">Koi photo nahi hai — upload karein</p>
                }
                <div className="flex gap-2">
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {photoSrc ? "Change Photo" : "Upload Photo"}
                  </Button>
                  {imagePreview && (
                    <Button type="button" variant="ghost" size="sm"
                      className="text-red-500 gap-1.5"
                      onClick={() => { setImagePreview(null); setImageFile(null); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
            </CardContent>
          </Card>

          {/* ── Personal info ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Full Name *</label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Student full name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Father Name</label>
                <Input value={form.fatherName} onChange={(e) => setForm(f => ({ ...f, fatherName: e.target.value }))} placeholder="Father's name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Mother Name</label>
                <Input value={form.motherName} onChange={(e) => setForm(f => ({ ...f, motherName: e.target.value }))} placeholder="Mother's name" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Date of Birth</label>
                <Input type="date" value={form.dateOfBirth} onChange={(e) => setForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Gender</label>
                <Select value={form.gender} onValueChange={(v) => setForm(f => ({ ...f, gender: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="0300-0000000" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Emergency Contact</label>
                <Input value={form.emergencyContact} onChange={(e) => setForm(f => ({ ...f, emergencyContact: e.target.value }))} placeholder="Emergency contact number" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-gray-600">Address</label>
                <Input value={form.address} onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Home address" />
              </div>
            </CardContent>
          </Card>

          {/* ── Academic info ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Academic & Fee Info</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Class</label>
                <Select value={form.classId} onValueChange={(v) => setForm(f => ({ ...f, classId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>
                    {(classes as any[]).map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Section</label>
                <Input value={form.section} onChange={(e) => setForm(f => ({ ...f, section: e.target.value }))} placeholder="A, B, C…" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Roll Number</label>
                <Input value={form.rollNumber} onChange={(e) => setForm(f => ({ ...f, rollNumber: e.target.value }))} placeholder="01" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Monthly Fee (PKR)</label>
                <Input type="number" value={form.feeAmount} onChange={(e) => setForm(f => ({ ...f, feeAmount: e.target.value }))} placeholder="2500" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-600">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="left">Left</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* ── Save / Cancel ──────────────────────────────────────────────── */}
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline"
              onClick={() => { setMode("view"); setImagePreview(null); setImageFile(null); }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={saving || !form.name}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 min-w-[120px]"
            >
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin" /> {uploading ? "Uploading…" : "Saving…"}</>
                : "Save Changes"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
