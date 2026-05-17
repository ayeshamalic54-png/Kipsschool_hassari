import { useState } from "react";
import { useListAttendance, useMarkAttendance, useListStudents, useListStaff, getListAttendanceQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, Printer } from "lucide-react";

const schema = z.object({
  type: z.enum(["student", "staff"]),
  personId: z.string().min(1, "Required"),
  date: z.string().min(1, "Date required"),
  status: z.enum(["present", "absent", "late", "leave"]),
});

const statusColors = {
  present: "bg-emerald-100 text-emerald-700 border-emerald-200",
  absent: "bg-red-100 text-red-700 border-red-200",
  late: "bg-amber-100 text-amber-700 border-amber-200",
  leave: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function Attendance() {
  const [open, setOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split("T")[0]);
  const [typeFilter, setTypeFilter] = useState<"student" | "staff">("student");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: attendance, isLoading } = useListAttendance({ date: dateFilter, type: typeFilter });
  const { data: students } = useListStudents({});
  const { data: staff } = useListStaff();
  const markMutation = useMarkAttendance();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { type: "student", date: new Date().toISOString().split("T")[0], status: "present" },
  });

  const watchType = form.watch("type");

  const onSubmit = (values: z.infer<typeof schema>) => {
    const data = {
      type: values.type,
      date: values.date,
      status: values.status,
      studentId: values.type === "student" ? Number(values.personId) : null,
      staffId: values.type === "staff" ? Number(values.personId) : null,
    };
    markMutation.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        toast({ title: "Attendance marked" });
        setOpen(false);
        form.reset();
      },
      onError: () => toast({ variant: "destructive", title: "Failed to mark attendance" }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-gray-500 text-sm mt-1">Daily attendance tracking</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print-attendance"><Printer className="w-4 h-4 mr-1" /> Print</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white" data-testid="button-mark-attendance">
                <Plus className="w-4 h-4 mr-2" /> Mark Attendance
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem><FormLabel>Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="student">Student</SelectItem>
                          <SelectItem value="staff">Staff</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="personId" render={({ field }) => (
                    <FormItem><FormLabel>{watchType === "student" ? "Student" : "Staff Member"} *</FormLabel>
                      <Select onValueChange={field.onChange}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {watchType === "student"
                            ? students?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)
                            : staff?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)
                          }
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="date" render={({ field }) => (
                    <FormItem><FormLabel>Date *</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="leave">Leave</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={markMutation.isPending}>
                      {markMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Mark
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)} className="w-auto" data-testid="input-date-filter" />
        <div className="flex gap-2">
          {(["student", "staff"] as const).map(t => (
            <Button key={t} size="sm" variant={typeFilter === t ? "default" : "outline"} onClick={() => setTypeFilter(t)} className="capitalize" data-testid={`button-type-${t}`}>{t}</Button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? <div className="p-6 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["#", "Name", "Class", "Date", "Type", "Status"].map(h => (
                      <th key={h} className="text-left py-3 px-3 font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {!attendance?.length ? (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-400">No attendance records for this date</td></tr>
                  ) : attendance?.map((att, i) => {
                    const sc = statusColors[att.status as keyof typeof statusColors] || statusColors.present;
                    return (
                      <tr key={att.id} className="border-b hover:bg-gray-50" data-testid={`row-attendance-${att.id}`}>
                        <td className="py-3 px-3 text-gray-500">{i + 1}</td>
                        <td className="py-3 px-3 font-medium text-gray-900">{att.personName || "—"}</td>
                        <td className="py-3 px-3 text-gray-600">{att.className || "—"}</td>
                        <td className="py-3 px-3 text-gray-600">{att.date}</td>
                        <td className="py-3 px-3 capitalize text-gray-600">{att.type}</td>
                        <td className="py-3 px-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${sc}`}>{att.status}</span>
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
  );
}
