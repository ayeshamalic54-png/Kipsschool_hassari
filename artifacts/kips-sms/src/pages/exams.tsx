import { useState } from "react";
import {
  useListExams, useCreateExam, useListClasses, useListStudents, getListExamsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Loader2, FileText, Calendar, Trophy, Star, BookOpen,
  Printer, ChevronRight, Award, TrendingUp, ClipboardList,
} from "lucide-react";
import { useAuthStore } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Schemas ──────────────────────────────────────────────────────────────────
const examSchema = z.object({
  name:         z.string().min(1, "Name required"),
  classId:      z.string().min(1, "Class required"),
  subject:      z.string().min(1, "Subject required"),
  examDate:     z.string().min(1, "Date required"),
  totalMarks:   z.string().min(1, "Total marks required"),
  passingMarks: z.string().optional(),
});

const resultSchema = z.object({
  studentId:     z.string().min(1, "Student required"),
  marksObtained: z.string().min(1, "Marks required"),
  remarks:       z.string().optional(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
type ExamResult = {
  id: number;
  examId: number;
  studentId: number;
  studentName: string | null;
  marksObtained: number;
  grade: string;
  position: number | null;
  remarks: string | null;
};

type ExamInfo = {
  id: number;
  name: string;
  subject: string;
  totalMarks: number;
  passingMarks: number;
  examDate: string;
  className?: string | null;
  classId: number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gradeColor(grade: string) {
  if (grade === "A+" || grade === "A") return "text-emerald-700 bg-emerald-100 border-emerald-300";
  if (grade === "B") return "text-blue-700 bg-blue-100 border-blue-300";
  if (grade === "C") return "text-amber-700 bg-amber-100 border-amber-300";
  if (grade === "D") return "text-orange-700 bg-orange-100 border-orange-300";
  return "text-red-700 bg-red-100 border-red-300";
}

function calcGrade(marks: number, total: number): string {
  const pct = (marks / total) * 100;
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B";
  if (pct >= 60) return "C";
  if (pct >= 50) return "D";
  return "F";
}

function gradientForSubject(subject: string) {
  const s = subject.toLowerCase();
  if (s.includes("math"))                        return "from-blue-500 to-cyan-500";
  if (s.includes("eng"))                         return "from-violet-500 to-fuchsia-500";
  if (s.includes("urdu"))                        return "from-emerald-500 to-teal-500";
  if (s.includes("science") || s.includes("bio")) return "from-green-500 to-lime-500";
  if (s.includes("phys"))                        return "from-orange-500 to-amber-500";
  if (s.includes("chem"))                        return "from-pink-500 to-rose-500";
  if (s.includes("hist") || s.includes("geo"))   return "from-amber-400 to-yellow-500";
  if (s.includes("islam"))                       return "from-teal-500 to-cyan-500";
  return "from-violet-500 to-fuchsia-500";
}

// ─── Student Result Card ──────────────────────────────────────────────────────
function StudentResultView({ result, exam }: { result: ExamResult; exam: ExamInfo }) {
  const pct    = Math.round((result.marksObtained / exam.totalMarks) * 100);
  const passed = result.marksObtained >= exam.passingMarks;

  return (
    <div className="space-y-5">
      <div className={`rounded-2xl p-6 text-center ${
        passed
          ? "bg-gradient-to-br from-emerald-500 to-green-600"
          : "bg-gradient-to-br from-red-500 to-rose-600"
      }`}>
        <div className="flex justify-center mb-3">
          {passed
            ? <Award className="w-12 h-12 text-white/90" />
            : <BookOpen className="w-12 h-12 text-white/90" />}
        </div>
        <p className="text-white/80 text-sm font-medium uppercase tracking-wide mb-1">{exam.subject}</p>
        <p className="text-white text-5xl font-black">{result.marksObtained}</p>
        <p className="text-white/70 text-sm mt-1">out of {exam.totalMarks} marks</p>
        <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5">
          <span className="text-white font-bold text-lg">{pct}%</span>
          <span className="text-white/80 text-sm">• Grade {result.grade}</span>
        </div>
        <p className={`mt-3 text-sm font-bold ${passed ? "text-emerald-100" : "text-red-100"}`}>
          {passed ? "✓ PASSED" : "✗ FAILED"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Exam",          value: exam.name              },
          { label: "Class",         value: exam.className ?? "—"  },
          { label: "Date",          value: exam.examDate           },
          { label: "Passing Marks", value: String(exam.passingMarks) },
          ...(result.position ? [{ label: "Position", value: `#${result.position}` }] : []),
        ].map(item => (
          <div key={item.label} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{item.label}</p>
            <p className="text-gray-900 font-semibold mt-0.5">{item.value}</p>
          </div>
        ))}
      </div>

      {result.remarks && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Teacher's Remarks</p>
          <p className="text-blue-900 text-sm">{result.remarks}</p>
        </div>
      )}
    </div>
  );
}

// ─── TASK 9: Bulk Result Entry ────────────────────────────────────────────────
type BulkEntry = {
  studentId:   number;
  studentName: string;
  marks:       string;
  remarks:     string;
};

function BulkResultEntry({ exam, students, onSaved }: {
  exam:     ExamInfo;
  students: Array<{ id: number; name: string; classId?: number | null }>;
  onSaved:  () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const classStudents = students.filter(s => s.classId === exam.classId);

  const [entries, setEntries] = useState<BulkEntry[]>(
    classStudents.map(s => ({ studentId: s.id, studentName: s.name, marks: "", remarks: "" }))
  );

  const setMarks   = (id: number, marks: string)   =>
    setEntries(prev => prev.map(e => e.studentId === id ? { ...e, marks   } : e));
  const setRemarks = (id: number, remarks: string) =>
    setEntries(prev => prev.map(e => e.studentId === id ? { ...e, remarks } : e));

  const handleSave = async () => {
    const toSave = entries.filter(e => e.marks.trim() !== "" && !isNaN(Number(e.marks)));
    if (!toSave.length) {
      toast({ variant: "destructive", title: "No marks have been entered for anyone" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/exams/${exam.id}/results/bulk`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body:    JSON.stringify({
          entries: toSave.map(e => ({
            studentId:     e.studentId,
            marksObtained: Number(e.marks),
            remarks:       e.remarks || null,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as { saved: number };
      toast({ title: `✓ ${data.saved} students' results saved successfully` });
      onSaved();
    } catch {
      toast({ variant: "destructive", title: "Failed to save bulk results" });
    } finally {
      setSaving(false);
    }
  };

  const filled = entries.filter(e => e.marks.trim() !== "").length;

  if (classStudents.length === 0) {
    return (
      <div className="py-10 text-center text-gray-400">
        <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">No students found in this class</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{filled} / {entries.length} students ke marks entered</p>
        <Button
          onClick={handleSave}
          disabled={saving || filled === 0}
          className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
        >
          {saving
            ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
            : <><ClipboardList className="w-4 h-4 mr-2" /> Save All ({filled})</>
          }
        </Button>
      </div>

      <div className="rounded-lg border overflow-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left py-2.5 px-3 font-semibold text-gray-600">#</th>
              <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Student</th>
              <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Marks (/{exam.totalMarks})</th>
              <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Grade</th>
              <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Remarks (optional)</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, i) => {
              const marksNum = Number(entry.marks);
              const grade    = entry.marks && !isNaN(marksNum) ? calcGrade(marksNum, exam.totalMarks) : null;
              return (
                <tr key={entry.studentId} className="border-t hover:bg-gray-50">
                  <td className="py-2 px-3 text-gray-400 text-xs">{i + 1}</td>
                  <td className="py-2 px-3 font-medium text-gray-900">{entry.studentName}</td>
                  <td className="py-2 px-3">
                    <Input
                      type="number"
                      min={0}
                      max={exam.totalMarks}
                      placeholder={`0–${exam.totalMarks}`}
                      value={entry.marks}
                      onChange={e => setMarks(entry.studentId, e.target.value)}
                      className="h-8 w-24 text-center mx-auto"
                    />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {grade ? (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${gradeColor(grade)}`}>
                        {grade}
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Input
                      placeholder="Optional..."
                      value={entry.remarks}
                      onChange={e => setRemarks(entry.studentId, e.target.value)}
                      className="h-8 text-xs"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Admin Results View ───────────────────────────────────────────────────────
function AdminResultsView({ examId, exam, students, onAdded }: {
  examId:   number;
  exam:     ExamInfo;
  students: Array<{ id: number; name: string; classId?: number | null }>;
  onAdded:  () => void;
}) {
  const { toast }  = useToast();
  const [results,  setResults]  = useState<ExamResult[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [addOpen,  setAddOpen]  = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [saving,   setSaving]   = useState(false);

  const form = useForm<z.infer<typeof resultSchema>>({
    resolver: zodResolver(resultSchema),
    defaultValues: { marksObtained: "", remarks: "" },
  });

  const fetchResults = () => {
    setLoading(true);
    fetch(`/api/exams/${examId}/results`, { headers: authHeader() as HeadersInit })
      .then(r => r.json())
      .then(d => setResults(Array.isArray(d) ? d : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  };

  // fetch on mount
  useState(() => { fetchResults(); });

  // Students filtered to this exam's class
  const classStudents = students.filter(s => s.classId === exam.classId);

  const onSubmit = (values: z.infer<typeof resultSchema>) => {
    const marks = Number(values.marksObtained);
    const grade = calcGrade(marks, exam.totalMarks);
    setSaving(true);
    fetch(`/api/exams/${examId}/results`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body:    JSON.stringify({
        studentId:     Number(values.studentId),
        marksObtained: marks,
        grade,
        remarks:       values.remarks || null,
      }),
    })
      .then(r => r.json())
      .then(() => {
        toast({ title: "Result saved" });
        setAddOpen(false);
        form.reset();
        fetchResults();
        onAdded();
      })
      .catch(() => toast({ variant: "destructive", title: "Failed to save result" }))
      .finally(() => setSaving(false));
  };

  const deleteResult = (id: number) => {
    if (!confirm("Delete this result?")) return;
    fetch(`/api/exams/${examId}/results/${id}`, {
      method: "DELETE", headers: authHeader() as HeadersInit,
    }).then(() => fetchResults());
  };

  const totalStudents = results.length;
  const passed   = results.filter(r => r.marksObtained >= exam.passingMarks).length;
  const topScore = results.length ? Math.max(...results.map(r => r.marksObtained)) : 0;
  const avg      = results.length
    ? Math.round(results.reduce((s, r) => s + r.marksObtained, 0) / results.length)
    : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      {results.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Total",     value: totalStudents, gradient: "from-blue-500 to-cyan-500"     },
            { label: "Passed",    value: passed,        gradient: "from-emerald-500 to-green-500" },
            { label: "Average",   value: avg,           gradient: "from-violet-500 to-purple-600" },
            { label: "Top Score", value: topScore,      gradient: "from-amber-400 to-orange-500"  },
          ].map(c => (
            <Card key={c.label} className="overflow-hidden border-0 shadow-sm">
              <CardContent className="p-0">
                <div className={`bg-gradient-to-br ${c.gradient} px-3 py-2.5`}>
                  <p className="text-white/80 text-[10px] font-medium uppercase tracking-wide">{c.label}</p>
                  <p className="text-white text-xl font-bold">{c.value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{results.length} results entered</p>
        <div className="flex gap-2">
          {/* TASK 9: Bulk entry button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setBulkOpen(true)}
            className="border-violet-300 text-violet-700 hover:bg-violet-50"
          >
            <ClipboardList className="w-3.5 h-3.5 mr-1" /> Bulk Entry
          </Button>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Single
          </Button>
        </div>
      </div>

      {/* TASK 9: Bulk Entry Dialog */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-violet-600" />
              Bulk Result Entry — {exam.name} ({exam.subject})
            </DialogTitle>
          </DialogHeader>
          <BulkResultEntry
            exam={exam}
            students={students}
            onSaved={() => { setBulkOpen(false); fetchResults(); onAdded(); }}
          />
        </DialogContent>
      </Dialog>

      {/* Single Add Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Student Result</DialogTitle></DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="studentId" render={({ field }) => (
                <FormItem><FormLabel>Student *</FormLabel>
                  <Select onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {classStudents.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select><FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="marksObtained" render={({ field }) => (
                <FormItem>
                  <FormLabel>Marks Obtained * (out of {exam.totalMarks})</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} max={exam.totalMarks} placeholder="e.g. 85" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="remarks" render={({ field }) => (
                <FormItem><FormLabel>Remarks</FormLabel>
                  <FormControl><Input placeholder="Optional teacher remarks..." {...field} /></FormControl>
                </FormItem>
              )} />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Save Result
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Results Table */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : results.length === 0 ? (
        <div className="py-12 text-center text-gray-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No results yet. Use Bulk Entry or Add Single.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-600">#</th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Student</th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Marks</th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600">%</th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Grade</th>
                <th className="text-center py-2.5 px-3 font-semibold text-gray-600">Status</th>
                <th className="text-left py-2.5 px-3 font-semibold text-gray-600">Remarks</th>
                <th className="py-2.5 px-3" />
              </tr>
            </thead>
            <tbody>
              {[...results]
                .sort((a, b) => b.marksObtained - a.marksObtained)
                .map((r, i) => {
                  const pct    = Math.round((r.marksObtained / exam.totalMarks) * 100);
                  const passed = r.marksObtained >= exam.passingMarks;
                  return (
                    <tr key={r.id} className={`border-t hover:bg-gray-50 ${i === 0 ? "bg-amber-50/40" : ""}`}>
                      <td className="py-2.5 px-3 text-gray-500 font-medium">
                        {i === 0 ? <Trophy className="w-4 h-4 text-amber-500" /> : i + 1}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{r.studentName ?? "—"}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-gray-800">
                        {r.marksObtained} / {exam.totalMarks}
                      </td>
                      <td className="py-2.5 px-3 text-center text-gray-600">{pct}%</td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${gradeColor(r.grade)}`}>
                          {r.grade}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          passed ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                          {passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-gray-500 text-xs">{r.remarks ?? "—"}</td>
                      <td className="py-2.5 px-3">
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                          onClick={() => deleteResult(r.id)}
                        >
                          ×
                        </Button>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => window.print()}>
          <Printer className="w-3.5 h-3.5 mr-1" /> Print Results
        </Button>
      </div>
    </div>
  );
}

// ─── Main Exams Page ──────────────────────────────────────────────────────────
export default function Exams() {
  const [createOpen,   setCreateOpen]   = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamInfo | null>(null);
  const [studentResult, setStudentResult] = useState<ExamResult | null | "none">(null);
  const [loadingResult, setLoadingResult] = useState(false);

  const { toast }      = useToast();
  const queryClient    = useQueryClient();
  // TASK 6: Backend now filters exams by student's classId automatically
  const { data: exams, isLoading } = useListExams();
  const { data: classes }          = useListClasses();
  const { data: students }         = useListStudents({ status: "active" });
  const createMutation = useCreateExam();
  const { user }       = useAuthStore();
  const isStudent      = user?.role === "student";

  const form = useForm<z.infer<typeof examSchema>>({
    resolver: zodResolver(examSchema),
    defaultValues: { passingMarks: "40" },
  });

  const onSubmit = (values: z.infer<typeof examSchema>) => {
    createMutation.mutate({
      data: {
        ...values,
        classId:      Number(values.classId),
        totalMarks:   Number(values.totalMarks),
        passingMarks: Number(values.passingMarks ?? 40),
      },
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
        toast({ title: "Exam scheduled" });
        setCreateOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to schedule exam" }),
    });
  };

  // TASK 6: Student sees only their class exams (backend filters), result also filtered by student
  const openExam = (exam: ExamInfo) => {
    setSelectedExam(exam);
    if (isStudent) {
      setStudentResult(null);
      setLoadingResult(true);
      fetch(`/api/exams/${exam.id}/results`, { headers: authHeader() as HeadersInit })
        .then(r => r.json())
        .then((d: ExamResult[]) =>
          setStudentResult(Array.isArray(d) && d.length > 0 ? d[0] : "none")
        )
        .catch(() => setStudentResult("none"))
        .finally(() => setLoadingResult(false));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams & Results</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isStudent
              ? "Your class exam schedule and your results"
              : "Manage exams, schedule tests and enter student results"}
          </p>
        </div>
        {!isStudent && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white"
                data-testid="button-add-exam"
              >
                <Plus className="w-4 h-4 mr-2" /> Schedule Exam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule New Exam</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Exam Name *</FormLabel>
                      <FormControl><Input placeholder="e.g. Mid-Term 2026" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="classId" render={({ field }) => (
                    <FormItem><FormLabel>Class *</FormLabel>
                      <Select onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                        <SelectContent>
                          {classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>Subject *</FormLabel>
                      <FormControl><Input placeholder="Mathematics" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="examDate" render={({ field }) => (
                    <FormItem><FormLabel>Exam Date *</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="totalMarks" render={({ field }) => (
                      <FormItem><FormLabel>Total Marks *</FormLabel>
                        <FormControl><Input type="number" placeholder="100" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={form.control} name="passingMarks" render={({ field }) => (
                      <FormItem><FormLabel>Passing Marks</FormLabel>
                        <FormControl><Input type="number" placeholder="40" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Schedule
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Student summary cards */}
      {isStudent && exams && exams.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Exams",  value: exams.length,                                                 gradient: "from-violet-500 to-fuchsia-500", icon: FileText  },
            { label: "Subjects",     value: new Set(exams.map(e => e.subject)).size,                      gradient: "from-blue-500 to-cyan-500",       icon: BookOpen  },
            { label: "Upcoming",     value: exams.filter(e => new Date(e.examDate) >= new Date()).length, gradient: "from-amber-400 to-orange-500",    icon: Calendar  },
          ].map((c, i) => (
            <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="overflow-hidden border-0 shadow-sm">
                <CardContent className="p-0">
                  <div className={`bg-gradient-to-br ${c.gradient} p-4 flex items-center justify-between`}>
                    <div>
                      <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                      <p className="text-white text-2xl font-bold mt-1">{c.value}</p>
                    </div>
                    <div className="bg-white/20 rounded-xl p-2">
                      <c.icon className="w-5 h-5 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Exam cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-44 w-full rounded-xl" />)}
        </div>
      ) : !exams?.length ? (
        <div className="py-20 text-center text-gray-400">
          <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-base font-medium">No exams scheduled</p>
          {!isStudent && <p className="text-sm mt-1">Click "Schedule Exam" to add one</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {exams.map((exam, idx) => (
              <motion.div
                key={exam.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card
                  className="hover:shadow-md transition-all duration-200 border border-gray-100 cursor-pointer group"
                  onClick={() => openExam({
                    id:           exam.id,
                    name:         exam.name,
                    subject:      exam.subject,
                    totalMarks:   Number(exam.totalMarks),
                    passingMarks: Number(exam.passingMarks),
                    examDate:     exam.examDate,
                    className:    exam.className,
                    classId:      exam.classId,
                  })}
                  data-testid={`card-exam-${exam.id}`}
                >
                  <CardContent className="p-0">
                    <div className={`bg-gradient-to-r ${gradientForSubject(exam.subject)} h-1.5 rounded-t-lg`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradientForSubject(exam.subject)} flex items-center justify-center shadow-sm`}>
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                          {exam.className ?? "—"}
                        </span>
                      </div>
                      <h3 className="font-bold text-gray-900 leading-tight">{exam.name}</h3>
                      <p className="text-sm font-medium text-violet-600 mt-0.5">{exam.subject}</p>
                      <div className="mt-4 flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{exam.examDate}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Star className="w-3.5 h-3.5" />
                          <span>{exam.totalMarks} marks</span>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-400">Pass: {exam.passingMarks} marks</span>
                        <span className="text-xs font-medium text-violet-600 flex items-center gap-0.5 group-hover:gap-1.5 transition-all">
                          {isStudent ? "My Result" : "View Results"}
                          <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Results Modal */}
      <Dialog
        open={!!selectedExam}
        onOpenChange={open => { if (!open) { setSelectedExam(null); setStudentResult(null); } }}
      >
        <DialogContent className={isStudent ? "max-w-sm" : "max-w-4xl"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isStudent ? (
                <><TrendingUp className="w-5 h-5 text-violet-600" /> My Result — {selectedExam?.subject}</>
              ) : (
                <><Trophy className="w-5 h-5 text-amber-500" /> Results — {selectedExam?.name} ({selectedExam?.subject})</>
              )}
            </DialogTitle>
          </DialogHeader>

          {isStudent ? (
            loadingResult ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-40 w-full rounded-2xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-16 rounded-xl" />
                  <Skeleton className="h-16 rounded-xl" />
                </div>
              </div>
            ) : studentResult === "none" ? (
              <div className="py-16 text-center text-gray-400">
                <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Result not entered yet</p>
                <p className="text-xs mt-1">Please check back after result declaration</p>
              </div>
            ) : studentResult ? (
              <StudentResultView result={studentResult} exam={selectedExam!} />
            ) : null
          ) : (
            selectedExam && (
              <AdminResultsView
                examId={selectedExam.id}
                exam={selectedExam}
                students={students ?? []}
                onAdded={() => queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() })}
              />
            )
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
