import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useCreateStudent, useListClasses, useCreateFee } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Upload, User, Camera, Eye, Pencil, Plus, Trash2 } from "lucide-react";

// ── Zod Schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  name:             z.string().min(2, "Name required"),
  fatherName:       z.string().optional(),
  motherName:       z.string().optional(),
  dateOfBirth:      z.string().optional(),
  gender:           z.enum(["male", "female"]).optional(),
  address:          z.string().optional(),
  phone:            z.string().optional(),
  emergencyContact: z.string().optional(),
  classId:          z.string().min(1, "Class required"),
  section:          z.string().optional(),
  rollNumber:       z.string().optional(),
  // ── Fees ──
  feeAmount:        z.string().optional(),   // monthly fee
  admissionFee:     z.string().optional(),
  examFee:          z.string().optional(),
  annualFee:        z.string().optional(),
  transportFee:     z.string().optional(),
  booksFee:         z.string().optional(),
  siblingDiscount:  z.string().optional(),
  status:           z.enum(["active", "inactive", "left"]).default("active"),
});

// Custom fee row
interface CustomFeeRow {
  id: number;
  name: string;
  amount: string;
}

function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ── Admission Receipt HTML ────────────────────────────────────────────────────
interface AdmissionData {
  admissionNumber: string;
  studentName:     string;
  fatherName:      string;
  className:       string;
  section:         string;
  rollNumber:      string;
  admissionDate:   string;
  monthlyFee:      number;
  admissionFee:    number;
  examFee:         number;
  annualFee:       number;
  transportFee:    number;
  booksFee:        number;
  siblingDiscount: number;
  customFees:      CustomFeeRow[];
  phone:           string;
  address:         string;
}

function buildAdmissionReceiptHtml(d: AdmissionData, logoSrc: string): string {
  const totalDue =
    d.admissionFee +
    d.examFee +
    d.annualFee +
    d.transportFee +
    d.booksFee +
    d.customFees.reduce((s, f) => s + Number(f.amount || 0), 0) +
    Math.max(0, d.monthlyFee - d.siblingDiscount);

  const feeRow = (label: string, amount: number, cls = "") =>
    amount > 0
      ? `<div class="row"><span class="k ${cls}">${label}</span><span class="v strong ${cls}">PKR ${amount.toLocaleString()}</span></div>`
      : "";

  const copy = (label: string, accent: string) => `
    <div class="slip" style="--accent:${accent}">
      <div class="ribbon" style="background:${accent}">${label}</div>
      <div class="header">
        <img src="${logoSrc}" alt="KIPS" />
        <div class="head-text">
          <div class="school">KIPS School Hassari</div>
          <div class="tag">Bright Future — Quality Education</div>
          <div class="title">ADMISSION SLIP</div>
        </div>
      </div>
      <div class="meta">
        <div class="meta-cell"><span class="ml">Admission No.</span><span class="mv mono">${d.admissionNumber}</span></div>
        <div class="meta-cell"><span class="ml">Date</span><span class="mv">${d.admissionDate}</span></div>
      </div>
      <div class="card">
        <div class="card-title">STUDENT DETAILS</div>
        <div class="row"><span class="k">Full Name</span><span class="v strong">${d.studentName}</span></div>
        <div class="row"><span class="k">Father's Name</span><span class="v">${d.fatherName || "—"}</span></div>
        <div class="row"><span class="k">Class</span><span class="v strong">${d.className}${d.section ? " — " + d.section : ""}</span></div>
        <div class="row"><span class="k">Roll Number</span><span class="v">${d.rollNumber || "—"}</span></div>
        <div class="row"><span class="k">Phone</span><span class="v">${d.phone || "—"}</span></div>
        <div class="row"><span class="k">Address</span><span class="v small">${d.address || "—"}</span></div>
      </div>
      <div class="card fee-card">
        <div class="card-title">FEE BREAKDOWN</div>
        ${feeRow("Admission Fee (one-time)", d.admissionFee)}
        ${feeRow("Monthly Fee", d.monthlyFee)}
        ${feeRow("Exam Fee", d.examFee)}
        ${feeRow("Annual Fee", d.annualFee)}
        ${feeRow("Transport Fee", d.transportFee)}
        ${feeRow("Books Fee", d.booksFee)}
        ${d.customFees.filter(f => Number(f.amount) > 0).map(f => feeRow(f.name || "Custom Fee", Number(f.amount))).join("")}
        ${d.siblingDiscount > 0
          ? `<div class="row"><span class="k discount">Sibling Discount</span><span class="v discount">− PKR ${d.siblingDiscount.toLocaleString()}</span></div>`
          : ""}
        <div class="row total-row">
          <span class="k strong">First Payment Due</span>
          <span class="v total">PKR ${totalDue.toLocaleString()}</span>
        </div>
      </div>
      <div class="sigs">
        <div class="sig"><div class="line"></div><div class="lbl">Parent / Guardian Signature</div></div>
        <div class="seal">SCHOOL<br/>STAMP</div>
        <div class="sig"><div class="line"></div><div class="lbl">Principal Signature</div></div>
      </div>
      <div class="footer">
        <span class="ft-text">Welcome to KIPS School Hassari Family</span>
        <span class="ft-mono">Login: ${d.studentName.toLowerCase().replace(/\s+/g, ".")}.${d.admissionNumber.split("-").pop()} / kips123</span>
      </div>
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Admission Slip — ${d.studentName}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 8mm; }
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI','Helvetica Neue',Arial,sans-serif;background:#f1f5f9;padding:14px;color:#0f172a;
    -webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
  .page{max-width:560px;margin:0 auto;display:flex;flex-direction:column;gap:14px}
  .slip{background:#fff;border:2px solid var(--accent);border-radius:14px;padding:16px 18px;position:relative;overflow:hidden;
    box-shadow:0 4px 18px rgba(15,23,42,0.08)}
  .slip::before{content:"";position:absolute;top:0;left:0;right:0;height:6px;
    background:linear-gradient(90deg,var(--accent),#e07b1a);-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .ribbon{position:absolute;top:14px;right:-32px;color:#fff;font-size:10px;font-weight:800;letter-spacing:2px;
    padding:3px 36px;transform:rotate(35deg);text-transform:uppercase;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .header{display:flex;align-items:center;gap:14px;padding:8px 0 12px;border-bottom:2px dashed #cbd5e1;margin-bottom:12px}
  .header img{width:60px;height:60px;border-radius:50%;border:3px solid #e07b1a;object-fit:cover}
  .school{font-size:18px;font-weight:800;color:var(--accent)}
  .tag{font-size:10px;color:#64748b;margin-top:1px;font-style:italic}
  .title{display:inline-block;margin-top:4px;font-size:9px;font-weight:700;letter-spacing:2px;
    background:linear-gradient(135deg,var(--accent),#3730a3);color:#fff;padding:3px 12px;border-radius:12px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
  .meta-cell{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:6px 10px;display:flex;justify-content:space-between;align-items:center}
  .ml{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .mv{font-size:12px;color:#0f172a;font-weight:700}
  .mono{font-family:'Courier New',monospace;color:#7c3aed}
  .card{background:linear-gradient(135deg,#f8fafc,#eef2ff);border:1px solid #e0e7ff;border-radius:10px;
    padding:10px 14px;margin-bottom:10px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .fee-card{background:linear-gradient(135deg,#fffbeb,#fef3c7);border-color:#fde68a}
  .card-title{font-size:9px;font-weight:800;letter-spacing:2px;color:var(--accent);margin-bottom:6px;padding-bottom:4px;border-bottom:1px dotted #cbd5e1}
  .row{display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:12px}
  .k{color:#64748b}.v{color:#0f172a;text-align:right}
  .strong{font-weight:700}.small{font-size:10px}
  .discount{color:#059669!important;font-weight:600}
  .total-row{border-top:1.5px dashed #f59e0b;padding-top:6px;margin-top:4px;font-size:13px}
  .total{color:#dc2626;font-size:15px;font-weight:900}
  .sigs{display:grid;grid-template-columns:1fr 80px 1fr;gap:14px;align-items:end;margin:14px 0 8px}
  .sig{text-align:center}
  .line{border-top:1.5px solid #475569;height:1px;margin-bottom:3px}
  .lbl{font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:1px;font-weight:600}
  .seal{width:80px;height:60px;border:2px dashed var(--accent);border-radius:50%;
    display:flex;align-items:center;justify-content:center;color:var(--accent);
    font-size:8px;font-weight:800;text-align:center;line-height:1.2;letter-spacing:1px;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}
  .footer{display:flex;justify-content:space-between;font-size:9px;color:#94a3b8;
    padding-top:8px;border-top:1px dashed #cbd5e1;flex-wrap:wrap;gap:4px}
  .ft-text{font-style:italic;color:var(--accent);font-weight:600}
  .ft-mono{font-family:'Courier New',monospace;color:#7c3aed;font-size:8px}
  .cut-line{text-align:center;font-size:10px;color:#94a3b8;letter-spacing:4px;padding:2px 0}
  @media print{body{background:#fff;padding:0}.slip{box-shadow:none;page-break-inside:avoid}}
</style></head>
<body><div class="page">
  ${copy("School Copy", "#1a2a5e")}
  <div class="cut-line">✂ &nbsp;━━━━━━━━━━━━━━━ CUT HERE ━━━━━━━━━━━━━━━ &nbsp;✂</div>
  ${copy("Student Copy", "#7c3aed")}
</div>
<script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script>
</body></html>`;
}

// ── Preview Section ───────────────────────────────────────────────────────────
function PreviewRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b last:border-0">
      <span className="text-xs text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value || "—"}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentNew() {
  const [, setLocation]    = useLocation();
  const { toast }          = useToast();
  const queryClient        = useQueryClient();
  const fileInputRef       = useRef<HTMLInputElement>(null);

  const [imagePreview,   setImagePreview]   = useState<string | null>(null);
  const [imageFile,      setImageFile]      = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [mode,           setMode]           = useState<"edit" | "preview">("edit");
  const [customFees,     setCustomFees]     = useState<CustomFeeRow[]>([]);
  const [nextCustomId,   setNextCustomId]   = useState(1);

  const { data: classes } = useListClasses();
  const createMutation    = useCreateStudent();
  const createFeeMutation = useCreateFee();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { status: "active", siblingDiscount: "0" },
  });

  const watchedValues = form.watch();

  // ── Auto-fill fees from fee structure when class changes ──────────────────
  const handleClassChange = async (classId: string, onChange: (v: string) => void) => {
    onChange(classId);
    try {
      const token = localStorage.getItem("kips_token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`/api/fee-structures/class/${classId}`, { headers });
      if (!res.ok) return;
      const fs = await res.json();
      if (!fs) return;
      if (fs.monthlyFee)   form.setValue("feeAmount",    String(fs.monthlyFee));
      if (fs.admissionFee) form.setValue("admissionFee", String(fs.admissionFee));
      if (fs.examFee)      form.setValue("examFee",      String(fs.examFee));
      if (fs.transportFee) form.setValue("transportFee", String(fs.transportFee));
    } catch { /* non-fatal */ }
  };

  // ── Image Handling ────────────────────────────────────────────────────────
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  // ── Custom Fees ───────────────────────────────────────────────────────────
  const addCustomFee = () => {
    setCustomFees(prev => [...prev, { id: nextCustomId, name: "", amount: "" }]);
    setNextCustomId(prev => prev + 1);
  };

  const updateCustomFee = (id: number, field: "name" | "amount", value: string) => {
    setCustomFees(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeCustomFee = (id: number) => {
    setCustomFees(prev => prev.filter(f => f.id !== id));
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (values: z.infer<typeof schema>) => {
    createMutation.mutate(
      {
        data: {
          ...values,
          classId:         Number(values.classId),
          feeAmount:       values.feeAmount       ? Number(values.feeAmount)       : undefined,
          siblingDiscount: values.siblingDiscount ? Number(values.siblingDiscount) : 0,
        },
      },
      {
        onSuccess: async (student) => {
          // Upload image if selected
          if (imageFile && student.id) {
            setUploadingImage(true);
            try {
              const formData = new FormData();
              formData.append("image", imageFile);
              await fetch(`/api/students/${student.id}/image`, {
                method: "POST",
                headers: authHeader() as HeadersInit,
                body: formData,
              });
            } catch {
              toast({ variant: "destructive", title: "Student created but photo upload failed" });
            } finally {
              setUploadingImage(false);
            }
          }

          const admissionFee    = Number(values.admissionFee   || 0);
          const examFee         = Number(values.examFee        || 0);
          const annualFee       = Number(values.annualFee      || 0);
          const transportFee    = Number(values.transportFee   || 0);
          const booksFee        = Number(values.booksFee       || 0);
          const monthlyFee      = Number(values.feeAmount      || 0);
          const siblingDiscount = Number(values.siblingDiscount || 0);
          const today    = new Date();
          const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
          const dueDate  = today.toISOString().slice(0, 10);

          // Save each fee type as a fee record
          const feeEntries = [
            { amount: admissionFee,  month: `Admission-${monthKey}`, notes: "Admission Fee (one-time)" },
            { amount: examFee,       month: `Exam-${monthKey}`,      notes: "Exam Fee" },
            { amount: annualFee,     month: `Annual-${monthKey}`,    notes: "Annual Fee" },
            { amount: transportFee,  month: `Transport-${monthKey}`, notes: "Transport Fee" },
            { amount: booksFee,      month: `Books-${monthKey}`,     notes: "Books Fee" },
            ...customFees
              .filter(f => Number(f.amount) > 0 && f.name)
              .map(f => ({ amount: Number(f.amount), month: `${f.name}-${monthKey}`, notes: f.name })),
          ].filter(e => e.amount > 0);

          for (const entry of feeEntries) {
            try {
              await createFeeMutation.mutateAsync({
                data: {
                  studentId: student.id,
                  amount: entry.amount,
                  month: entry.month,
                  dueDate,
                  notes: entry.notes,
                } as never,
              });
            } catch { /* non-fatal */ }
          }

          // Build and print admission receipt
          const cls = classes?.find((c: any) => c.id === Number(values.classId));
          const admissionDate = new Date().toLocaleDateString("en-GB", {
            day: "2-digit", month: "short", year: "numeric",
          });

          const slipData: AdmissionData = {
            admissionNumber: student.admissionNumber,
            studentName:     values.name,
            fatherName:      values.fatherName || "",
            className:       cls?.name || "—",
            section:         values.section || "",
            rollNumber:      values.rollNumber || "",
            admissionDate,
            monthlyFee,
            admissionFee,
            examFee,
            annualFee,
            transportFee,
            booksFee,
            siblingDiscount,
            customFees,
            phone:   values.phone || "",
            address: values.address || "",
          };

          const logoSrc = `${window.location.origin}/kips-logo.jpeg`;
          const w = window.open("", "_blank", "width=820,height=900");
          if (w) {
            w.document.write(buildAdmissionReceiptHtml(slipData, logoSrc));
            w.document.close();
          } else {
            // Fallback if popup blocked
            const blob = new Blob([buildAdmissionReceiptHtml(slipData, logoSrc)], { type: "text/html" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.target = "_blank";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
          }

          queryClient.invalidateQueries({ queryKey: ["listStudents"] });
          queryClient.invalidateQueries({ queryKey: ["listFees"] });
          toast({ title: "Student admitted! Admission slip printing…" });
          setLocation("/students");
        },
        onError: () => toast({ variant: "destructive", title: "Failed to admit student" }),
      }
    );
  };

  const isPending = createMutation.isPending || uploadingImage;
  const selectedClass = classes?.find((c: any) => c.id === Number(watchedValues.classId));

  // ── Total fee summary ─────────────────────────────────────────────────────
  const totalFee =
    Number(watchedValues.feeAmount      || 0) +
    Number(watchedValues.admissionFee   || 0) +
    Number(watchedValues.examFee        || 0) +
    Number(watchedValues.annualFee      || 0) +
    Number(watchedValues.transportFee   || 0) +
    Number(watchedValues.booksFee       || 0) +
    customFees.reduce((s, f) => s + Number(f.amount || 0), 0) -
    Number(watchedValues.siblingDiscount || 0);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">New Student Admission</h1>
            <p className="text-gray-500 text-sm mt-0.5">Fill in the details to admit a new student</p>
          </div>
        </div>
        {/* Preview / Edit Toggle */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            type="button"
            size="sm"
            variant={mode === "edit" ? "default" : "ghost"}
            className="h-8 px-3 gap-1.5"
            onClick={() => setMode("edit")}
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "preview" ? "default" : "ghost"}
            className="h-8 px-3 gap-1.5"
            onClick={() => setMode("preview")}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </Button>
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PREVIEW MODE                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === "preview" && (
        <div className="space-y-4">
          {/* Photo */}
          <Card>
            <CardContent className="pt-5 flex items-center gap-5">
              <div className="w-20 h-20 rounded-full border-2 border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center shrink-0">
                {imagePreview
                  ? <img src={imagePreview} alt="Student" className="w-full h-full object-cover" />
                  : <User className="w-8 h-8 text-gray-300" />}
              </div>
              <div>
                <p className="text-xl font-bold text-gray-900">{watchedValues.name || "—"}</p>
                <p className="text-sm text-gray-500">
                  {selectedClass?.name || "—"}
                  {watchedValues.section ? ` — ${watchedValues.section}` : ""}
                  {watchedValues.rollNumber ? ` · Roll: ${watchedValues.rollNumber}` : ""}
                </p>
                <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium
                  ${watchedValues.status === "active" ? "bg-emerald-100 text-emerald-700" :
                    watchedValues.status === "inactive" ? "bg-gray-100 text-gray-600" :
                    "bg-red-100 text-red-700"}`}>
                  {watchedValues.status || "active"}
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Personal Info */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Personal Information</CardTitle></CardHeader>
              <CardContent className="space-y-0 pt-0">
                <PreviewRow label="Father's Name"    value={watchedValues.fatherName} />
                <PreviewRow label="Mother's Name"    value={watchedValues.motherName} />
                <PreviewRow label="Date of Birth"    value={watchedValues.dateOfBirth} />
                <PreviewRow label="Gender"           value={watchedValues.gender} />
                <PreviewRow label="Phone"            value={watchedValues.phone} />
                <PreviewRow label="Emergency"        value={watchedValues.emergencyContact} />
                <PreviewRow label="Address"          value={watchedValues.address} />
              </CardContent>
            </Card>

            {/* Fee Details */}
            <Card>
              <CardHeader><CardTitle className="text-sm">Fee Breakdown</CardTitle></CardHeader>
              <CardContent className="space-y-0 pt-0">
                <PreviewRow label="Monthly Fee"    value={watchedValues.feeAmount    ? `PKR ${Number(watchedValues.feeAmount).toLocaleString()}`    : undefined} />
                <PreviewRow label="Admission Fee"  value={watchedValues.admissionFee ? `PKR ${Number(watchedValues.admissionFee).toLocaleString()}`  : undefined} />
                <PreviewRow label="Exam Fee"       value={watchedValues.examFee      ? `PKR ${Number(watchedValues.examFee).toLocaleString()}`       : undefined} />
                <PreviewRow label="Annual Fee"     value={watchedValues.annualFee    ? `PKR ${Number(watchedValues.annualFee).toLocaleString()}`     : undefined} />
                <PreviewRow label="Transport Fee"  value={watchedValues.transportFee ? `PKR ${Number(watchedValues.transportFee).toLocaleString()}`  : undefined} />
                <PreviewRow label="Books Fee"      value={watchedValues.booksFee     ? `PKR ${Number(watchedValues.booksFee).toLocaleString()}`      : undefined} />
                {customFees.filter(f => f.name && Number(f.amount) > 0).map(f => (
                  <PreviewRow key={f.id} label={f.name} value={`PKR ${Number(f.amount).toLocaleString()}`} />
                ))}
                {Number(watchedValues.siblingDiscount) > 0 && (
                  <PreviewRow label="Sibling Discount" value={`− PKR ${Number(watchedValues.siblingDiscount).toLocaleString()}`} />
                )}
                <div className="flex items-center justify-between py-2 mt-1 border-t">
                  <span className="text-sm font-bold text-gray-700">Total First Payment</span>
                  <span className="text-base font-bold text-red-600">PKR {totalFee.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setMode("edit")}>
              <Pencil className="w-4 h-4 mr-1.5" /> Back to Edit
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={form.handleSubmit(onSubmit)}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8"
            >
              {isPending
                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />
                  {uploadingImage ? "Uploading Photo..." : "Saving..."}</>
                : <><Upload className="w-4 h-4 mr-2" /> Confirm & Admit</>}
            </Button>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* EDIT MODE                                                           */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mode === "edit" && (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

            {/* ── Photo Upload ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader><CardTitle className="text-base">Student Photo</CardTitle></CardHeader>
              <CardContent>
                <div className="flex items-center gap-6">
                  <div
                    className="w-28 h-28 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-indigo-400 transition-colors bg-gray-50"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview
                      ? <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      : <div className="text-center text-gray-400"><User className="w-10 h-10 mx-auto mb-1" /><p className="text-xs">No photo</p></div>}
                  </div>
                  <div className="space-y-2">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      {imagePreview ? "Change Photo" : "Upload Photo"}
                    </Button>
                    {imagePreview && (
                      <Button type="button" variant="ghost" className="text-red-500 text-sm"
                        onClick={() => { setImagePreview(null); setImageFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                        Remove
                      </Button>
                    )}
                    <p className="text-xs text-gray-400">JPG, PNG, WebP — max 5MB</p>
                  </div>
                </div>
                <input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={handleImageChange} />
              </CardContent>
            </Card>

            {/* ── Personal Info ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader><CardTitle className="text-base">Personal Information</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl><Input placeholder="Student full name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="fatherName" render={({ field }) => (
                  <FormItem><FormLabel>Father's Name</FormLabel><FormControl><Input placeholder="Father name" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="motherName" render={({ field }) => (
                  <FormItem><FormLabel>Mother's Name</FormLabel><FormControl><Input placeholder="Mother name" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                  <FormItem><FormLabel>Date of Birth</FormLabel><FormControl><Input type="date" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="gender" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input placeholder="0300-1234567" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                  <FormItem><FormLabel>Emergency Contact</FormLabel><FormControl><Input placeholder="Emergency number" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="address" render={({ field }) => (
                  <FormItem className="sm:col-span-2"><FormLabel>Address</FormLabel><FormControl><Input placeholder="Full address" {...field} /></FormControl></FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ── Academic Info ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader><CardTitle className="text-base">Academic Details</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField control={form.control} name="classId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Class *</FormLabel>
                    <Select
                      onValueChange={(v) => handleClassChange(v, field.onChange)}
                      value={field.value}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {classes?.map((cls: any) => (
                          <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <p className="text-xs text-blue-600">Class select karne par fees auto-fill hongi</p>
                  </FormItem>
                )} />
                <FormField control={form.control} name="section" render={({ field }) => (
                  <FormItem><FormLabel>Section</FormLabel><FormControl><Input placeholder="A" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="rollNumber" render={({ field }) => (
                  <FormItem><FormLabel>Roll Number</FormLabel><FormControl><Input placeholder="01" {...field} /></FormControl></FormItem>
                )} />
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
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
              </CardContent>
            </Card>

            {/* ── Fee Details ───────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Fee Details</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Class select karne par fees auto-fill hongi — aap edit bhi kar sakte hain</p>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField control={form.control} name="feeAmount" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Fee (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="admissionFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Admission Fee (PKR) <span className="text-xs text-indigo-600 font-normal">One-time</span></FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="examFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Exam Fee (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="annualFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Annual Fee (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="transportFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Transport Fee (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="booksFee" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Books Fee (PKR)</FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="siblingDiscount" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        Sibling Discount (PKR)
                        <span className="text-xs text-blue-600 font-normal">(if applicable)</span>
                      </FormLabel>
                      <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                      <p className="text-xs text-gray-500">Siblings hone par monthly fee se discount</p>
                    </FormItem>
                  )} />
                </div>

                {/* ── Custom Fees ────────────────────────────────────────── */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Additional Fees</p>
                      <p className="text-xs text-gray-500">Koi bhi extra fee add karo — jaise library fee, sports fee, etc.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addCustomFee} className="gap-1.5 h-8">
                      <Plus className="w-3.5 h-3.5" /> Add Fee
                    </Button>
                  </div>
                  {customFees.length === 0 && (
                    <div className="text-center py-4 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 text-sm">
                      Koi additional fee nahi — "Add Fee" button dabaen
                    </div>
                  )}
                  <div className="space-y-2">
                    {customFees.map((fee) => (
                      <div key={fee.id} className="flex items-center gap-2">
                        <Input
                          placeholder="Fee ka naam (e.g. Library Fee)"
                          value={fee.name}
                          onChange={(e) => updateCustomFee(fee.id, "name", e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          type="number"
                          min="0"
                          placeholder="Amount (PKR)"
                          value={fee.amount}
                          onChange={(e) => updateCustomFee(fee.id, "amount", e.target.value)}
                          className="w-36"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-700 shrink-0"
                          onClick={() => removeCustomFee(fee.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Total Summary ──────────────────────────────────────── */}
                {totalFee > 0 && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
                    <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide mb-2">Fee Summary</p>
                    <div className="space-y-1 text-sm">
                      {Number(watchedValues.feeAmount)     > 0 && <div className="flex justify-between"><span className="text-gray-600">Monthly Fee</span><span className="font-medium">PKR {Number(watchedValues.feeAmount).toLocaleString()}</span></div>}
                      {Number(watchedValues.admissionFee)  > 0 && <div className="flex justify-between"><span className="text-gray-600">Admission Fee</span><span className="font-medium">PKR {Number(watchedValues.admissionFee).toLocaleString()}</span></div>}
                      {Number(watchedValues.examFee)       > 0 && <div className="flex justify-between"><span className="text-gray-600">Exam Fee</span><span className="font-medium">PKR {Number(watchedValues.examFee).toLocaleString()}</span></div>}
                      {Number(watchedValues.annualFee)     > 0 && <div className="flex justify-between"><span className="text-gray-600">Annual Fee</span><span className="font-medium">PKR {Number(watchedValues.annualFee).toLocaleString()}</span></div>}
                      {Number(watchedValues.transportFee)  > 0 && <div className="flex justify-between"><span className="text-gray-600">Transport Fee</span><span className="font-medium">PKR {Number(watchedValues.transportFee).toLocaleString()}</span></div>}
                      {Number(watchedValues.booksFee)      > 0 && <div className="flex justify-between"><span className="text-gray-600">Books Fee</span><span className="font-medium">PKR {Number(watchedValues.booksFee).toLocaleString()}</span></div>}
                      {customFees.filter(f => Number(f.amount) > 0 && f.name).map(f => (
                        <div key={f.id} className="flex justify-between">
                          <span className="text-gray-600">{f.name}</span>
                          <span className="font-medium">PKR {Number(f.amount).toLocaleString()}</span>
                        </div>
                      ))}
                      {Number(watchedValues.siblingDiscount) > 0 && (
                        <div className="flex justify-between text-emerald-600"><span>Sibling Discount</span><span>− PKR {Number(watchedValues.siblingDiscount).toLocaleString()}</span></div>
                      )}
                    </div>
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-indigo-200">
                      <span className="text-sm font-bold text-gray-800">Total First Payment</span>
                      <span className="text-base font-bold text-red-600">PKR {totalFee.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Action Buttons ────────────────────────────────────────────── */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setLocation("/students")}>Cancel</Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMode("preview")}
                className="gap-1.5"
              >
                <Eye className="w-4 h-4" /> Preview
              </Button>
              <Button type="submit" disabled={isPending} className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8">
                {isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />{uploadingImage ? "Uploading Photo..." : "Saving..."}</>
                  : <><Upload className="w-4 h-4 mr-2" /> Admit Student</>}
              </Button>
            </div>
          </form>
        </Form>
      )}
    </div>
  );
}
