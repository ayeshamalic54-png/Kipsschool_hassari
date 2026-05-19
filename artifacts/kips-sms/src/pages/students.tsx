import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useLocation, useSearch } from "wouter";
import { useListStudents, useDeleteStudent, useUpdateStudent, useListClasses } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Eye, Trash2,
  UserCheck, UserX, UserMinus,
  Printer, Bell, AlertTriangle, PhoneCall,
  Pencil, Loader2,
} from "lucide-react";

// ─── PRINT CSS ────────────────────────────────────────────────────────────────
const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 14mm 14mm; }
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
    }
    #kips-print-portal * { font-family: Arial, sans-serif !important; }
    table { border-collapse: collapse !important; width: 100% !important; page-break-inside: auto; }
    tr    { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
  }
`;

const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

const statusConfig = {
  active:   { label: "Active",   icon: UserCheck, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  inactive: { label: "Inactive", icon: UserX,     className: "bg-gray-100 text-gray-600 border-gray-200" },
  left:     { label: "Left",     icon: UserMinus,  className: "bg-red-100 text-red-700 border-red-200" },
};

const editSchema = z.object({
  name:            z.string().min(1, "Name is required"),
  fatherName:      z.string().optional(),
  classId:         z.string().optional(),
  section:         z.string().optional(),
  feeAmount:       z.string().optional(),
  phone:           z.string().optional(),
  status:          z.enum(["active", "inactive", "left"]),
  admissionNumber: z.string().optional(),
});

type EditFormValues = z.infer<typeof editSchema>;

// ─── Fee Reminder Banner ──────────────────────────────────────────────────────
function FeeReminderBanner({ students }: {
  students: Array<{
    id: number; name: string; fatherName?: string | null;
    feeAmount?: number | null; className?: string | null;
  }>
}) {
  const { toast }  = useToast();
  const [dismissed, setDismissed] = useState(false);
  const studentsWithFee = students.filter(s => s.feeAmount && s.feeAmount > 0);
  if (!studentsWithFee.length || dismissed) return null;

  return (
    <Card className="border-orange-200 bg-orange-50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-orange-800 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Fee Reminder — Parents Notification
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm"
              onClick={() => toast({ title: "Fee Reminders Ready", description: `${studentsWithFee.length} students have pending fees.` })}
              className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white">
              <Bell className="w-3 h-3 mr-1" /> Remind All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="h-7 text-xs text-orange-600">Dismiss</Button>
          </div>
        </div>
        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {studentsWithFee.length} students have monthly fees pending
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-orange-200">
                {["Student","Father","Class","Monthly Fee","Action"].map(h => (
                  <th key={h} className="text-left py-2 px-2 text-orange-700 font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studentsWithFee.slice(0, 5).map(student => (
                <tr key={student.id} className="border-b border-orange-100 hover:bg-orange-100/50">
                  <td className="py-2 px-2 font-medium text-orange-900">{student.name}</td>
                  <td className="py-2 px-2 text-orange-700">{student.fatherName || "—"}</td>
                  <td className="py-2 px-2 text-orange-700">{student.className || "—"}</td>
                  <td className="py-2 px-2 font-bold text-orange-800">PKR {Number(student.feeAmount).toLocaleString()}/mo</td>
                  <td className="py-2 px-2">
                    <Button size="sm" variant="outline"
                      className="h-6 text-xs border-orange-300 text-orange-700 hover:bg-orange-100"
                      onClick={() => toast({ title: `Reminder — ${student.name}`, description: `Fee: PKR ${Number(student.feeAmount).toLocaleString()} | Father: ${student.fatherName || "—"}` })}>
                      <PhoneCall className="w-3 h-3 mr-1" /> Remind
                    </Button>
                  </td>
                </tr>
              ))}
              {studentsWithFee.length > 5 && (
                <tr><td colSpan={5} className="py-2 px-2 text-orange-600 text-center text-xs">+ {studentsWithFee.length - 5} more students</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Students() {
  const [, setLocation]      = useLocation();
  const searchStr            = useSearch();
  const params               = new URLSearchParams(searchStr);
  const classIdFilter        = params.get("classId");
  const [search, setSearch]  = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [editOpen, setEditOpen]         = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<number | null>(null);
  const { toast }     = useToast();
  const queryClient   = useQueryClient();

  // Inject print styles
  useEffect(() => {
    const existing = document.getElementById("kips-print-styles");
    if (existing) existing.remove();
    const el = document.createElement("style");
    el.id = "kips-print-styles";
    el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-print-styles")?.remove(); };
  }, []);

  const queryParams = {
    search: search || undefined,
    status: statusFilter as "active" | "inactive" | "left" | undefined,
    ...(classIdFilter ? { classId: Number(classIdFilter) } : {}),
  };

  const { data: studentsRaw, isLoading } = useListStudents(queryParams);
  const { data: allStudents }            = useListStudents({ status: "active" });
  const { data: classes }                = useListClasses();

  // Sort: class name → admission number → student name
  const students = studentsRaw ? [...studentsRaw].sort((a, b) => {
    const ca = (a.className ?? "").toLowerCase();
    const cb = (b.className ?? "").toLowerCase();
    if (ca !== cb) return ca.localeCompare(cb, undefined, { numeric: true });
    const aa = (a.admissionNumber ?? "").toString();
    const ab = (b.admissionNumber ?? "").toString();
    if (aa !== ab) return aa.localeCompare(ab, undefined, { numeric: true });
    return (a.name ?? "").localeCompare(b.name ?? "");
  }) : studentsRaw;
  const updateMutation                 = useUpdateStudent();
  const deleteMutation                 = useDeleteStudent();

  const currentClassName = classIdFilter
    ? classes?.find(c => c.id === Number(classIdFilter))?.name
    : undefined;

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: "", fatherName: "", classId: "", section: "", feeAmount: "", phone: "", status: "active", admissionNumber: "" },
  });

  const handleEdit = (student: NonNullable<typeof students>[number]) => {
    setEditingStudentId(student.id);
    editForm.reset({
      name:            student.name ?? "",
      fatherName:      student.fatherName ?? "",
      classId:         student.classId ? String(student.classId) : "",
      section:         student.section ?? "",
      feeAmount:       student.feeAmount ? String(student.feeAmount) : "",
      phone:           (student as unknown as { phone?: string }).phone ?? "",
      status:          (student.status as "active" | "inactive" | "left") ?? "active",
      admissionNumber: student.admissionNumber ? String(student.admissionNumber) : "",
    });
    setEditOpen(true);
  };

  const onEditSubmit = (values: EditFormValues) => {
    if (!editingStudentId) return;
    updateMutation.mutate(
      { id: editingStudentId, data: { ...values, classId: values.classId ? Number(values.classId) : undefined, feeAmount: values.feeAmount ? Number(values.feeAmount) : undefined } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["listStudents"] });
          toast({ title: "Student updated successfully" });
          setEditOpen(false);
          setEditingStudentId(null);
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update student" }),
      }
    );
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete student "${name}"? This cannot be undone.`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["listStudents"] }); toast({ title: "Student deleted" }); },
      onError: () => toast({ variant: "destructive", title: "Failed to delete student" }),
    });
  };

  // Table cell styles for print
  const th = { padding: "8px 10px", background: "#dbeafe", color: "#1e3a8a", fontWeight: 700, fontSize: 10, textAlign: "left" as const, border: "1px solid #93c5fd" };
  const td = { padding: "7px 10px", border: "1px solid #e5e7eb", fontSize: 10, color: "#1f2937", background: "#ffffff" };
  const tdA = { ...td, background: "#f9fafb" };

  // Active count
  const activeCount   = (students ?? []).filter(s => s.status === "active").length;
  const inactiveCount = (students ?? []).filter(s => s.status !== "active").length;

  // ─── PRINT PORTAL ──────────────────────────────────────────────────────────
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
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>
          {currentClassName ? `${currentClassName} — Student Report` : "Student Report"}
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#6b7280" }}>All student admissions and status</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
        {[
          { label: "Total Students", value: (students ?? []).length, color: "#1d4ed8" },
          { label: "Active",         value: activeCount,              color: "#065f46" },
          { label: "Inactive / Left",value: inactiveCount,            color: "#b91c1c" },
        ].map(c => (
          <div key={c.label} style={{ flex: "1 1 0", border: `2px solid ${c.color}`, borderRadius: 8, padding: "12px 10px", textAlign: "center", background: "#f9fafb" }}>
            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{c.label}</p>
            <p style={{ margin: "7px 0 0", fontSize: 18, fontWeight: 900, color: c.color }}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Student table */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ width: 4, height: 18, background: "#1d4ed8", borderRadius: 2 }} />
        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: 0.7 }}>
          Student List — {(students ?? []).length} Records
        </h3>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["Adm #","Name","Father Name","Class","Section","Fee/Month","Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {!(students ?? []).length
            ? <tr><td colSpan={7} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No students found</td></tr>
            : (students ?? []).map((s, i) => (
              <tr key={s.id}>
                <td style={i % 2 === 0 ? td : tdA}>{s.admissionNumber ?? "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{s.name}</td>
                <td style={i % 2 === 0 ? td : tdA}>{s.fatherName || "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{s.className || "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{s.section || "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{s.feeAmount ? `PKR ${Number(s.feeAmount).toLocaleString()}` : "—"}</td>
                <td style={i % 2 === 0 ? td : tdA}>{s.status ?? "active"}</td>
              </tr>
            ))
          }
        </tbody>
        {(students ?? []).length > 0 && (
          <tfoot>
            <tr style={{ background: "#dbeafe" }}>
              <td colSpan={6} style={th}>Total Students</td>
              <td style={{ ...th, fontWeight: 900, color: "#1d4ed8" }}>{(students ?? []).length}</td>
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

  return (
    <>
      {printPortal}

      <div className="space-y-6">
        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Edit Student</DialogTitle></DialogHeader>
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={editForm.control} name="name" render={({ field }) => (
                    <FormItem className="col-span-2"><FormLabel>Full Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={editForm.control} name="fatherName" render={({ field }) => (
                    <FormItem><FormLabel>Father Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editForm.control} name="admissionNumber" render={({ field }) => (
                    <FormItem><FormLabel>Admission #</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editForm.control} name="classId" render={({ field }) => (
                    <FormItem><FormLabel>Class</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                        <SelectContent>{classes?.map(cls => <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="section" render={({ field }) => (
                    <FormItem><FormLabel>Section</FormLabel><FormControl><Input placeholder="A" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editForm.control} name="feeAmount" render={({ field }) => (
                    <FormItem><FormLabel>Monthly Fee (PKR)</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editForm.control} name="phone" render={({ field }) => (
                    <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                  <FormField control={editForm.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={updateMutation.isPending} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white">
                    {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Changes
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {currentClassName ? `${currentClassName} — Students` : "Students"}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {currentClassName ? `${currentClassName} ke tamam students` : "Manage student records and admissions"}
            </p>
          </div>
          <div className="flex gap-2">
            {currentClassName && (
              <Button variant="outline" size="sm" onClick={() => setLocation("/students")}>All Students</Button>
            )}
            <Button variant="outline" onClick={() => window.print()} className="no-print">
              <Printer className="w-4 h-4 mr-2" /> Print List
            </Button>
            <Button
              onClick={() => setLocation("/students/new")}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-sm no-print"
            >
              <Plus className="w-4 h-4 mr-2" /> New Admission
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Active",    value: allStudents?.length ?? 0,                                  gradient: "from-blue-500 to-cyan-500" },
            { label: "Showing",         value: students?.length ?? 0,                                     gradient: "from-violet-500 to-purple-600" },
            { label: "Inactive / Left", value: students?.filter(s => s.status !== "active").length ?? 0,  gradient: "from-gray-400 to-gray-500" },
          ].map(c => (
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${c.gradient} p-4`}>
                  <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                  <p className="text-white text-2xl font-bold mt-1">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name or admission number..."
                  className="pl-9"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  data-testid="input-search-students"
                />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <Select
                  value={classIdFilter ?? "all"}
                  onValueChange={v => v === "all" ? setLocation("/students") : setLocation(`/students?classId=${v}`)}
                >
                  <SelectTrigger className="h-9 w-[150px]">
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                {["all", "active", "inactive", "left"].map(s => (
                  <Button key={s} size="sm"
                    variant={(s === "all" && !statusFilter) || statusFilter === s ? "default" : "outline"}
                    onClick={() => setStatusFilter(s === "all" ? undefined : s)}
                    className="capitalize"
                    data-testid={`button-filter-${s}`}
                  >{s}</Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : !students?.length ? (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No students found</p>
                <p className="text-sm mt-1">Add a new student to get started</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      {["Adm #","Name","Father Name","Class","Section","Fee/mo","Status","Actions"].map(h => (
                        <th key={h} className="text-left py-3 px-2 font-semibold text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map(student => {
                      const status = statusConfig[student.status as keyof typeof statusConfig] ?? statusConfig.active;
                      return (
                        <tr key={student.id} className="border-b hover:bg-gray-50 transition-colors" data-testid={`row-student-${student.id}`}>
                          <td className="py-3 px-2 font-mono text-xs text-purple-600 font-medium">{student.admissionNumber}</td>
                          <td className="py-3 px-2 font-medium text-gray-900">{student.name}</td>
                          <td className="py-3 px-2 text-gray-600">{student.fatherName || "—"}</td>
                          <td className="py-3 px-2 text-gray-600">{student.className || "—"}</td>
                          <td className="py-3 px-2 text-gray-600">{student.section || "—"}</td>
                          <td className="py-3 px-2 text-gray-600">{student.feeAmount ? `PKR ${Number(student.feeAmount).toLocaleString()}` : "—"}</td>
                          <td className="py-3 px-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                              {status.label}
                            </span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setLocation(`/students/${student.id}`)} data-testid={`button-view-student-${student.id}`}>
                                <Eye className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50" onClick={() => handleEdit(student)} data-testid={`button-edit-student-${student.id}`}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(student.id, student.name)} disabled={deleteMutation.isPending} data-testid={`button-delete-student-${student.id}`}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
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
    </>
  );
}
