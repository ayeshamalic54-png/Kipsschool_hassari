import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents, useDeleteStudent, getListStudentsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2, UserCheck, UserX, UserMinus, Printer, Bell, AlertTriangle, PhoneCall } from "lucide-react";

const statusConfig = {
  active: { label: "Active", variant: "default" as const, icon: UserCheck, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  inactive: { label: "Inactive", variant: "secondary" as const, icon: UserX, className: "bg-gray-100 text-gray-600 border-gray-200" },
  left: { label: "Left", variant: "destructive" as const, icon: UserMinus, className: "bg-red-100 text-red-700 border-red-200" },
};

function FeeReminderBanner({ students }: { students: Array<{ id: number; name: string; fatherName?: string | null; fatherPhone?: string | null; feeAmount?: number | null; className?: string | null }> }) {
  const { toast } = useToast();
  const [dismissed, setDismissed] = useState(false);

  const studentsWithFee = students.filter(s => s.feeAmount && s.feeAmount > 0);
  if (!studentsWithFee.length || dismissed) return null;

  const handleRemind = (student: typeof students[0]) => {
    const phone = student.fatherPhone || "not on file";
    toast({
      title: `Fee Reminder — ${student.name}`,
      description: `Monthly fee of PKR ${Number(student.feeAmount).toLocaleString()} is due. Father: ${student.fatherName || "—"} | Phone: ${phone}`,
    });
  };

  const handleRemindAll = () => {
    toast({
      title: "Fee Reminders Sent",
      description: `Reminder prepared for ${studentsWithFee.length} students with pending monthly fees.`,
    });
  };

  return (
    <Card className="border-orange-200 bg-orange-50 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-orange-800 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Fee Reminder — Parents Notification
          </CardTitle>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleRemindAll} className="h-7 text-xs bg-orange-600 hover:bg-orange-700 text-white">
              <Bell className="w-3 h-3 mr-1" /> Remind All
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDismissed(true)} className="h-7 text-xs text-orange-600">Dismiss</Button>
          </div>
        </div>
        <p className="text-xs text-orange-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> {studentsWithFee.length} students have monthly fees — send reminders to parents
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-orange-200">
                <th className="text-left py-2 px-2 text-orange-700 font-semibold">Student</th>
                <th className="text-left py-2 px-2 text-orange-700 font-semibold">Father Name</th>
                <th className="text-left py-2 px-2 text-orange-700 font-semibold">Class</th>
                <th className="text-left py-2 px-2 text-orange-700 font-semibold">Monthly Fee</th>
                <th className="text-left py-2 px-2 text-orange-700 font-semibold">Action</th>
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
                    <Button size="sm" variant="outline" className="h-6 text-xs border-orange-300 text-orange-700 hover:bg-orange-100" onClick={() => handleRemind(student)}>
                      <PhoneCall className="w-3 h-3 mr-1" /> Remind
                    </Button>
                  </td>
                </tr>
              ))}
              {studentsWithFee.length > 5 && (
                <tr>
                  <td colSpan={5} className="py-2 px-2 text-orange-600 text-center text-xs">
                    + {studentsWithFee.length - 5} more students
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Students() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [showReminder, setShowReminder] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useListStudents(
    search || statusFilter ? { search: search || undefined, status: statusFilter as "active" | "inactive" | "left" | undefined } : {}
  );
  const { data: allStudents } = useListStudents({ status: "active" });
  const deleteMutation = useDeleteStudent();

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete student ${name}?`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        toast({ title: "Student deleted" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to delete student" }),
    });
  };

  const totalActive = allStudents?.length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm mt-1">Manage student records and admissions</p>
        </div>
        <div className="flex gap-2">
          {!showReminder && (
            <Button variant="outline" size="sm" onClick={() => setShowReminder(true)} className="border-orange-300 text-orange-700 hover:bg-orange-50">
              <Bell className="w-4 h-4 mr-1" /> Fee Reminder
            </Button>
          )}
          <Button variant="outline" onClick={() => window.print()} className="no-print">
            <Printer className="w-4 h-4 mr-2" /> Print List
          </Button>
          <Button onClick={() => setLocation("/students/new")} className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-sm no-print">
            <Plus className="w-4 h-4 mr-2" /> New Admission
          </Button>
        </div>
      </div>

      {showReminder && allStudents && (
        <div onClick={() => {}}>
          <FeeReminderBanner
            students={(allStudents ?? []).map(s => ({
              id: s.id,
              name: s.name,
              fatherName: s.fatherName,
              fatherPhone: (s as unknown as { fatherPhone?: string }).fatherPhone,
              feeAmount: s.feeAmount,
              className: s.className,
            }))}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Active", value: totalActive, gradient: "from-blue-500 to-cyan-500" },
          { label: "Showing", value: students?.length ?? 0, gradient: "from-violet-500 to-purple-600" },
          { label: "Inactive / Left", value: (students?.filter(s => s.status !== "active").length ?? 0), gradient: "from-gray-400 to-gray-500" },
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
            <div className="flex gap-2">
              {["all", "active", "inactive", "left"].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={statusFilter === (s === "all" ? undefined : s) || (s === "all" && !statusFilter) ? "default" : "outline"}
                  onClick={() => setStatusFilter(s === "all" ? undefined : s)}
                  className="capitalize"
                  data-testid={`button-filter-${s}`}
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
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
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Admission #</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Name</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Father Name</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Class</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Section</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Fee/mo</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const status = statusConfig[student.status as keyof typeof statusConfig] || statusConfig.active;
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
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(student.id, student.name)} data-testid={`button-delete-student-${student.id}`}>
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
  );
}
