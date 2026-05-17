import { useRoute, useLocation } from "wouter";
import { useGetStudent, useUpdateStudent, getGetStudentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Phone, MapPin, BookOpen, Calendar, Printer } from "lucide-react";

export default function StudentDetail() {
  const [, params] = useRoute("/students/:id");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const studentId = Number(params?.id);

  const { data: student, isLoading } = useGetStudent(studentId, {
    query: { enabled: !!studentId, queryKey: getGetStudentQueryKey(studentId) }
  });

  const updateMutation = useUpdateStudent();

  const handleStatusChange = (status: string) => {
    updateMutation.mutate({ id: studentId, data: { status: status as "active" | "inactive" | "left" } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetStudentQueryKey(studentId) });
        toast({ title: "Status updated" });
      },
      onError: () => toast({ variant: "destructive", title: "Failed to update status" }),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!student) return <div className="text-center py-20 text-gray-500">Student not found</div>;

  const statusColors = { active: "bg-emerald-100 text-emerald-700", inactive: "bg-gray-100 text-gray-600", left: "bg-red-100 text-red-700" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{student.name}</h1>
            <p className="text-gray-500 text-sm font-mono">{student.admissionNumber}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()} data-testid="button-print">
            <Printer className="w-4 h-4 mr-1" /> Print
          </Button>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[student.status as keyof typeof statusColors] || statusColors.active}`}>
            {student.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><User className="w-4 h-4 text-blue-600" /> Personal Information</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Father Name", value: student.fatherName },
                { label: "Mother Name", value: student.motherName },
                { label: "Date of Birth", value: student.dateOfBirth },
                { label: "Gender", value: student.gender ? student.gender.charAt(0).toUpperCase() + student.gender.slice(1) : undefined },
                { label: "Phone", value: student.phone },
                { label: "Emergency Contact", value: student.emergencyContact },
                { label: "Address", value: student.address },
                { label: "Username", value: student.username },
              ].map(item => (
                <div key={item.label} className="space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm text-gray-900">{item.value || "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><BookOpen className="w-4 h-4 text-purple-600" /> Academic Info</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: "Class", value: student.className },
                { label: "Section", value: student.section },
                { label: "Roll Number", value: student.rollNumber },
                { label: "Monthly Fee", value: student.feeAmount ? `PKR ${Number(student.feeAmount).toLocaleString()}` : undefined },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center py-1 border-b last:border-0">
                  <span className="text-xs text-gray-500">{item.label}</span>
                  <span className="text-sm font-medium text-gray-900">{item.value || "—"}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Change Status</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {["active", "inactive", "left"].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={student.status === s ? "default" : "outline"}
                  className="capitalize justify-start"
                  onClick={() => handleStatusChange(s)}
                  disabled={student.status === s || updateMutation.isPending}
                  data-testid={`button-status-${s}`}
                >
                  Mark as {s}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
