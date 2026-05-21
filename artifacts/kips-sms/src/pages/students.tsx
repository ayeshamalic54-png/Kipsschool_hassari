import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useGetStudent, useUpdateStudent, useListClasses,
  getGetStudentQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, User, Phone, MapPin, BookOpen, Calendar,
  Printer, Pencil, Eye, Loader2, Save, X,
} from "lucide-react";

// ── Edit schema ───────────────────────────────────────────────────────────────
const editSchema = z.object({
  name:             z.string().min(1, "Name is required"),
  fatherName:       z.string().optional(),
  motherName:       z.string().optional(),
  dateOfBirth:      z.string().optional(),
  gender:           z.enum(["male", "female"]).optional(),
  phone:            z.string().optional(),
  emergencyContact: z.string().optional(),
  address:          z.string().optional(),
  classId:          z.string().optional(),
  section:          z.string().optional(),
  rollNumber:       z.string().optional(),
  feeAmount:        z.string().optional(),
  siblingDiscount:  z.string().optional(),
  status:           z.enum(["active", "inactive", "left"]),
});

type EditValues = z.infer<typeof editSchema>;

// ── Small helper ──────────────────────────────────────────────────────────────
function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b last:border-0">
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide w-36 shrink-0 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-gray-900 font-medium">{value || "—"}</span>
    </div>
  );
}

const statusColors: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  left:     "bg-red-100 text-red-700 border-red-200",
};

// ── Main Component ────────────────────────────────────────────────────────────
export default function StudentDetail() {
  const [, params]    = useRoute("/students/:id");
  const [, setLocation] = useLocation();
  const { toast }     = useToast();
  const queryClient   = useQueryClient();
  const studentId     = Number(params?.id);

  const [mode, setMode] = useState<"view" | "edit">("view");

  const { data: student, isLoading } = useGetStudent(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) },
  });

  const { data: classes } = useListClasses();
  const updateMutation    = useUpdateStudent();

  // ── Edit form ─────────────────────────────────────────────────────────────
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { status: "active" },
  });

  // Populate form when entering edit mode
  const enterEdit = () => {
    if (!student) return;
    form.reset({
      name:             student.name ?? "",
      fatherName:       student.fatherName ?? "",
      motherName:       student.motherName ?? "",
      dateOfBirth:      (student as any).dateOfBirth ?? "",
      gender:           ((student as any).gender as "male" | "female") ?? undefined,
      phone:            student.phone ?? "",
      emergencyContact: (student as any).emergencyContact ?? "",
      address:          student.address ?? "",
      classId:          String((student as any).classId ?? ""),
      section:          student.section ?? "",
      rollNumber:       student.rollNumber ?? "",
      feeAmount:        student.feeAmount != null ? String(student.feeAmount) : "",
      siblingDiscount:  (student as any).siblingDiscount != null ? String((student as any).siblingDiscount) : "0",
      status:           (student.status as "active" | "inactive" | "left") ?? "active",
    });
    setMode("edit");
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const onSubmit = (values: EditValues) => {
    updateMutation.mutate(
      {
        id: studentId,
        data: {
          ...values,
          classId:         values.classId         ? Number(values.classId)         : undefined,
          feeAmount:       values.feeAmount        ? Number(values.feeAmount)        : undefined,
          siblingDiscount: values.siblingDiscount  ? Number(values.siblingDiscount)  : 0,
        } as never,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
          toast({ title: "Student record updated successfully" });
          setMode("view");
        },
        onError: () => toast({ variant: "destructive", title: "Failed to update student" }),
      }
    );
  };

  // ── Loading / Not Found ───────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="text-center py-20 text-gray-500">
        <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Student not found</p>
        <Button variant="link" onClick={() => setLocation("/students")} className="mt-2">
          Back to Students
        </Button>
      </div>
    );
  }

  const selectedClass = classes?.find((c: any) => c.id === Number((student as any).classId));

  // ════════════════════════════════════════════════════════════════════════════
  // VIEW MODE
  // ════════════════════════════════════════════════════════════════════════════
  if (mode === "view") {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
              <p className="text-gray-500 text-sm font-mono">{(student as any).admissionNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${statusColors[student.status ?? "active"] ?? statusColors.active}`}>
              {student.status}
            </span>
            <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Button
              size="sm"
              onClick={enterEdit}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              data-testid="button-edit"
            >
              <Pencil className="w-4 h-4" /> Edit Student
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Personal Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              {student.imageUrl && (
                <div className="mb-4">
                  <img
                    src={student.imageUrl}
                    alt={student.name}
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                </div>
              )}
              <div className="space-y-0">
                <InfoRow label="Father Name"       value={(student as any).fatherName} />
                <InfoRow label="Mother Name"       value={(student as any).motherName} />
                <InfoRow label="Date of Birth"     value={(student as any).dateOfBirth} />
                <InfoRow label="Gender"            value={(student as any).gender
                  ? ((student as any).gender as string).charAt(0).toUpperCase() + ((student as any).gender as string).slice(1)
                  : undefined} />
                <InfoRow label="Phone"             value={student.phone} />
                <InfoRow label="Emergency Contact" value={(student as any).emergencyContact} />
                <InfoRow label="Address"           value={student.address} />
                <InfoRow label="Username"          value={(student as any).username} />
              </div>
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-4">
            {/* Academic */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-purple-600" /> Academic Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Class"       value={(student as any).className} />
                <InfoRow label="Section"     value={student.section} />
                <InfoRow label="Roll Number" value={student.rollNumber} />
              </CardContent>
            </Card>

            {/* Fee Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" /> Fee Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Monthly Fee"     value={student.feeAmount != null ? `PKR ${Number(student.feeAmount).toLocaleString()}` : undefined} />
                <InfoRow label="Sibling Discount" value={(student as any).siblingDiscount && Number((student as any).siblingDiscount) > 0
                  ? `PKR ${Number((student as any).siblingDiscount).toLocaleString()}`
                  : undefined} />
              </CardContent>
            </Card>

            {/* Joined */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-orange-500" /> Admission
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-0">
                <InfoRow label="Admission No." value={(student as any).admissionNumber} />
                <InfoRow label="Joined"        value={student.createdAt
                  ? new Date(student.createdAt).toLocaleDateString("en-PK", { dateStyle: "medium" })
                  : undefined} />
                <InfoRow label="Status"        value={student.status} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // EDIT MODE — Admin full control
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setMode("view")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Student</h1>
            <p className="text-gray-500 text-sm font-mono">{(student as any).admissionNumber} — {student.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            type="button" size="sm"
            variant="default"
            className="h-8 px-3 gap-1.5"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </Button>
          <Button
            type="button" size="sm"
            variant="ghost"
            className="h-8 px-3 gap-1.5"
            onClick={() => setMode("view")}
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </Button>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

          {/* ── Personal Info ─────────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Full Name *</FormLabel>
                  <FormControl><Input placeholder="Student full name" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="fatherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Father's Name</FormLabel>
                  <FormControl><Input placeholder="Father name" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="motherName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Mother's Name</FormLabel>
                  <FormControl><Input placeholder="Mother name" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="dateOfBirth" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl><Input placeholder="0300-1234567" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="emergencyContact" render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact</FormLabel>
                  <FormControl><Input placeholder="Emergency number" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Address</FormLabel>
                  <FormControl><Input placeholder="Full address" {...field} /></FormControl>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Academic Details ──────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-purple-600" /> Academic Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="classId" render={({ field }) => (
                <FormItem>
                  <FormLabel>Class</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classes?.map((cls: any) => (
                        <SelectItem key={cls.id} value={String(cls.id)}>{cls.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="section" render={({ field }) => (
                <FormItem>
                  <FormLabel>Section</FormLabel>
                  <FormControl><Input placeholder="A" {...field} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="rollNumber" render={({ field }) => (
                <FormItem>
                  <FormLabel>Roll Number</FormLabel>
                  <FormControl><Input placeholder="01" {...field} /></FormControl>
                </FormItem>
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
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" /> Fee Details
              </CardTitle>
              <p className="text-xs text-gray-500 mt-0.5">Monthly fee aur discount update karein</p>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField control={form.control} name="feeAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Monthly Fee (PKR)</FormLabel>
                  <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                  <p className="text-xs text-gray-500">Har mahina ki regular fee</p>
                </FormItem>
              )} />
              <FormField control={form.control} name="siblingDiscount" render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-1">
                    Sibling Discount (PKR)
                    <span className="text-xs text-blue-600 font-normal">(if applicable)</span>
                  </FormLabel>
                  <FormControl><Input type="number" min="0" placeholder="0" {...field} /></FormControl>
                  <p className="text-xs text-gray-500">Monthly fee se monthly discount</p>
                </FormItem>
              )} />
            </CardContent>
          </Card>

          {/* ── Action Buttons ────────────────────────────────────────────── */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setMode("view")}
              className="gap-1.5"
            >
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-8 gap-1.5"
              data-testid="button-save"
            >
              {updateMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                : <><Save className="w-4 h-4" /> Save Changes</>}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

