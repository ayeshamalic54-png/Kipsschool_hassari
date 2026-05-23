import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useListStudents, useDeleteStudent, getListStudentsQueryKey, useListClasses, ListStudentsParams } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, Eye, Trash2, UserCheck, UserX, UserMinus, Printer, Pencil, BookOpen, Users } from "lucide-react";

const statusConfig = {
  active:   { label: "Active",   icon: UserCheck, className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  inactive: { label: "Inactive", icon: UserX,     className: "bg-gray-100 text-gray-600 border-gray-200"         },
  left:     { label: "Left",     icon: UserMinus,  className: "bg-red-100 text-red-700 border-red-200"            },
};

export default function Students() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(searchStr);
  const classId = urlParams.get("classId") || undefined;
  const section  = urlParams.get("section")  || undefined;

  const filterParams: ListStudentsParams = {};
  if (search)       filterParams.search  = search;
  if (statusFilter) filterParams.status  = statusFilter as ListStudentsParams["status"];
  if (classId)      filterParams.classId = Number(classId);

  const { data: students, isLoading } = useListStudents(filterParams);
  const { data: classes } = useListClasses();
  const deleteMutation = useDeleteStudent();

  // Sort classes by name naturally (e.g. Nursery, KG, 1, 2 ... 10)
  const sortedClasses = classes
    ? [...classes].sort((a, b) => {
        const na = parseInt(a.name) || 0;
        const nb = parseInt(b.name) || 0;
        if (na && nb) return na - nb;
        return a.name.localeCompare(b.name);
      })
    : [];

  const filteredStudents = section
    ? students?.filter(s => s.section === section)
    : students;

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

  const activeClassName = classId
    ? sortedClasses.find(c => String(c.id) === classId)?.name
    : null;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm mt-1">
            Manage student records and admissions
            {activeClassName && <span className="ml-2 text-blue-600 font-medium">— Class {activeClassName}</span>}
            {section && <span className="ml-1 text-indigo-600 font-medium">/ Section {section}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* ── Class Filter Tabs ── */}
      {sortedClasses.length > 0 && (
        <div className="flex flex-wrap gap-2 pb-1 no-print">
          <button
            onClick={() => setLocation("/students")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
              !classId
                ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            All
          </button>
          {sortedClasses.map(cls => (
            <button
              key={cls.id}
              onClick={() => setLocation(`/students?classId=${cls.id}`)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                classId === String(cls.id)
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              {cls.name}
              {cls.studentCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ml-0.5 ${
                  classId === String(cls.id) ? "bg-white/20" : "bg-gray-100"
                }`}>
                  {cls.studentCount}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Search + Status Filters ── */}
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
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["all", "active", "inactive", "left"].map(s => (
                <Button
                  key={s}
                  size="sm"
                  variant={
                    statusFilter === (s === "all" ? undefined : s) ||
                    (s === "all" && !statusFilter) ? "default" : "outline"
                  }
                  onClick={() => setStatusFilter(s === "all" ? undefined : s)}
                  className="capitalize"
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
              {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : !filteredStudents?.length ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg font-medium">No students found</p>
              <p className="text-sm mt-1">
                {classId ? "No students in this class" : "Add a new student to get started"}
              </p>
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
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Fee</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Status</th>
                    <th className="text-left py-3 px-2 font-semibold text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map(student => {
                    const status = statusConfig[student.status as keyof typeof statusConfig] ?? statusConfig.active;
                    return (
                      <tr key={student.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2 font-mono text-xs text-purple-600 font-medium">{student.admissionNumber}</td>
                        <td className="py-3 px-2 font-medium text-gray-900">{student.name}</td>
                        <td className="py-3 px-2 text-gray-600">{student.fatherName || "—"}</td>
                        <td className="py-3 px-2 text-gray-600">{student.className || "—"}</td>
                        <td className="py-3 px-2 text-gray-600">{student.section || "—"}</td>
                        <td className="py-3 px-2 text-gray-600">
                          {student.feeAmount ? `PKR ${Number(student.feeAmount).toLocaleString()}` : "—"}
                        </td>
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${status.className}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => setLocation(`/students/${student.id}`)}>
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              className="h-7 w-7 text-blue-500 hover:text-blue-600 hover:bg-blue-50"
                              onClick={() => setLocation(`/students/${student.id}`)}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="icon" variant="ghost"
                              className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(student.id, student.name)}>
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
