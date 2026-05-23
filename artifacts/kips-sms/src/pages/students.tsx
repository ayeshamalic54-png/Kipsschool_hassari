import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import {
  useListStudents, useDeleteStudent, getListStudentsQueryKey,
  useListClasses, ListStudentsParams,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Eye, Trash2, UserCheck, UserX, UserMinus,
  Printer, Pencil, GraduationCap, Phone, BookOpen,
} from "lucide-react";

// ── Gradient palette for classes ──────────────────────────────────────────────
const GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-pink-500 to-rose-500",
  "from-blue-500 to-indigo-600",
  "from-cyan-500 to-blue-500",
  "from-teal-500 to-emerald-500",
  "from-green-500 to-teal-600",
  "from-amber-400 to-orange-500",
  "from-orange-500 to-red-500",
  "from-fuchsia-500 to-pink-600",
  "from-sky-400 to-cyan-500",
  "from-emerald-500 to-green-600",
  "from-rose-500 to-pink-600",
  "from-indigo-400 to-violet-500",
];

const BG_LIGHT = [
  "bg-violet-50  border-violet-200",
  "bg-pink-50    border-pink-200",
  "bg-blue-50    border-blue-200",
  "bg-cyan-50    border-cyan-200",
  "bg-teal-50    border-teal-200",
  "bg-green-50   border-green-200",
  "bg-amber-50   border-amber-200",
  "bg-orange-50  border-orange-200",
  "bg-fuchsia-50 border-fuchsia-200",
  "bg-sky-50     border-sky-200",
  "bg-emerald-50 border-emerald-200",
  "bg-rose-50    border-rose-200",
  "bg-indigo-50  border-indigo-200",
];

const statusConfig = {
  active:   { label: "Active",   icon: UserCheck, className: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  inactive: { label: "Inactive", icon: UserX,     className: "bg-gray-100 text-gray-600 border border-gray-200"         },
  left:     { label: "Left",     icon: UserMinus,  className: "bg-red-100 text-red-700 border border-red-200"            },
};

type StudentRow = {
  id: number;
  name: string;
  fatherName?: string | null;
  admissionNumber: string;
  className?: string | null;
  classId?: number | null;
  section?: string | null;
  phone?: string | null;
  feeAmount?: number | string | null;
  status: string;
  imageUrl?: string | null;
};

export default function Students() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(searchStr);
  const classId  = urlParams.get("classId") || undefined;
  const section  = urlParams.get("section")  || undefined;

  const filterParams: ListStudentsParams = {};
  if (search)       filterParams.search  = search;
  if (statusFilter) filterParams.status  = statusFilter as ListStudentsParams["status"];
  if (classId)      filterParams.classId = Number(classId);

  const { data: students, isLoading } = useListStudents(filterParams);
  const { data: classes } = useListClasses();
  const deleteMutation = useDeleteStudent();

  // Sort classes numerically/alphabetically
  const sortedClasses = classes
    ? [...classes].sort((a, b) => {
        const na = parseInt(a.name) || 0;
        const nb = parseInt(b.name) || 0;
        if (na && nb) return na - nb;
        return a.name.localeCompare(b.name);
      })
    : [];

  // Assign a gradient color to each class by index
  const classColorMap = new Map<number, number>();
  sortedClasses.forEach((cls, i) => classColorMap.set(cls.id, i % GRADIENTS.length));

  const getGradient = (cId?: number | null) =>
    cId != null && classColorMap.has(cId)
      ? GRADIENTS[classColorMap.get(cId)!]
      : "from-slate-500 to-gray-600";

  const getBgLight = (cId?: number | null) =>
    cId != null && classColorMap.has(cId)
      ? BG_LIGHT[classColorMap.get(cId)!]
      : "bg-gray-50 border-gray-200";

  // Client-side section filter
  const filteredStudents = (section
    ? students?.filter(s => s.section === section)
    : students) as StudentRow[] | undefined;

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

  const activeClass = classId ? sortedClasses.find(c => String(c.id) === classId) : null;
  const activeGrad  = activeClass ? GRADIENTS[classColorMap.get(activeClass.id)! % GRADIENTS.length] : "";

  return (
    <div className="space-y-5 pb-8">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeClass
              ? <span>Class <strong className="text-gray-800">{activeClass.name}</strong>{section && <> — Section <strong>{section}</strong></>}</span>
              : "All students"
            }
            {filteredStudents && (
              <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                {filteredStudents.length} total
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button
            onClick={() => setLocation("/students/new")}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-sm"
          >
            <Plus className="w-4 h-4 mr-2" /> New Admission
          </Button>
        </div>
      </div>

      {/* ── Filters Row ── */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        {/* Class Dropdown */}
        <Select
          value={classId || "all"}
          onValueChange={val => setLocation(val === "all" ? "/students" : `/students?classId=${val}`)}
        >
          <SelectTrigger className="w-full sm:w-48 font-medium">
            {activeClass ? (
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${getGradient(activeClass.id)}`} />
                <SelectValue />
              </div>
            ) : (
              <SelectValue placeholder="All Classes" />
            )}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <BookOpen className="w-3.5 h-3.5 text-gray-400" />
                All Classes
              </div>
            </SelectItem>
            {sortedClasses.map(cls => (
              <SelectItem key={cls.id} value={String(cls.id)}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${GRADIENTS[classColorMap.get(cls.id)! % GRADIENTS.length]}`} />
                  {cls.name}
                  {cls.studentCount > 0 && (
                    <span className="ml-1 text-xs text-gray-400">({cls.studentCount})</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name or admission no..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex gap-1.5 flex-wrap">
          {["all", "active", "inactive", "left"].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === "all" ? undefined : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
                (s === "all" && !statusFilter) || statusFilter === s
                  ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Class color legend bar (when a class is selected) ── */}
      {activeClass && (
        <div className={`w-full h-1.5 rounded-full bg-gradient-to-r ${getGradient(activeClass.id)}`} />
      )}

      {/* ── Student Cards Grid ── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}
        </div>
      ) : !filteredStudents?.length ? (
        <div className="text-center py-20 text-gray-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No students found</p>
          <p className="text-sm mt-1">
            {classId ? "No students in this class" : "Add a new student to get started"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => {
            const status = statusConfig[student.status as keyof typeof statusConfig] ?? statusConfig.active;
            const StatusIcon = status.icon;
            const grad  = getGradient(student.classId);
            const bgLt  = getBgLight(student.classId);

            return (
              <div
                key={student.id}
                className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col ${bgLt}`}
              >
                {/* ── Gradient top bar ── */}
                <div className={`h-2 bg-gradient-to-r ${grad}`} />

                {/* ── Card body ── */}
                <div className="p-4 flex-1 flex flex-col gap-3">

                  {/* ── Avatar + Name ── */}
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0 border-2 border-white`}>
                      {student.imageUrl
                        ? <img src={student.imageUrl} alt={student.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                        : <span className="text-white font-bold text-xl">{student.name.charAt(0)}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate text-base leading-tight">{student.name}</h3>
                      {student.fatherName && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">s/o {student.fatherName}</p>
                      )}
                      <p className="text-[11px] font-mono text-purple-600 font-semibold mt-0.5">{student.admissionNumber}</p>
                    </div>
                  </div>

                  {/* ── Info pills ── */}
                  <div className="flex flex-wrap gap-1.5">
                    {student.className && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${grad} text-white shadow-sm`}>
                        <BookOpen className="w-3 h-3" />
                        {student.className}
                        {student.section && <span className="opacity-80">/ {student.section}</span>}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>

                  {/* ── Fee + Phone ── */}
                  <div className="space-y-1 text-sm text-gray-600">
                    {student.feeAmount ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Fee</span>
                        <span className="font-semibold text-gray-800">PKR {Number(student.feeAmount).toLocaleString()}</span>
                        <span className="text-xs text-gray-400">/mo</span>
                      </div>
                    ) : null}
                    {student.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-500">
                        <Phone className="w-3 h-3 text-gray-400" />
                        {student.phone}
                      </div>
                    )}
                  </div>

                  {/* ── Actions (always at bottom, always visible on mobile) ── */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-gray-200/70">
                    <button
                      onClick={() => setLocation(`/students/${student.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button
                      onClick={() => setLocation(`/students/${student.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(student.id, student.name)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
