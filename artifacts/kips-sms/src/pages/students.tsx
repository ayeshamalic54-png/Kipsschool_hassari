import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
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
  Printer, Pencil, GraduationCap, Phone, BookOpen, Users,
  LayoutList, Grid3X3,
} from "lucide-react";
import { useSchoolInfo } from "@/lib/school-info";

// ── Gradient palette for classes ──────────────────────────────────────────────
const GRADIENTS = [
  "from-violet-500 to-purple-600","from-pink-500 to-rose-500",
  "from-blue-500 to-indigo-600",  "from-cyan-500 to-blue-500",
  "from-teal-500 to-emerald-500", "from-green-500 to-teal-600",
  "from-amber-400 to-orange-500", "from-orange-500 to-red-500",
  "from-fuchsia-500 to-pink-600", "from-sky-400 to-cyan-500",
  "from-emerald-500 to-green-600","from-rose-500 to-pink-600",
  "from-indigo-400 to-violet-500",
];
const BG_LIGHT = [
  "bg-violet-50 border-violet-200","bg-pink-50 border-pink-200",
  "bg-blue-50 border-blue-200",   "bg-cyan-50 border-cyan-200",
  "bg-teal-50 border-teal-200",   "bg-green-50 border-green-200",
  "bg-amber-50 border-amber-200", "bg-orange-50 border-orange-200",
  "bg-fuchsia-50 border-fuchsia-200","bg-sky-50 border-sky-200",
  "bg-emerald-50 border-emerald-200","bg-rose-50 border-rose-200",
  "bg-indigo-50 border-indigo-200",
];

const statusConfig = {
  active:   { label: "Active",   icon: UserCheck, cls: "bg-emerald-100 text-emerald-700 border border-emerald-200" },
  inactive: { label: "Inactive", icon: UserX,     cls: "bg-gray-100 text-gray-600 border border-gray-200"         },
  left:     { label: "Left",     icon: UserMinus,  cls: "bg-red-100 text-red-700 border border-red-200"            },
};

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body > *:not(#student-print-portal) { display: none !important; }
    #student-print-portal {
      display: block !important; position: absolute !important;
      top: 0 !important; left: 0 !important; width: 100% !important;
      background: white !important; font-family: Arial, sans-serif !important;
      color: #111827 !important; font-size: 10pt !important;
      padding: 12mm 14mm !important; box-sizing: border-box !important;
    }
    table { border-collapse: collapse !important; width: 100% !important; }
    tr    { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
`;

const getClassRank = (name: string): number => {
  const n = name.toLowerCase().trim();
  if (n.includes("play") || n.includes("pg")) return 1;
  if (n.includes("nursery") || n.includes("nur")) return 2;
  if (n.includes("prep")) return 3;
  
  const match = n.match(/\d+/);
  if (match) {
    return 3 + parseInt(match[0], 10);
  }
  return 100;
};

type StudentRow = {
  id: number; name: string; fatherName?: string | null;
  admissionNumber: string; className?: string | null;
  classId?: number | null; section?: string | null;
  phone?: string | null; feeAmount?: number | string | null;
  status: string; imageUrl?: string | null;
};

export default function Students() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const schoolInfo = useSchoolInfo();

  const urlParams  = new URLSearchParams(searchStr);
  const classId    = urlParams.get("classId") || undefined;
  const section    = urlParams.get("section")  || undefined;

  const filterParams: ListStudentsParams = {};
  if (search)       filterParams.search  = search;
  if (statusFilter) filterParams.status  = statusFilter as ListStudentsParams["status"];
  if (classId)      filterParams.classId = Number(classId);

  const { data: students, isLoading } = useListStudents(filterParams);
  const { data: classes } = useListClasses();
  const deleteMutation = useDeleteStudent();

  const sortedClasses = classes
    ? [...classes].sort((a, b) => getClassRank(a.name) - getClassRank(b.name))
    : [];

  const classColorMap = new Map<number, number>();
  sortedClasses.forEach((cls, i) => classColorMap.set(cls.id, i % GRADIENTS.length));
  const getGrad  = (cId?: number | null) => cId != null && classColorMap.has(cId) ? GRADIENTS[classColorMap.get(cId)!] : "from-slate-500 to-gray-600";
  const getBgLt  = (cId?: number | null) => cId != null && classColorMap.has(cId) ? BG_LIGHT[classColorMap.get(cId)!]  : "bg-gray-50 border-gray-200";

  const rawFiltered = (section ? students?.filter(s => s.section === section) : students) as StudentRow[] | undefined;
  const filteredStudents = rawFiltered
    ? [...rawFiltered].sort((a, b) => {
        const rankA = getClassRank(a.className || "");
        const rankB = getClassRank(b.className || "");
        if (rankA !== rankB) return rankA - rankB;
        return a.name.localeCompare(b.name);
      })
    : [];
  const activeClass = classId ? sortedClasses.find(c => String(c.id) === classId) : null;
  const printDate  = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`Delete student ${name}?`)) return;
    deleteMutation.mutate({ id }, {
      onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListStudentsQueryKey() }); toast({ title: "Student deleted" }); },
      onError:   () => toast({ variant: "destructive", title: "Failed to delete student" }),
    });
  };

  // Inject print styles
  useEffect(() => {
    const el = document.createElement("style"); el.id = "kips-student-print";
    el.textContent = PRINT_STYLES; document.head.appendChild(el);
    return () => { document.getElementById("kips-student-print")?.remove(); };
  }, []);

  // ── Print Portal (clean list table for print) ─────────────────────────────
  const th = { padding: "7px 10px", background: "#1e3a8a", color: "#fff", fontWeight: 700, fontSize: 9, textAlign: "left" as const, border: "1px solid #93c5fd" };
  const td = (alt: boolean) => ({ padding: "6px 10px", border: "1px solid #e5e7eb", fontSize: 9, color: "#1f2937", background: alt ? "#f0f4ff" : "#fff" });

  const printPortal = createPortal(
    <div id="student-print-portal" style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif" }}>
      {/* Letterhead */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "3px solid #1e3a8a", paddingBottom: 12, marginBottom: 18 }}>
        <img src={schoolInfo.logoUrl || "/kips-logo.jpeg"} alt="KIPS" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%" }} onError={(e) => { (e.target as HTMLImageElement).src = "/kips-logo.jpeg"; }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#1e3a8a" }}>{schoolInfo.name || "KIPS School Hassari"}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ea580c", fontWeight: 700 }}>{schoolInfo.tagline || "Bright Future"}</p>
          <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7280" }}>{printDate}</p>
        </div>
      </div>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1e3a8a" }}>Student List{activeClass ? ` — Class ${activeClass.name}` : ""}{section ? ` / Section ${section}` : ""}</h2>
        <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7280" }}>Total Students: {filteredStudents?.length ?? 0}</p>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["#", "Adm #", "Student Name", "Father Name", "Class", "Sec", "Fee/Month", "Status"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {!filteredStudents?.length
            ? <tr><td colSpan={8} style={{ ...td(false), textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No students found</td></tr>
            : filteredStudents.map((s, i) => (
              <tr key={s.id}>
                <td style={td(i%2===1)}>{i+1}</td>
                <td style={{ ...td(i%2===1), color: "#7c3aed", fontFamily: "monospace", fontWeight: 700 }}>{s.admissionNumber}</td>
                <td style={{ ...td(i%2===1), fontWeight: 600 }}>{s.name}</td>
                <td style={td(i%2===1)}>{s.fatherName || "—"}</td>
                <td style={td(i%2===1)}>{s.className || "—"}</td>
                <td style={td(i%2===1)}>{s.section || "—"}</td>
                <td style={{ ...td(i%2===1), fontWeight: 700 }}>{s.feeAmount ? `PKR ${Number(s.feeAmount).toLocaleString()}` : "—"}</td>
                <td style={td(i%2===1)}>{s.status}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
      {/* Footer */}
      <div style={{ marginTop: 24, borderTop: "1px solid #e5e7eb", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#9ca3af" }}>
        <span>KIPS School Management System</span>
        <span>Printed: {printDate}</span>
      </div>
    </div>,
    document.body
  );

  return (
    <div className="space-y-4 pb-8">
      {printPortal}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeClass ? <>Class <strong className="text-gray-800">{activeClass.name}</strong>{section && <> — Section <strong>{section}</strong></>}</> : "All students"}
            {filteredStudents && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{filteredStudents.length} total</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 no-print">
          {/* View mode toggle */}
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("card")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode==="card" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <Grid3X3 className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setViewMode("list")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l ${viewMode==="list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"}`}>
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
          <Button onClick={() => setLocation("/students/new")}
            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> New Admission
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <Select value={classId || "all"} onValueChange={val => setLocation(val === "all" ? "/students" : `/students?classId=${val}`)}>
          <SelectTrigger className="w-full sm:w-44 font-medium">
            {activeClass
              ? <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full bg-gradient-to-br ${getGrad(activeClass.id)}`} /><SelectValue /></div>
              : <SelectValue placeholder="All Classes" />
            }
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all"><div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-gray-400" />All Classes</div></SelectItem>
            {sortedClasses.map(cls => (
              <SelectItem key={cls.id} value={String(cls.id)}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${GRADIENTS[classColorMap.get(cls.id)! % GRADIENTS.length]}`} />
                  {cls.name}{cls.studentCount > 0 && <span className="text-xs text-gray-400 ml-1">({cls.studentCount})</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search name or admission no..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {["all","active","inactive","left"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s==="all" ? undefined : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors border ${
                (s==="all" && !statusFilter) || statusFilter===s
                  ? "bg-gray-800 text-white border-gray-800 shadow-sm"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}>{s}</button>
          ))}
        </div>
      </div>

      {/* ── Colored accent bar for selected class ── */}
      {activeClass && <div className={`h-1.5 rounded-full bg-gradient-to-r ${getGrad(activeClass.id)}`} />}

      {/* ── Loading ── */}
      {isLoading ? (
        viewMode === "card"
          ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
          : <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
      ) : !filteredStudents?.length ? (
        <div className="text-center py-20 text-gray-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No students found</p>
          <p className="text-sm mt-1">{classId ? "No students in this class" : "Add a new student to get started"}</p>
        </div>

      /* ── CARD VIEW ── */
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => {
            const status = statusConfig[student.status as keyof typeof statusConfig] ?? statusConfig.active;
            const StatusIcon = status.icon;
            const grad = getGrad(student.classId), bgLt = getBgLt(student.classId);
            return (
              <div key={student.id} className={`rounded-2xl border overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col ${bgLt}`}>
                <div className={`h-2 bg-gradient-to-r ${grad}`} />
                <div className="p-4 flex-1 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0 border-2 border-white`}>
                      {student.imageUrl
                        ? <img src={student.imageUrl} alt={student.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                        : <span className="text-white font-bold text-xl">{student.name.charAt(0)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate text-base leading-tight">{student.name}</h3>
                      {student.fatherName && <p className="text-xs text-gray-500 truncate mt-0.5">s/o {student.fatherName}</p>}
                      <p className="text-[11px] font-mono text-purple-600 font-semibold mt-0.5">{student.admissionNumber}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {student.className && (
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${grad} text-white shadow-sm`}>
                        <BookOpen className="w-3 h-3" />{student.className}{student.section && <span className="opacity-80">/ {student.section}</span>}
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>
                      <StatusIcon className="w-3 h-3" />{status.label}
                    </span>
                  </div>
                  <div className="space-y-1 text-sm text-gray-600">
                    {student.feeAmount ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Fee</span>
                        <span className="font-semibold text-gray-800">PKR {Number(student.feeAmount).toLocaleString()}</span>
                        <span className="text-xs text-gray-400">/mo</span>
                      </div>
                    ) : null}
                    {student.phone && <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone className="w-3 h-3 text-gray-400" />{student.phone}</div>}
                  </div>
                  <div className="flex gap-2 mt-auto pt-2 border-t border-gray-200/70">
                    <button onClick={() => setLocation(`/students/${student.id}`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors">
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    <button onClick={() => setLocation(`/students/${student.id}`)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition-colors">
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button onClick={() => handleDelete(student.id, student.name)} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      /* ── LIST VIEW ── */
      ) : (
        <div className="rounded-xl border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                  {["#","Adm #","Student Name","Father Name","Class","Section","Fee/Month","Status","Actions"].map(h => (
                    <th key={h} className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student, i) => {
                  const status = statusConfig[student.status as keyof typeof statusConfig] ?? statusConfig.active;
                  const StatusIcon = status.icon;
                  const grad = getGrad(student.classId);
                  return (
                    <tr key={student.id} className={`border-b transition-colors hover:bg-blue-50/30 ${i%2===0 ? "bg-white" : "bg-gray-50/60"}`}>
                      <td className="py-2.5 px-3 text-gray-400 text-xs font-medium">{i+1}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-purple-600 font-bold whitespace-nowrap">{student.admissionNumber}</td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0`}>
                            {student.imageUrl
                              ? <img src={student.imageUrl} alt={student.name} className="w-full h-full rounded-lg object-cover" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                              : <span className="text-white text-xs font-bold">{student.name.charAt(0)}</span>}
                          </div>
                          <span className="font-semibold text-gray-900 whitespace-nowrap">{student.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{student.fatherName || "—"}</td>
                      <td className="py-2.5 px-3">
                        {student.className
                          ? <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${grad} text-white`}>{student.className}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600">{student.section || "—"}</td>
                      <td className="py-2.5 px-3 font-semibold text-gray-800 whitespace-nowrap">
                        {student.feeAmount ? `PKR ${Number(student.feeAmount).toLocaleString()}` : "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>
                          <StatusIcon className="w-3 h-3" />{status.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 no-print">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setLocation(`/students/${student.id}`)} className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors" title="View"><Eye className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setLocation(`/students/${student.id}`)} className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 transition-colors" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => handleDelete(student.id, student.name)} className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={9} className="py-2.5 px-3 text-xs font-semibold text-blue-800">
                    <Users className="w-3.5 h-3.5 inline mr-1.5" />
                    Total: {filteredStudents.length} student{filteredStudents.length !== 1 ? "s" : ""}
                    {activeClass && ` in Class ${activeClass.name}`}
                    {section && ` / Section ${section}`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
