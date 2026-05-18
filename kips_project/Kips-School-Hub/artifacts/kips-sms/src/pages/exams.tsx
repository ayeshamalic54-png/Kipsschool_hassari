import { useState } from "react";
import { useListExams, useCreateExam, useGetExamResults, useListClasses, getListExamsQueryKey } from "@workspace/api-client-react";
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
import { Plus, Loader2, FileText, Calendar, CheckCircle, XCircle, Trophy } from "lucide-react";
import { useAuthStore } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(1, "Name required"),
  classId: z.string().min(1, "Class required"),
  subject: z.string().min(1, "Subject required"),
  examDate: z.string().min(1, "Date required"),
  totalMarks: z.string().min(1, "Total marks required"),
  passingMarks: z.string().optional(),
});

function StudentExamCard({ exam }: { exam: { id: number; name: string; subject: string; examDate?: string | null; totalMarks: number; passingMarks?: number | null; className?: string | null } }) {
  const { data: results, isLoading } = useGetExamResults(exam.id);
  const result = results?.[0];

  const passed = result && result.obtainedMarks != null
    ? result.obtainedMarks >= (exam.passingMarks ?? 40)
    : null;

  const percentage = result?.obtainedMarks != null
    ? Math.round((result.obtainedMarks / exam.totalMarks) * 100)
    : null;

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: "A+", color: "text-emerald-600" };
    if (pct >= 80) return { label: "A", color: "text-emerald-500" };
    if (pct >= 70) return { label: "B", color: "text-blue-600" };
    if (pct >= 60) return { label: "C", color: "text-amber-600" };
    if (pct >= 50) return { label: "D", color: "text-orange-500" };
    return { label: "F", color: "text-red-600" };
  };

  const grade = percentage != null ? getGrade(percentage) : null;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className={`h-1.5 ${passed === true ? "bg-emerald-500" : passed === false ? "bg-red-500" : "bg-gray-200"}`} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{exam.className || "—"}</span>
        </div>
        <h3 className="font-bold text-gray-900">{exam.name}</h3>
        <p className="text-sm text-violet-600 font-medium">{exam.subject}</p>
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="w-3.5 h-3.5" />{exam.examDate ?? "—"}
        </div>

        <div className="mt-4 border-t pt-3">
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : result?.obtainedMarks != null ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Your Score</p>
                <p className="text-2xl font-bold text-gray-900 mt-0.5">
                  {result.obtainedMarks} <span className="text-sm font-normal text-gray-400">/ {exam.totalMarks}</span>
                </p>
                {percentage != null && (
                  <p className="text-xs text-gray-500">{percentage}%</p>
                )}
              </div>
              <div className="text-right">
                {grade && <p className={`text-3xl font-black ${grade.color}`}>{grade.label}</p>}
                {passed === true && (
                  <div className="flex items-center gap-1 text-emerald-600 text-xs font-semibold mt-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Passed
                  </div>
                )}
                {passed === false && (
                  <div className="flex items-center gap-1 text-red-600 text-xs font-semibold mt-1">
                    <XCircle className="w-3.5 h-3.5" /> Failed
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
              <Trophy className="w-4 h-4" /> Result not yet published
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Exams() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: exams, isLoading } = useListExams();
  const { data: classes } = useListClasses();
  const createMutation = useCreateExam();
  const { user } = useAuthStore();
  const isStudent = user?.role === "student";

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { passingMarks: "40" },
  });

  const onSubmit = (values: z.infer<typeof schema>) => {
    createMutation.mutate({
      data: {
        ...values,
        classId: Number(values.classId),
        totalMarks: Number(values.totalMarks),
        passingMarks: Number(values.passingMarks ?? 40),
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListExamsQueryKey() });
        toast({ title: "Exam created" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to create exam" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exams</h1>
          <p className="text-gray-500 text-sm mt-1">
            {isStudent ? "Your exam results" : "Manage exams and results"}
          </p>
        </div>
        {!isStudent && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white" data-testid="button-add-exam">
                <Plus className="w-4 h-4 mr-2" /> Schedule Exam
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Schedule New Exam</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem><FormLabel>Exam Name *</FormLabel><FormControl><Input placeholder="e.g. Mid-Term 2026" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="classId" render={({ field }) => (
                    <FormItem><FormLabel>Class *</FormLabel>
                      <Select onValueChange={field.onChange}><FormControl><SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger></FormControl>
                        <SelectContent>{classes?.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="subject" render={({ field }) => (
                    <FormItem><FormLabel>Subject *</FormLabel><FormControl><Input placeholder="Mathematics" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="examDate" render={({ field }) => (
                    <FormItem><FormLabel>Exam Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField control={form.control} name="totalMarks" render={({ field }) => (
                      <FormItem><FormLabel>Total Marks *</FormLabel><FormControl><Input type="number" placeholder="100" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="passingMarks" render={({ field }) => (
                      <FormItem><FormLabel>Passing Marks</FormLabel><FormControl><Input type="number" placeholder="40" {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
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

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {!exams?.length ? (
            <div className="col-span-full text-center py-16 text-gray-500">No exams scheduled yet</div>
          ) : isStudent ? (
            exams.map(exam => <StudentExamCard key={exam.id} exam={exam} />)
          ) : (
            exams.map(exam => (
              <Card key={exam.id} className="hover:shadow-md transition-shadow" data-testid={`card-exam-${exam.id}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{exam.className || "All Classes"}</span>
                  </div>
                  <h3 className="font-bold text-gray-900">{exam.name}</h3>
                  <p className="text-sm text-violet-600 font-medium">{exam.subject}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{exam.examDate}</div>
                    <span>Total: {exam.totalMarks} marks</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
