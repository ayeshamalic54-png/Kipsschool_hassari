import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Search, Users, BookOpen, ChevronRight, GraduationCap } from "lucide-react";

const statusColors: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-600 border-gray-200",
  left:     "bg-red-100 text-red-700 border-red-200",
};

export default function Students() {
  const [, setLocation] = useLocation();
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "left">("all");

  const { data: students = [], isLoading } = useListStudents();

  const filtered = students.filter((s: any) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      s.name?.toLowerCase().includes(q) ||
      s.admissionNumber?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.fatherName?.toLowerCase().includes(q);
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

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${counts.active} active · ${counts.all} total`}
          </p>
        </div>
        <Button
          onClick={() => setLocation("/students/new")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
        >
          <UserPlus className="w-4 h-4" /> New Student
        </Button>
      </div>

      {/* ── Search + Status Filter ───────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Name, admission no., roll no., father name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(["all", "active", "inactive", "left"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1 text-xs opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Loading skeletons ────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* ── Empty — no students at all ───────────────────────────────────── */}
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

      {/* ── No filter results ────────────────────────────────────────────── */}
      {!isLoading && students.length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-600">Koi nateeja nahi mila</p>
          <p className="text-sm text-gray-400 mt-1">Search ya filter change karein</p>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}
          >
            Clear Filters
          </Button>
        </div>
      )}

      {/* ── Student cards ────────────────────────────────────────────────── */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((student: any) => (
            <div
              key={student.id}
              onClick={() => setLocation(`/students/${student.id}`)}
              className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
            >
              {/* Avatar circle — fixed size, never shrinks */}
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 font-bold text-indigo-600 text-sm uppercase overflow-hidden">
                {student.imageUrl
                  ? <img src={student.imageUrl} alt={student.name} className="w-full h-full object-cover" />
                  : (student.name?.charAt(0) ?? "S")}
              </div>

              {/* Main info — two stable rows, no flex-wrap */}
              <div className="flex-1 min-w-0">
                {/* Row 1: name + status badge */}
                <div className="flex items-center gap-2 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                    {student.name}
                  </p>
                  <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border font-medium leading-tight ${statusColors[student.status ?? "active"] ?? statusColors.active}`}>
                    {student.status}
                  </span>
                </div>

                {/* Row 2: class · admission no · father name — truncated, never wraps */}
                <p className="text-xs text-gray-500 mt-0.5 truncate leading-tight">
                  {[
                    student.className
                      ? `📚 ${student.className}${student.section ? " - " + student.section : ""}`
                      : null,
                    student.admissionNumber ?? null,
                    student.fatherName ? `S/O ${student.fatherName}` : null,
                  ]
                    .filter(Boolean)
                    .join("  ·  ")}
                </p>
              </div>

              {/* Monthly fee — right side, fixed width, stable */}
              <div className="shrink-0 text-right w-24 hidden sm:block">
                {student.feeAmount != null ? (
                  <>
                    <p className="text-[10px] text-gray-400 leading-none">Monthly Fee</p>
                    <p className="text-sm font-semibold text-gray-700 leading-tight">
                      PKR {Number(student.feeAmount).toLocaleString()}
                    </p>
                  </>
                ) : null}
              </div>

              <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
