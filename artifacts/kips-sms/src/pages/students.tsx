import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserPlus, Search, Users, ChevronDown, ChevronRight as ChevronR, BookOpen } from "lucide-react";

const statusColors: Record<string, string> = {
  active:   "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  left:     "bg-red-100 text-red-600 border-red-200",
};

export default function Students() {
  const [, setLocation]   = useLocation();
  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState<"all"|"active"|"inactive"|"left">("all");
  const [collapsed, setCollapsed]     = useState<Record<string, boolean>>({});

  const { data: students = [], isLoading } = useListStudents();

  /* ── filter ─────────────────────────────────────────────────────────────── */
  const filtered = (students as any[]).filter((s) => {
    const q = search.toLowerCase();
    const ok =
      !search ||
      s.name?.toLowerCase().includes(q) ||
      s.admissionNumber?.toLowerCase().includes(q) ||
      s.rollNumber?.toLowerCase().includes(q) ||
      s.fatherName?.toLowerCase().includes(q);
    return ok && (statusFilter === "all" || s.status === statusFilter);
  });

  /* ── group by class ──────────────────────────────────────────────────────── */
  const grouped: Record<string, any[]> = {};
  for (const s of filtered) {
    const key = s.className ?? "No Class";
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort((a, b) => {
      const ra = Number(a.rollNumber) || 9999;
      const rb = Number(b.rollNumber) || 9999;
      return ra !== rb ? ra - rb : (a.name ?? "").localeCompare(b.name ?? "");
    });
  }
  const classRank = (n: string) => {
    if (n === "No Class") return 9999;
    if (/nursery/i.test(n)) return 0;
    if (/kg|kinder/i.test(n)) return 1;
    const m = n.match(/(\d+)/); return m ? parseInt(m[1]) : 500;
  };
  const groupKeys = Object.keys(grouped).sort((a, b) => classRank(a) - classRank(b));

  /* ── counts ─────────────────────────────────────────────────────────────── */
  const all = (students as any[]).length;
  const counts = {
    all,
    active:   (students as any[]).filter(s => s.status === "active").length,
    inactive: (students as any[]).filter(s => s.status === "inactive").length,
    left:     (students as any[]).filter(s => s.status === "left").length,
  };

  const toggleClass = (cls: string) =>
    setCollapsed(prev => ({ ...prev, [cls]: !prev[cls] }));

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLoading ? "Loading…" : `${counts.active} active · ${all} total`}
          </p>
        </div>
        <Button onClick={() => setLocation("/students/new")}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
          <UserPlus className="w-4 h-4" /> New Student
        </Button>
      </div>

      {/* ── Search + filter ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <Input className="pl-9" placeholder="Name, admission no., roll no., father name…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap shrink-0">
          {(["all","active","inactive","left"] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${
                statusFilter === s
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300"
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}{" "}
              <span className="text-xs opacity-70">({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Skeleton ─────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-14 w-full rounded-xl ml-0" />
              <Skeleton className="h-14 w-full rounded-xl ml-0" />
            </div>
          ))}
        </div>
      )}

      {/* ── No data ──────────────────────────────────────────────────────── */}
      {!isLoading && all === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-semibold text-gray-700">Koi student nahi mila</p>
          <Button onClick={() => setLocation("/students/new")}
            className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white gap-2">
            <UserPlus className="w-4 h-4" /> New Student
          </Button>
        </div>
      )}

      {/* ── No search result ─────────────────────────────────────────────── */}
      {!isLoading && all > 0 && filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <Search className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-semibold text-gray-600">Koi nateeja nahi mila</p>
          <Button variant="outline" className="mt-3"
            onClick={() => { setSearch(""); setStatusFilter("all"); }}>
            Clear Filters
          </Button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CLASS-WISE COLLAPSIBLE GROUPS                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-3">
          {groupKeys.map((className) => {
            const cls       = grouped[className];
            const isOpen    = !collapsed[className];   // default open
            const active    = cls.filter(s => s.status === "active").length;

            return (
              <div key={className} className="rounded-2xl border border-gray-200 overflow-hidden shadow-sm bg-white">

                {/* ── Class header (clickable dropdown) ─────────────────── */}
                <button
                  type="button"
                  onClick={() => toggleClass(className)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
                >
                  <BookOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                  <span className="flex-1 font-bold text-indigo-800 text-sm uppercase tracking-wider">
                    {className}
                  </span>
                  <span className="text-xs text-indigo-500 font-medium px-2 py-0.5 rounded-full bg-indigo-100">
                    {active} active / {cls.length} total
                  </span>
                  {isOpen
                    ? <ChevronDown className="w-4 h-4 text-indigo-400 shrink-0" />
                    : <ChevronR  className="w-4 h-4 text-indigo-400 shrink-0" />}
                </button>

                {/* ── Students list (collapsible) ───────────────────────── */}
                {isOpen && (
                  <div className="divide-y divide-gray-50">
                    {cls.map((student: any) => (
                      <div
                        key={student.id}
                        onClick={() => setLocation(`/students/${student.id}`)}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                      >
                        {/* Photo / Avatar */}
                        <div className="w-10 h-10 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 font-bold text-indigo-600 text-sm uppercase overflow-hidden">
                          {student.imageUrl
                            ? <img src={student.imageUrl} alt={student.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : (student.name?.charAt(0) ?? "S")}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {student.rollNumber && (
                              <span className="text-xs font-bold text-gray-400 w-5 shrink-0">
                                #{student.rollNumber}
                              </span>
                            )}
                            <p className="font-semibold text-gray-900 text-sm truncate">
                              {student.name}
                            </p>
                            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${statusColors[student.status ?? "active"]}`}>
                              {student.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 truncate mt-0.5 pl-7">
                            {[
                              student.admissionNumber ? `Adm: ${student.admissionNumber}` : null,
                              student.section         ? `Sec: ${student.section}`          : null,
                              student.fatherName      ? `S/O ${student.fatherName}`        : null,
                            ].filter(Boolean).join(" · ")}
                          </p>
                        </div>

                        {/* Fee */}
                        {student.feeAmount != null && (
                          <div className="shrink-0 text-right hidden sm:block min-w-[90px]">
                            <p className="text-[10px] text-gray-400">Monthly</p>
                            <p className="text-sm font-semibold text-gray-700">
                              PKR {Number(student.feeAmount).toLocaleString()}
                            </p>
                          </div>
                        )}

                        <ChevronR className="w-4 h-4 text-gray-300 shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
