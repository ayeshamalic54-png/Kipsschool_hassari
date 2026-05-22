import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Search, Users, ChevronRight, BookOpen } from "lucide-react";

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

  /* ── filtered list ───────────────────────────────────────────────────── */
  const filtered = (students as any[]).filter((s) => {
    const q = search.toLowerCase();
    const matchSearch =
      !search ||
      s.name?.toLowerCase().includes(q) ||
      s.admissionNumber?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.fatherName?.toLowerCase().includes(q);
    return matchSearch && (statusFilter === "all" || s.status === statusFilter);
  });

  /* ── group by class ──────────────────────────────────────────────────── */
  const grouped: Record<string, any[]> = {};
  for (const s of filtered) {
    const key = s.className ?? "No Class Assigned";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  // sort groups: named classes first (alphabetically), "No Class" last
  const groupKeys = Object.keys(grouped).sort((a, b) => {
    if (a === "No Class Assigned") return 1;
    if (b === "No Class Assigned") return -1;
    return a.localeCompare(b);
  });

  /* ── counts ─────────────────────────────────────────────────────────── */
  const counts = {
    all:      (students as any[]).length,
    active:   (students as any[]).filter((s) => s.status === "active").length,
    inactive: (students as any[]).filter((s) => s.status === "inactive").length,
    left:     (students as any[]).filter((s) => s.status === "left").length,
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
        <div className="flex gap-2 flex-shrink-0 flex-wrap">
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

      {/* ── Loading ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {/* ── No students at all ───────────────────────────────────────────── */}
      {!isLoading && (students as any[]).length === 0 && (
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

      {/* ── Search returned nothing ──────────────────────────────────────── */}
      {!isLoading && (students as any[]).length > 0 && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-600">Koi nateeja nahi mila</p>
          <p className="text-sm text-gray-400 mt-1">Search ya filter change karein</p>
          <Button variant="outline" className="mt-3"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* ── CLASS-WISE grouped list ──────────────────────────────────────── */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-6">
          {groupKeys.map((className) => {
            const classStudents = grouped[className];
            return (
              <div key={className}>
                {/* Class header */}
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-bold text-indigo-700 uppercase tracking-wide">
                    {className}
                  </h2>
                  <span className="text-xs text-gray-400 font-medium">
                    ({classStudents.length} student{classStudents.length !== 1 ? "s" : ""})
                  </span>
                  <div className="flex-1 h-px bg-indigo-100 ml-1" />
                </div>

                {/* Students under this class */}
                <div className="space-y-1.5">
                  {classStudents.map((student: any) => (
                    <div
                      key={student.id}
                      onClick={() => setLocation(`/students/${student.id}`)}
                      className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-colors"
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 font-bold text-indigo-600 text-sm uppercase overflow-hidden">
                        {student.imageUrl
                          ? <img src={student.imageUrl} alt={student.name} className="w-full h-full object-cover" />
                          : (student.name?.charAt(0) ?? "S")}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: name + status */}
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate leading-tight">
                            {student.name}
                          </p>
                          <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded-full border font-medium leading-tight ${statusColors[student.status ?? "active"] ?? statusColors.active}`}>
                            {student.status}
                          </span>
                        </div>

                        {/* Row 2: admission no · roll · father name */}
                        <p className="text-xs text-gray-500 mt-0.5 truncate leading-tight">
                          {[
                            student.admissionNumber ? `Adm: ${student.admissionNumber}` : null,
                            student.rollNumber      ? `Roll: ${student.rollNumber}`      : null,
                            student.section         ? `Sec: ${student.section}`          : null,
                            student.fatherName      ? `S/O ${student.fatherName}`        : null,
                          ].filter(Boolean).join("  ·  ")}
                        </p>
                      </div>

                      {/* Fee — desktop only */}
                      <div className="shrink-0 text-right w-28 hidden sm:block">
                        {student.feeAmount != null && (
                          <>
                            <p className="text-[10px] text-gray-400 leading-none">Monthly Fee</p>
                            <p className="text-sm font-semibold text-gray-700 leading-tight">
                              PKR {Number(student.feeAmount).toLocaleString()}
                            </p>
                          </>
                        )}
                      </div>

                      <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
