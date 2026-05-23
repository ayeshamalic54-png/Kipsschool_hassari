import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useListStudents, useListClasses, ListStudentsParams } from "@workspace/api-client-react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Printer, Search, Phone, User, MapPin, BookOpen, Users,
  LayoutList, Grid3X3, PhoneCall, Home, GraduationCap,
} from "lucide-react";
import { useSchoolInfo } from "@/lib/school-info";
import { cn } from "@/lib/utils";

// ── Gradient palette (matches Students page) ─────────────────────────────────
const GRADIENTS = [
  "from-violet-500 to-purple-600","from-pink-500 to-rose-500",
  "from-blue-500 to-indigo-600",  "from-cyan-500 to-blue-500",
  "from-teal-500 to-emerald-500", "from-green-500 to-teal-600",
  "from-amber-400 to-orange-500", "from-orange-500 to-red-500",
  "from-fuchsia-500 to-pink-600", "from-sky-400 to-cyan-500",
  "from-emerald-500 to-green-600","from-rose-500 to-pink-600",
  "from-indigo-400 to-violet-500",
];
const CARD_BG = [
  { bg: "#f5f3ff", border: "#ddd6fe", tag: "#7c3aed" },  // violet
  { bg: "#fff1f2", border: "#fecdd3", tag: "#e11d48" },  // pink
  { bg: "#eff6ff", border: "#bfdbfe", tag: "#2563eb" },  // blue
  { bg: "#ecfeff", border: "#a5f3fc", tag: "#0891b2" },  // cyan
  { bg: "#f0fdf4", border: "#bbf7d0", tag: "#059669" },  // teal
  { bg: "#f0fdf4", border: "#86efac", tag: "#16a34a" },  // green
  { bg: "#fffbeb", border: "#fde68a", tag: "#d97706" },  // amber
  { bg: "#fff7ed", border: "#fed7aa", tag: "#ea580c" },  // orange
  { bg: "#fdf4ff", border: "#f0abfc", tag: "#c026d3" },  // fuchsia
  { bg: "#f0f9ff", border: "#bae6fd", tag: "#0284c7" },  // sky
  { bg: "#ecfdf5", border: "#6ee7b7", tag: "#059669" },  // emerald
  { bg: "#fff1f2", border: "#fda4af", tag: "#e11d48" },  // rose
  { bg: "#eef2ff", border: "#c7d2fe", tag: "#4f46e5" },  // indigo
];

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 0; }
  @media print {
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body > *:not(#contact-print-portal) { display: none !important; }
    #contact-print-portal {
      display: block !important; position: absolute !important;
      top: 0 !important; left: 0 !important; width: 100% !important;
      background: white !important; font-family: Arial, sans-serif !important;
      color: #111827 !important; font-size: 9.5pt !important;
      padding: 12mm 14mm !important; box-sizing: border-box !important;
    }
    table { border-collapse: collapse !important; width: 100% !important; }
    tr { page-break-inside: avoid; }
    thead { display: table-header-group; }
  }
`;

type StudentRow = {
  id: number; name: string; fatherName?: string | null; motherName?: string | null;
  admissionNumber: string; className?: string | null; classId?: number | null;
  section?: string | null; phone?: string | null; emergencyContact?: string | null;
  address?: string | null; status: string; imageUrl?: string | null;
};

export default function ContactList() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const schoolInfo = useSchoolInfo();

  const urlParams = new URLSearchParams(searchStr);
  const classId   = urlParams.get("classId") || undefined;

  const filterParams: ListStudentsParams = { status: "active" };
  if (search)  filterParams.search  = search;
  if (classId) filterParams.classId = Number(classId);

  const { data: students, isLoading } = useListStudents(filterParams);
  const { data: classes } = useListClasses();

  const sortedClasses = classes
    ? [...classes].sort((a, b) => {
        const na = parseInt(a.name) || 0, nb = parseInt(b.name) || 0;
        if (na && nb) return na - nb;
        return a.name.localeCompare(b.name);
      })
    : [];

  const classColorMap = new Map<number, number>();
  sortedClasses.forEach((cls, i) => classColorMap.set(cls.id, i % GRADIENTS.length));
  const getGrad = (cId?: number | null) => cId != null && classColorMap.has(cId) ? GRADIENTS[classColorMap.get(cId)!] : "from-slate-500 to-gray-600";
  const getCard = (cId?: number | null) => cId != null && classColorMap.has(cId) ? CARD_BG[classColorMap.get(cId)! % CARD_BG.length] : CARD_BG[0];

  const filtered = students as StudentRow[] | undefined;
  const activeClass = classId ? sortedClasses.find(c => String(c.id) === classId) : null;
  const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

  useEffect(() => {
    const el = document.createElement("style");
    el.id = "kips-contact-print"; el.textContent = PRINT_STYLES;
    document.head.appendChild(el);
    return () => { document.getElementById("kips-contact-print")?.remove(); };
  }, []);

  // ── Print styles ──────────────────────────────────────────────────────────
  const th = { padding: "7px 9px", background: "#1e3a8a", color: "#fff", fontWeight: 700, fontSize: 8.5, textAlign: "left" as const, border: "1px solid #93c5fd" };
  const td = (alt: boolean) => ({ padding: "5px 9px", border: "1px solid #e5e7eb", fontSize: 8.5, color: "#1f2937", background: alt ? "#eff6ff" : "#fff" });

  const printPortal = createPortal(
    <div id="contact-print-portal" style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif" }}>
      {/* Letterhead */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: "3px solid #1e3a8a", paddingBottom: 12, marginBottom: 16 }}>
        <img src={schoolInfo.logoUrl || "/kips-logo.jpeg"} alt="KIPS"
          style={{ width: 70, height: 70, objectFit: "cover", borderRadius: "50%" }}
          onError={e => { (e.target as HTMLImageElement).src = "/kips-logo.jpeg"; }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#1e3a8a" }}>{schoolInfo.name || "KIPS School Hassari"}</h1>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#ea580c", fontWeight: 700 }}>{schoolInfo.tagline || "Bright Future"}</p>
          <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7280" }}>{printDate}</p>
        </div>
      </div>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#1e3a8a" }}>
          Student Contact List{activeClass ? ` — Class ${activeClass.name}` : ""}
        </h2>
        <p style={{ margin: "3px 0 0", fontSize: 9, color: "#6b7280" }}>Total: {filtered?.length ?? 0} active students</p>
      </div>
      {/* Table */}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["#", "Adm #", "Student Name", "Father Name", "Class", "Sec", "Phone", "Emergency Contact", "Address"].map(h => (
              <th key={h} style={th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!filtered?.length
            ? <tr><td colSpan={9} style={{ ...td(false), textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No students found</td></tr>
            : filtered.map((s, i) => (
              <tr key={s.id}>
                <td style={td(i%2===1)}>{i+1}</td>
                <td style={{ ...td(i%2===1), color: "#7c3aed", fontFamily: "monospace", fontWeight: 700 }}>{s.admissionNumber}</td>
                <td style={{ ...td(i%2===1), fontWeight: 600 }}>{s.name}</td>
                <td style={td(i%2===1)}>{s.fatherName || "—"}</td>
                <td style={td(i%2===1)}>{s.className || "—"}</td>
                <td style={td(i%2===1)}>{s.section || "—"}</td>
                <td style={{ ...td(i%2===1), color: "#0369a1" }}>{s.phone || "—"}</td>
                <td style={{ ...td(i%2===1), color: "#047857" }}>{s.emergencyContact || "—"}</td>
                <td style={{ ...td(i%2===1), fontSize: 7.5, maxWidth: 120 }}>{s.address || "—"}</td>
              </tr>
            ))
          }
        </tbody>
      </table>
      <div style={{ marginTop: 20, borderTop: "1px solid #e5e7eb", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 8, color: "#9ca3af" }}>
        <span>KIPS School Management System — Contact Directory</span>
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
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <PhoneCall className="w-6 h-6 text-blue-600" /> Contact List
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {activeClass
              ? <>Class <strong className="text-gray-800">{activeClass.name}</strong> contact directory</>
              : "All active students — phone numbers and addresses"}
            {filtered && <span className="ml-2 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{filtered.length} students</span>}
          </p>
        </div>
        <div className="flex gap-2 no-print">
          <div className="flex border rounded-lg overflow-hidden">
            <button onClick={() => setViewMode("card")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "card" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
              <Grid3X3 className="w-3.5 h-3.5" /> Cards
            </button>
            <button onClick={() => setViewMode("list")}
              className={cn("flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold transition-colors border-l",
                viewMode === "list" ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50")}>
              <LayoutList className="w-3.5 h-3.5" /> List
            </button>
          </div>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3 no-print">
        <Select
          value={classId || "all"}
          onValueChange={val => setLocation(val === "all" ? "/students/contacts" : `/students/contacts?classId=${val}`)}>
          <SelectTrigger className="w-full sm:w-44 font-medium">
            {activeClass
              ? <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full bg-gradient-to-br ${getGrad(activeClass.id)}`} />
                  <SelectValue />
                </div>
              : <SelectValue placeholder="All Classes" />}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-gray-400" /> All Classes</div>
            </SelectItem>
            {sortedClasses.map(cls => (
              <SelectItem key={cls.id} value={String(cls.id)}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full bg-gradient-to-br ${GRADIENTS[classColorMap.get(cls.id)! % GRADIENTS.length]}`} />
                  {cls.name}
                  {(cls as Record<string,unknown>).studentCount != null && (
                    <span className="text-xs text-gray-400 ml-1">({(cls as Record<string,unknown>).studentCount as number})</span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search name or admission no..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {activeClass && <div className={`h-1.5 rounded-full bg-gradient-to-r ${getGrad(activeClass.id)}`} />}

      {/* ── Loading ── */}
      {isLoading ? (
        viewMode === "card"
          ? <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-52 rounded-2xl" />)}</div>
          : <div className="space-y-2">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>

      /* ── Empty ── */
      ) : !filtered?.length ? (
        <div className="text-center py-20 text-gray-500">
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium">No students found</p>
          <p className="text-sm mt-1 text-gray-400">Try adjusting the class filter or search term</p>
        </div>

      /* ── CARD VIEW ── */
      ) : viewMode === "card" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const card = getCard(s.classId);
            const grad = getGrad(s.classId);
            return (
              <div key={s.id}
                className="rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 border flex flex-col"
                style={{ background: card.bg, borderColor: card.border }}>

                {/* Top color strip */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${grad}`} />

                <div className="p-4 flex flex-col gap-3 flex-1">
                  {/* Student identity */}
                  <div className="flex items-center gap-3">
                    <div className={`w-13 h-13 w-[52px] h-[52px] rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center shadow-sm shrink-0 border-2 border-white/80 overflow-hidden`}>
                      {s.imageUrl
                        ? <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <span className="text-white font-extrabold text-xl">{s.name.charAt(0)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 truncate text-[15px] leading-tight">{s.name}</h3>
                      {s.fatherName && <p className="text-xs text-gray-500 truncate mt-0.5">s/o {s.fatherName}</p>}
                      <p className="text-[11px] font-mono mt-0.5 font-semibold" style={{ color: card.tag }}>{s.admissionNumber}</p>
                    </div>
                  </div>

                  {/* Class badge */}
                  {s.className && (
                    <div>
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r ${grad} text-white shadow-sm`}>
                        <BookOpen className="w-3 h-3" />
                        {s.className}{s.section && <span className="opacity-80">/ {s.section}</span>}
                      </span>
                    </div>
                  )}

                  {/* Contact info */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${card.border}` }}>
                      <Phone className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: card.tag }} />
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Phone</p>
                        <p className="font-semibold text-gray-800 text-sm truncate">{s.phone || <span className="text-gray-300 font-normal italic text-xs">Not provided</span>}</p>
                      </div>
                    </div>

                    {s.emergencyContact && (
                      <div className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${card.border}` }}>
                        <PhoneCall className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-500" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Emergency</p>
                          <p className="font-semibold text-emerald-700 text-sm truncate">{s.emergencyContact}</p>
                        </div>
                      </div>
                    )}

                    {s.address && (
                      <div className="flex items-start gap-2.5 rounded-lg px-3 py-2" style={{ background: "rgba(255,255,255,0.7)", border: `1px solid ${card.border}` }}>
                        <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Address</p>
                          <p className="text-gray-700 text-xs leading-relaxed line-clamp-2">{s.address}</p>
                        </div>
                      </div>
                    )}
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
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white">
                  {["#","Adm #","Student Name","Father Name","Class","Phone","Emergency","Address"].map(h => (
                    <th key={h} className="text-left py-3 px-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const grad = getGrad(s.classId);
                  const card = getCard(s.classId);
                  return (
                    <tr key={s.id} className={cn("border-b hover:bg-blue-50/30 transition-colors", i%2===0 ? "bg-white" : "bg-gray-50/50")}>
                      <td className="py-2.5 px-3 text-gray-400 text-xs font-medium">{i+1}</td>
                      <td className="py-2.5 px-3 font-mono text-[11px] font-bold whitespace-nowrap" style={{ color: card.tag }}>
                        {s.admissionNumber}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${grad} flex items-center justify-center shrink-0 overflow-hidden`}>
                            {s.imageUrl
                              ? <img src={s.imageUrl} alt={s.name} className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display="none"; }} />
                              : <span className="text-white text-xs font-bold">{s.name.charAt(0)}</span>}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 whitespace-nowrap">{s.name}</p>
                            {s.fatherName && <p className="text-[10px] text-gray-400">s/o {s.fatherName}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{s.fatherName || "—"}</td>
                      <td className="py-2.5 px-3">
                        {s.className
                          ? <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${grad} text-white`}>
                              {s.className}{s.section && `/${s.section}`}
                            </span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {s.phone
                          ? <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-sm">
                              <Phone className="w-3.5 h-3.5 text-blue-400" />{s.phone}
                            </div>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        {s.emergencyContact
                          ? <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-sm">
                              <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />{s.emergencyContact}
                            </div>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="py-2.5 px-3 text-gray-600 text-xs max-w-[200px] truncate">
                        {s.address
                          ? <div className="flex items-center gap-1.5"><Home className="w-3 h-3 text-gray-400 shrink-0" />{s.address}</div>
                          : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={8} className="py-2.5 px-3 text-xs font-semibold text-blue-800">
                    <Users className="w-3.5 h-3.5 inline mr-1.5" />
                    Total: {filtered.length} student{filtered.length !== 1 ? "s" : ""}
                    {activeClass && ` — Class ${activeClass.name}`}
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
