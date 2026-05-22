import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UserPlus, Search, Users, Phone, BookOpen, ChevronRight,
} from "lucide-react";

const statusColors: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  left:     "bg-red-100 text-red-700 border-red-200",
};

export default function Students() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "left">("all");

  const { data: students = [], isLoading } = useListStudents();

  const filtered = students.filter((s: any) => {
    const matchSearch =
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNumber?.toLowerCase().includes(search.toLowerCase()) ||
      s.rollNumber?.toLowerCase().includes(search.toLowerCase()) ||
      s.fatherName?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = {
    all:      students.length,
    active:   students.filter((s: any) => s.status === "active").length,
    inactive: students.filter((s: any) => s.status === "inactive").length,
    left:     students.filter((s: any) => s.status === "left").length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading..." : `${counts.active} active · ${counts.all} total`}
          </p>
        </div>
        <Button
          onClick={() => setLocation("/students/new")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" /> New Student
        </Button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Search by name, admission no., roll no., father name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(["all", "active", "inactive", "left"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                statusFilter === s
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1.5 text-xs opacity-75">({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && students.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-semibold text-gray-700">Koi student nahi mila</p>
          <p className="text-sm text-gray-400 mt-1">Pehla student admit karein</p>
          <Button
            onClick={() => setLocation("/students/new")}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
          >
            <UserPlus className="w-4 h-4" /> New Student
          </Button>
        </div>
      )}

      {/* No results after filter */}
      {!isLoading && students.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-600">Koi nateeja nahi mila</p>
          <p className="text-sm text-gray-400 mt-1">Search ya filter change karein</p>
          <Button variant="outline" className="mt-3" onClick={() => { setSearch(""); setStatusFilter("all"); }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* Student List */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((student: any) => (
            <div
              key={student.id}
              onClick={() => setLocation(`/students/${student.id}`)}
              className="bg-white rounded-xl border border-gray-100 px-4 py-3.5 flex items-center gap-4 cursor-pointer hover:border-indigo-200 hover:shadow-sm transition-all group"
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 font-semibold text-indigo-600 text-sm uppercase">
                {student.imageUrl
                  ? <img src={student.imageUrl} alt={student.name} className="w-10 h-10 rounded-full object-cover" />
                  : student.name?.charAt(0) ?? "S"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-gray-900 text-sm truncate">{student.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusColors[student.status ?? "active"] ?? statusColors.active}`}>
                    {student.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-0.5 text-xs text-gray-500 flex-wrap">
                  {student.admissionNumber && (
                    <span className="font-mono">{student.admissionNumber}</span>
                  )}
                  {student.className && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="w-3 h-3" /> {student.className}
                      {student.section ? ` - ${student.section}` : ""}
                    </span>
                  )}
                  {student.fatherName && (
                    <span className="text-gray-400">S/O {student.fatherName}</span>
                  )}
                  {student.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" /> {student.phone}
                    </span>
                  )}
                </div>
              </div>

              {/* Fee */}
              {student.feeAmount != null && (
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-xs text-gray-400">Monthly Fee</p>
                  <p className="text-sm font-semibold text-gray-700">
                    PKR {Number(student.feeAmount).toLocaleString()}
                  </p>
                </div>
              )}

              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
