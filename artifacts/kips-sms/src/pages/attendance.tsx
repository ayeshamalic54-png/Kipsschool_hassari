                import { useState, useEffect } from "react";
                import { createPortal } from "react-dom";
                import {
                  useListAttendance, useMarkAttendance, useListStudents, useListStaff, useListClasses,
                  getListAttendanceQueryKey,
                } from "@workspace/api-client-react";
                import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
                import { Button } from "@/components/ui/button";
                import { Input } from "@/components/ui/input";
                import { Card, CardContent } from "@/components/ui/card";
                import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
                import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
                import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
                import { Skeleton } from "@/components/ui/skeleton";
                import { useForm } from "react-hook-form";
                import { zodResolver } from "@hookform/resolvers/zod";
                import { z } from "zod";
                import { useToast } from "@/hooks/use-toast";
                import { useAuthStore } from "@/lib/auth";
                import {
                  Plus, Loader2, Printer, CheckCircle, XCircle, Clock, Umbrella,
                  Users, TrendingDown, RefreshCw, ClipboardCheck, Trash2,
                } from "lucide-react";
                import { motion } from "framer-motion";

                // ─── PRINT CSS ────────────────────────────────────────────────────────────────
                const PRINT_STYLES = `
                  @page { size: A4 portrait; margin: 14mm 14mm; }
                  @media print {
                    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
                    body > *:not(#kips-print-portal) { display: none !important; }
                    #kips-print-portal {
                      display: block !important;
                      position: absolute !important;
                      top: 0 !important; left: 0 !important;
                      width: 100% !important;
                      background: white !important;
                      font-family: Arial, sans-serif !important;
                      color: #111827 !important;
                      font-size: 11pt !important;
                    }
                    #kips-print-portal * { font-family: Arial, sans-serif !important; }
                    table { border-collapse: collapse !important; width: 100% !important; page-break-inside: auto; }
                    tr    { page-break-inside: avoid; page-break-after: auto; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                  }
                `;

                const printDate = new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" });

                const schema = z.object({
                  type:     z.enum(["student", "staff"]),
                  personId: z.string().min(1, "Required"),
                  date:     z.string().min(1, "Date required"),
                  status:   z.enum(["present", "absent", "late", "leave"]),
                });

                const statusColors = {
                  present: "bg-emerald-100 text-emerald-700 border-emerald-200",
                  absent:  "bg-red-100 text-red-700 border-red-200",
                  late:    "bg-amber-100 text-amber-700 border-amber-200",
                  leave:   "bg-blue-100 text-blue-700 border-blue-200",
                };

                const statusBtnActive: Record<string, string> = {
                  present: "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-500",
                  absent:  "bg-red-500 hover:bg-red-600 text-white border-red-500",
                  late:    "bg-amber-400 hover:bg-amber-500 text-white border-amber-400",
                  leave:   "bg-blue-400 hover:bg-blue-500 text-white border-blue-400",
                };

                function authHeader(): Record<string, string> {
                  const token = localStorage.getItem("kips_token");
                  return token ? { Authorization: `Bearer ${token}` } : {};
                }

                // ─── Deduction Report ─────────────────────────────────────────────────────────
                type DeductionRow = {
                  id: number; name: string; role?: string; className?: string;
                  basicSalary?: number; feeAmount?: number; perDay: number;
                  absent: number; late: number; present: number; leave: number;
                  absentDed: number; lateDed: number; totalDeduction: number;
                  netSalary?: number; netFee?: number;
                };

                function DeductionReport() {
                  const now          = new Date();
                  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
                  const [month, setMonth]   = useState(defaultMonth);
                  const [type, setType]     = useState<"staff" | "student">("staff");
                  const [data, setData]     = useState<DeductionRow[]>([]);
                  const [loading, setLoading] = useState(false);

                  const fetchData = () => {
                    setLoading(true);
                    fetch(`/api/attendance/monthly-deductions?month=${month}&type=${type}`, {
                      headers: authHeader() as HeadersInit,
                    })
                      .then(r => r.json())
                      .then(d => setData(Array.isArray(d) ? d : []))
                      .catch(() => setData([]))
                      .finally(() => setLoading(false));
                  };

                  useEffect(() => { fetchData(); }, [month, type]);

                  const totalDeductions = data.reduce((a, r) => a + r.totalDeduction, 0);
                  const totalAbsent     = data.reduce((a, r) => a + r.absent, 0);
                  const totalLate       = data.reduce((a, r) => a + r.late, 0);
                  const withDeductions  = data.filter(r => r.totalDeduction > 0).length;
                  const monthLabel      = new Date(month + "-01").toLocaleDateString("en-PK", { month: "long", year: "numeric" });

                  return (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                        <div className="flex items-center gap-2">
                          <label className="text-sm font-medium text-gray-600">Month:</label>
                          <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="w-40 h-8 text-sm" />
                        </div>
                        <div className="flex gap-2">
                          {(["staff", "student"] as const).map(t => (
                            <Button key={t} size="sm" variant={type === t ? "default" : "outline"} onClick={() => setType(t)} className="capitalize">
                              {t === "staff" ? "Teachers" : "Students"}
                            </Button>
                          ))}
                        </div>
                        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading}>
                          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? "animate-spin" : ""}`} /> Refresh
                        </Button>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          { label: "Total Absent Days",     value: totalAbsent,                               gradient: "from-red-500 to-rose-600",    icon: XCircle     },
                          { label: "Total Late Days",       value: totalLate,                                 gradient: "from-amber-400 to-orange-500", icon: Clock       },
                          { label: "With Deductions",       value: withDeductions,                            gradient: "from-violet-500 to-purple-600",icon: TrendingDown },
                          { label: "Total Deduction (PKR)", value: `PKR ${totalDeductions.toLocaleString()}`, gradient: "from-slate-600 to-gray-700",  icon: TrendingDown },
                        ].map((c, i) => (
                          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                            <Card className="overflow-hidden border-0 shadow-sm">
                              <CardContent className="p-0">
                                <div className={`bg-gradient-to-br ${c.gradient} p-3`}>
                                  <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{c.label}</p>
                                  <p className="text-white text-lg font-bold mt-1">{c.value}</p>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>

                      <Card>
                        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-700">
                            {type === "staff" ? "Teacher" : "Student"} Deduction Report — {monthLabel}
                          </h3>
                          <Button size="sm" variant="outline" onClick={() => window.print()}>
                            <Printer className="w-3.5 h-3.5 mr-1" /> Print
                          </Button>
                        </div>
                        <CardContent className="p-0">
                          {loading ? (
                            <div className="p-6 space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                          ) : data.length === 0 ? (
                            <div className="py-16 text-center text-gray-400">
                              <TrendingDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
                              <p className="text-sm">No attendance data found for {monthLabel}</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-600">#</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-600">Name</th>
                                    <th className="text-left py-3 px-3 font-semibold text-gray-600">{type === "staff" ? "Role" : "Class"}</th>
                                    <th className="text-center py-3 px-3 font-semibold text-emerald-700">Present</th>
                                    <th className="text-center py-3 px-3 font-semibold text-red-700">Absent</th>
                                    <th className="text-center py-3 px-3 font-semibold text-amber-700">Late</th>
                                    <th className="text-right py-3 px-3 font-semibold text-gray-600">{type === "staff" ? "Basic (PKR)" : "Fee (PKR)"}</th>
                                    <th className="text-right py-3 px-3 font-semibold text-red-700">Deduction</th>
                                    <th className="text-right py-3 px-3 font-semibold text-emerald-700">Net {type === "staff" ? "Salary" : "Fee"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.map((row, i) => {
                                    const hasDeduction = row.totalDeduction > 0;
                                    return (
                                      <tr key={row.id} className={`border-b hover:bg-gray-50 ${hasDeduction ? "bg-red-50/30" : ""}`}>
                                        <td className="py-2.5 px-3 text-gray-500">{i + 1}</td>
                                        <td className="py-2.5 px-3 font-medium text-gray-900">{row.name}</td>
                                        <td className="py-2.5 px-3 text-gray-500 text-xs">{row.role ?? row.className}</td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">{row.present}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.absent > 0 ? "bg-red-100 text-red-700" : "text-gray-400"}`}>{row.absent}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-center">
                                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${row.late > 0 ? "bg-amber-100 text-amber-700" : "text-gray-400"}`}>{row.late}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-medium text-gray-700">
                                          {(row.basicSalary ?? row.feeAmount ?? 0).toLocaleString()}
                                        </td>
                                        <td className="py-2.5 px-3 text-right">
                                          {hasDeduction ? (
                                            <div className="text-red-600 font-medium">
                                              <div>-{row.totalDeduction.toLocaleString()}</div>
                                              {row.absentDed > 0 && <div className="text-xs text-red-400">{row.absent}d absent</div>}
                                              {row.lateDed > 0  && <div className="text-xs text-amber-500">{row.late}d late</div>}
                                            </div>
                                          ) : (
                                            <span className="text-gray-400 text-xs">—</span>
                                          )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                                          {(row.netSalary ?? row.netFee ?? 0).toLocaleString()}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot className="bg-gray-50 border-t-2">
                                  <tr>
                                    <td colSpan={7} className="py-2.5 px-3 font-semibold text-gray-700 text-right">Total Deductions:</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-red-700">-{totalDeductions.toLocaleString()}</td>
                                    <td className="py-2.5 px-3" />
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  );
                }

                // ─── Bulk Attendance ──────────────────────────────────────────────────────────
                type BulkRow = {
                  id: number;
                  name: string;
                  extra?: string;
                  status: "present" | "absent" | "late" | "leave";
                };

                function BulkAttendance() {
                  const { toast }   = useToast();
                  const queryClient = useQueryClient();
                  const [bulkType,  setBulkType]  = useState<"student" | "staff">("student");
                  const [bulkDate,  setBulkDate]  = useState(new Date().toISOString().split("T")[0]);
                  // Optional end date for a range. When equal to bulkDate (or empty)
                  // we save a single day, otherwise we save the same status for every
                  // day in [bulkDate .. bulkDateTo].
                  const [bulkDateTo, setBulkDateTo] = useState(new Date().toISOString().split("T")[0]);
                  const [classId,   setClassId]   = useState<string>("");
                  const [rows,      setRows]      = useState<BulkRow[]>([]);
                  const [saving,    setSaving]    = useState(false);
                  const [loaded,    setLoaded]    = useState(false);

                  const { data: classes }  = useListClasses();
                  const { data: students } = useListStudents({});
                  const { data: staff }    = useListStaff();

                  const loadPeople = () => {
                    if (bulkType === "student") {
                      const filtered = (students ?? []).filter(s =>
                        s.status === "active" && (classId ? String(s.classId) === classId : true)
                      );
                      setRows(filtered.map(s => ({ id: s.id, name: s.name, extra: s.className ?? "", status: "present" })));
                    } else {
                      setRows(
                        (staff ?? [])
                          .filter(s => s.status === "active")
                          .map(s => ({ id: s.id, name: s.name, extra: s.role, status: "present" }))
                      );
                    }
                    setLoaded(true);
                  };

                  const setStatus = (id: number, status: BulkRow["status"]) =>
                    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r));

                  const setAll = (status: BulkRow["status"]) =>
                    setRows(prev => prev.map(r => ({ ...r, status })));

                  // Build list of YYYY-MM-DD strings between `from` and `to` (inclusive).
                  // Returns just `[from]` if `to` is empty or earlier than `from`.
                  const datesInRange = (from: string, to: string): string[] => {
                    if (!from) return [];
                    if (!to || to < from) return [from];
                    const out: string[] = [];
                    const cur = new Date(from + "T00:00:00Z");
                    const end = new Date(to   + "T00:00:00Z");
                    while (cur <= end) {
                      out.push(cur.toISOString().slice(0, 10));
                      cur.setUTCDate(cur.getUTCDate() + 1);
                    }
                    return out;
                  };

                  const handleSave = async () => {
                    if (!rows.length) return;
                    const dates = datesInRange(bulkDate, bulkDateTo);
                    if (!dates.length) return;
                    // Safety guard: bulk × range can grow large. Warn for big jobs.
                    const total = dates.length * rows.length;
                    if (total > 2000 && !window.confirm(
                      `This will save ${total} records (${rows.length} people × ${dates.length} days). Continue?`
                    )) return;
                    setSaving(true);
                    try {
                      const records = dates.flatMap(d =>
                        rows.map(r => ({
                          date:      d,
                          type:      bulkType,
                          status:    r.status,
                          studentId: bulkType === "student" ? r.id : null,
                          staffId:   bulkType === "staff"   ? r.id : null,
                        }))
                      );
                      const res = await fetch("/api/attendance/bulk", {
                        method:  "POST",
                        headers: { "Content-Type": "application/json", ...authHeader() },
                        body:    JSON.stringify({ records }),
                      });
                      if (!res.ok) throw new Error("Failed");
                      const data = await res.json() as { saved: number };
                      const rangeLabel = dates.length === 1 ? bulkDate : `${dates[0]} → ${dates[dates.length - 1]} (${dates.length} days)`;
                      toast({ title: `✓ ${data.saved} attendance records saved for ${rangeLabel}` });
                      // Refresh the Daily tab and any dependent views so the new records show immediately.
                      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey(), refetchType: "all" });
                      setLoaded(false);
                      setRows([]);
                    } catch {
                      toast({ variant: "destructive", title: "Failed to save bulk attendance" });
                    } finally {
                      setSaving(false);
                    }
                  };

                  const presentCount = rows.filter(r => r.status === "present").length;
                  const absentCount  = rows.filter(r => r.status === "absent").length;
                  const lateCount    = rows.filter(r => r.status === "late").length;
                  const leaveCount   = rows.filter(r => r.status === "leave").length;

                  return (
                    <div className="space-y-4">
                      {/* Controls */}
                      <Card>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
                              <div className="flex gap-2">
                                {(["student", "staff"] as const).map(t => (
                                  <Button
                                    key={t} size="sm"
                                    variant={bulkType === t ? "default" : "outline"}
                                    onClick={() => { setBulkType(t); setLoaded(false); setRows([]); }}
                                    className="capitalize flex-1"
                                  >
                                    {t === "staff" ? "Staff" : "Students"}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">Date From</label>
                              <Input
                                type="date"
                                value={bulkDate}
                                onChange={e => {
                                  const v = e.target.value;
                                  setBulkDate(v);
                                  if (v && bulkDateTo && v > bulkDateTo) setBulkDateTo(v);
                                  setLoaded(false); setRows([]);
                                }}
                                className="h-9"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-medium text-gray-600 block mb-1">
                                Date To <span className="text-gray-400 font-normal">(same day if blank)</span>
                              </label>
                              <Input
                                type="date"
                                value={bulkDateTo}
                                min={bulkDate}
                                onChange={e => { setBulkDateTo(e.target.value); setLoaded(false); setRows([]); }}
                                className="h-9"
                              />
                            </div>

                            {bulkType === "student" && (
                              <div>
                                <label className="text-xs font-medium text-gray-600 block mb-1">Class (optional)</label>
                                <Select
                                  value={classId || "all"}
                                  onValueChange={(v) => {
                                    setClassId(v === "all" ? "" : v);
                                    setLoaded(false);
                                    setRows([]);
                                  }}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue placeholder="All classes" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">All classes</SelectItem>
                                    {classes?.map((c) => (
                                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div className="flex items-end">
                              <Button onClick={loadPeople} className="h-9 w-full bg-amber-500 hover:bg-amber-600 text-white">
                                <Users className="w-4 h-4 mr-2" /> Load People
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Bulk table */}
                      {loaded && rows.length > 0 && (
                        <Card>
                          {/* Summary bar */}
                          <div className="px-4 py-3 border-b bg-gray-50 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3 text-sm">
                              <span className="font-semibold text-gray-700">{rows.length} people</span>
                              <span className="text-emerald-600 font-medium">✓ {presentCount} Present</span>
                              <span className="text-red-600 font-medium">✗ {absentCount} Absent</span>
                              <span className="text-amber-600 font-medium">⏰ {lateCount} Late</span>
                              <span className="text-blue-600 font-medium">🏖 {leaveCount} Leave</span>
                            </div>
                            {/* Quick set all */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs text-gray-500 font-medium">Set all:</span>
                              {(["present", "absent", "late", "leave"] as const).map(s => (
                                <button
                                  key={s}
                                  onClick={() => setAll(s)}
                                  className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize ${statusBtnActive[s]}`}
                                >
                                  {s === "present" ? "✓ Present" : s === "absent" ? "✗ Absent" : s === "late" ? "⏰ Late" : "🏖 Leave"}
                                </button>
                              ))}
                            </div>
                          </div>

                          <CardContent className="p-0">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b">
                                  <tr>
                                    <th className="text-left py-2.5 px-4 font-semibold text-gray-600">#</th>
                                    <th className="text-left py-2.5 px-4 font-semibold text-gray-600">Name</th>
                                    <th className="text-left py-2.5 px-4 font-semibold text-gray-600">
                                      {bulkType === "student" ? "Class" : "Role"}
                                    </th>
                                    <th className="text-center py-2.5 px-4 font-semibold text-gray-600">Status</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {rows.map((row, i) => (
                                    <tr key={row.id} className="border-b hover:bg-gray-50">
                                      <td className="py-2 px-4 text-gray-400 text-xs">{i + 1}</td>
                                      <td className="py-2 px-4 font-medium text-gray-900">{row.name}</td>
                                      <td className="py-2 px-4 text-gray-500 text-xs">{row.extra}</td>
                                      <td className="py-2 px-4">
                                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                          {(["present", "absent", "late", "leave"] as const).map(s => (
                                            <button
                                              key={s}
                                              onClick={() => setStatus(row.id, s)}
                                              className={`text-xs px-2.5 py-1 rounded-full border font-medium capitalize transition-all ${
                                                row.status === s
                                                  ? statusBtnActive[s]
                                                  : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                                              }`}
                                            >
                                              {s === "present" ? "✓ Present" : s === "absent" ? "✗ Absent" : s === "late" ? "⏰ Late" : "🏖 Leave"}
                                            </button>
                                          ))}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>

                            <div className="p-4 border-t flex justify-end">
                              <Button
                                onClick={handleSave}
                                disabled={saving}
                                className="bg-gradient-to-r from-emerald-600 to-green-600 text-white px-8"
                              >
                                {saving
                                  ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</>
                                  : <><ClipboardCheck className="w-4 h-4 mr-2" /> Save Attendance ({rows.length})</>
                                }
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {loaded && rows.length === 0 && (
                        <Card>
                          <CardContent className="py-16 text-center text-gray-400">
                            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>No active {bulkType === "staff" ? "staff members" : "students"} found</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  );
                }

                // ─── Main Attendance Component ────────────────────────────────────────────────
                export default function Attendance() {
                  const today = new Date().toISOString().split("T")[0];
                  const [tab,           setTab]         = useState<"bulk" | "daily" | "deductions">("bulk");
                  const [open,          setOpen]         = useState(false);
                  const [dateFrom,      setDateFrom]    = useState(today);
                  const [dateTo,        setDateTo]      = useState(today);
                  const [typeFilter,    setTypeFilter]   = useState<"student" | "staff">("student");
                  // Backward-compatible single-day date used by the "Mark Attendance" dialog default.
                  const dateFilter = dateFrom;
                  const { toast }       = useToast();
                  const queryClient     = useQueryClient();

                  // Inject print styles
                  useEffect(() => {
                    const existing = document.getElementById("kips-print-styles");
                    if (existing) existing.remove();
                    const el = document.createElement("style");
                    el.id = "kips-print-styles";
                    el.textContent = PRINT_STYLES;
                    document.head.appendChild(el);
                    return () => { document.getElementById("kips-print-styles")?.remove(); };
                  }, []);

                  // Fetch attendance over a date range. Falls back to single-day when
                  // dateFrom === dateTo. Query key mirrors the one used by the generated
                  // hook so cache invalidations from BulkAttendance also hit this query.
                  const { data: attendance, isLoading } = useQuery<Array<{
                    id: number; date: string; type: string; status: string;
                    studentId: number | null; staffId: number | null;
                    personName: string | null; className: string | null;
                  }>>({
                    queryKey: [...getListAttendanceQueryKey(), { dateFrom, dateTo, type: typeFilter }],
                    queryFn: async () => {
                      const params = new URLSearchParams({ dateFrom, dateTo, type: typeFilter });
                      const res = await fetch(`/api/attendance?${params.toString()}`, {
                        headers: authHeader() as HeadersInit,
                      });
                      if (!res.ok) throw new Error("Failed");
                      return res.json();
                    },
                  });
                  const { data: students }   = useListStudents({});
                  const { data: staff }      = useListStaff();
                  const markMutation         = useMarkAttendance();
                  const { user }             = useAuthStore();
                  const isStudent            = user?.role === "student";

                  // Students should only see the daily attendance tab (read-only)
                  useEffect(() => {
                    if (isStudent) setTab("daily");
                  }, [isStudent]);

                  const deleteAttendance = useMutation({
                    mutationFn: async (id: number) => {
                      const res = await fetch(`/api/attendance/${id}`, {
                        method: "DELETE",
                        headers: authHeader(),
                      });
                      if (!res.ok) throw new Error("Failed");
                    },
                    onSuccess: () => {
                      queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
                      toast({ title: "Record deleted" });
                    },
                    onError: () => toast({ variant: "destructive", title: "Failed to delete" }),
                  });

                  const form = useForm<z.infer<typeof schema>>({
                    resolver: zodResolver(schema),
                    defaultValues: { type: "student", date: new Date().toISOString().split("T")[0], status: "present" },
                  });

                  const watchType = form.watch("type");

                  const present = attendance?.filter(a => a.status === "present").length ?? 0;
                  const absent  = attendance?.filter(a => a.status === "absent").length  ?? 0;
                  const late    = attendance?.filter(a => a.status === "late").length    ?? 0;
                  const leave   = attendance?.filter(a => a.status === "leave").length   ?? 0;
                  const total   = attendance?.length ?? 0;

                  const onSubmit = (values: z.infer<typeof schema>) => {
                    const data = {
                      type: values.type, date: values.date, status: values.status,
                      studentId: values.type === "student" ? Number(values.personId) : null,
                      staffId:   values.type === "staff"   ? Number(values.personId) : null,
                    };
                    markMutation.mutate({ data }, {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
                        toast({ title: "Attendance marked" });
                        setOpen(false);
                        form.reset();
                      },
                      onError: () => toast({ variant: "destructive", title: "Failed to mark attendance" }),
                    });
                  };

                  const summaryCards = [
                    { label: "Total",   value: total,   icon: Users,       gradient: "from-blue-500 to-cyan-500"     },
                    { label: "Present", value: present, icon: CheckCircle, gradient: "from-emerald-500 to-green-500"  },
                    { label: "Absent",  value: absent,  icon: XCircle,     gradient: "from-red-500 to-rose-600"       },
                    { label: "Late",    value: late,    icon: Clock,       gradient: "from-amber-400 to-orange-500"   },
                    { label: "Leave",   value: leave,   icon: Umbrella,    gradient: "from-blue-400 to-indigo-500"    },
                  ];

                  const dateLabel = new Date(dateFilter + "T00:00:00").toLocaleDateString("en-PK", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                  });

                  // Print table styles
                  const thS = { padding: "8px 10px", background: "#fef3c7", color: "#92400e", fontWeight: 700, fontSize: 10, textAlign: "left" as const, border: "1px solid #fcd34d" };
                  const td  = { padding: "7px 10px", border: "1px solid #e5e7eb", fontSize: 10, color: "#1f2937", background: "#ffffff" };
                  const tdA = { ...td, background: "#f9fafb" };

                  const statusLabel = (s: string) => ({ present: "Present", absent: "Absent", late: "Late", leave: "Leave" }[s] ?? s);

                  // ─── PRINT PORTAL ──────────────────────────────────────────────────────────
                  const printPortal = createPortal(
                    <div
                      id="kips-print-portal"
                      style={{ position: "absolute", left: "-99999px", top: "-99999px", fontFamily: "Arial, sans-serif", background: "white", color: "#111827" }}
                    >
                      {/* Letterhead */}
                      <div style={{ display: "flex", alignItems: "center", gap: 18, borderBottom: "3px solid #1e3a8a", paddingBottom: 14, marginBottom: 20 }}>
                        <img src="/kips-logo.jpeg" alt="KIPS" style={{ width: 80, height: 80, objectFit: "contain", flexShrink: 0 }} />
                        <div style={{ flex: 1, textAlign: "center" }}>
                          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#1e3a8a" }}>KIPS School Hassari</h1>
                          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#ea580c", fontWeight: 700 }}>Bright Future — School Portal</p>
                          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#6b7280" }}>{printDate}</p>
                        </div>
                      </div>

                      {/* Title */}
                      <div style={{ textAlign: "center", marginBottom: 20 }}>
                        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#1e3a8a" }}>Attendance Report</h2>
                        <p style={{ margin: "3px 0 0", fontSize: 10, color: "#6b7280" }}>
                          {dateLabel} — {typeFilter === "student" ? "Students" : "Staff"}
                        </p>
                      </div>

                      {/* Summary cards */}
                      <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
                        {[
                          { label: "Total",   value: total,   color: "#1d4ed8" },
                          { label: "Present", value: present, color: "#065f46" },
                          { label: "Absent",  value: absent,  color: "#b91c1c" },
                          { label: "Late",    value: late,    color: "#92400e" },
                          { label: "Leave",   value: leave,   color: "#1e40af" },
                        ].map(c => (
                          <div
                            key={c.label}
                            style={{ flex: "1 1 0", border: `2px solid ${c.color}`, borderRadius: 8, padding: "12px 8px", textAlign: "center", background: "#f9fafb" }}
                          >
                            <p style={{ margin: 0, fontSize: 9, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.8 }}>{c.label}</p>
                            <p style={{ margin: "7px 0 0", fontSize: 20, fontWeight: 900, color: c.color }}>{c.value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Table */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{ width: 4, height: 18, background: "#d97706", borderRadius: 2 }} />
                        <h3 style={{ margin: 0, fontSize: 11, fontWeight: 800, color: "#92400e", textTransform: "uppercase", letterSpacing: 0.7 }}>
                          Attendance Records — {total} Entries
                        </h3>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead>
                          <tr>{["#", "Name", "Class / Role", "Date", "Type", "Status"].map(h => <th key={h} style={thS}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {!(attendance ?? []).length
                            ? <tr><td colSpan={6} style={{ ...td, textAlign: "center", color: "#9ca3af", fontStyle: "italic" }}>No records</td></tr>
                            : (attendance ?? []).map((att, i) => (
                              <tr key={att.id}>
                                <td style={i % 2 === 0 ? td : tdA}>{i + 1}</td>
                                <td style={i % 2 === 0 ? td : tdA}>{att.personName ?? "—"}</td>
                                <td style={i % 2 === 0 ? td : tdA}>{att.className ?? "—"}</td>
                                <td style={i % 2 === 0 ? td : tdA}>{att.date}</td>
                                <td style={i % 2 === 0 ? td : tdA}>{att.type}</td>
                                <td style={i % 2 === 0 ? td : tdA}>{statusLabel(att.status)}</td>
                              </tr>
                            ))
                          }
                        </tbody>
                        <tfoot>
                          <tr style={{ background: "#fef3c7" }}>
                            <td colSpan={4} style={thS}>Summary</td>
                            <td colSpan={2} style={{ ...thS, color: "#065f46" }}>
                              Present: {present} | Absent: {absent} | Late: {late} | Leave: {leave}
                            </td>
                          </tr>
                        </tfoot>
                      </table>

                      {/* Footer */}
                      <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 28, paddingTop: 10, display: "flex", justifyContent: "space-between" }}>
                        <p style={{ margin: 0, fontSize: 8, color: "#9ca3af" }}>KIPS School Hassari — Bright Future School Management Portal</p>
                        <p style={{ margin: 0, fontSize: 8, color: "#9ca3af" }}>Generated: {printDate}</p>
                      </div>
                    </div>,
                    document.body
                  );

                  return (
                    <>
                      {printPortal}

                      <div className="space-y-6">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div>
                            <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
                            <p className="text-gray-500 text-sm mt-1">
                              {tab === "bulk"
                                ? "Mark attendance for entire class at once"
                                : tab === "daily"
                                ? `Daily tracking — ${dateLabel}`
                                : "Monthly deduction report"}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={() => window.print()}>
                              <Printer className="w-4 h-4 mr-1" /> Print
                            </Button>
                            {tab === "daily" && !isStudent && (
                              <Dialog open={open} onOpenChange={setOpen}>
                                <DialogTrigger asChild>
                                  <Button className="bg-gradient-to-r from-amber-500 to-orange-500 text-white">
                                    <Plus className="w-4 h-4 mr-2" /> Mark Attendance
                                  </Button>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
                                  <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                      <FormField control={form.control} name="type" render={({ field }) => (
                                        <FormItem><FormLabel>Type</FormLabel>
                                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                              <SelectItem value="student">Student</SelectItem>
                                              <SelectItem value="staff">Staff / Teacher</SelectItem>
                                            </SelectContent>
                                          </Select><FormMessage />
                                        </FormItem>
                                      )} />
                                      <FormField control={form.control} name="personId" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>{watchType === "student" ? "Student" : "Staff Member"} *</FormLabel>
                                          <Select onValueChange={field.onChange}>
                                            <FormControl><SelectTrigger><SelectValue placeholder={`Select ${watchType}`} /></SelectTrigger></FormControl>
                                            <SelectContent>
                                              {watchType === "student"
                                                ? students?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} — {s.className}</SelectItem>)
                                                : staff?.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.role})</SelectItem>)
                                              }
                                            </SelectContent>
                                          </Select><FormMessage />
                                        </FormItem>
                                      )} />
                                      <FormField control={form.control} name="date" render={({ field }) => (
                                        <FormItem>
                                          <FormLabel>Date *</FormLabel>
                                          <FormControl><Input type="date" {...field} /></FormControl>
                                          <FormMessage />
                                        </FormItem>
                                      )} />
                                      <FormField control={form.control} name="status" render={({ field }) => (
                                        <FormItem><FormLabel>Status</FormLabel>
                                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                              <SelectItem value="present">✅ Present</SelectItem>
                                              <SelectItem value="absent">❌ Absent</SelectItem>
                                              <SelectItem value="late">🕐 Late</SelectItem>
                                              <SelectItem value="leave">🏖️ Leave</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </FormItem>
                                      )} />
                                      <div className="flex justify-end gap-2">
                                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                                        <Button type="submit" disabled={markMutation.isPending}>
                                          {markMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />} Mark
                                        </Button>
                                      </div>
                                    </form>
                                  </Form>
                                </DialogContent>
                              </Dialog>
                            )}
                          </div>
                        </div>

                        {/* Tab switcher — students only see Daily Attendance */}
                        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
                          {!isStudent && (
                            <button
                              onClick={() => setTab("bulk")}
                              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "bulk" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              <ClipboardCheck className="w-3.5 h-3.5" /> Bulk Mark
                            </button>
                          )}
                          <button
                            onClick={() => setTab("daily")}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${tab === "daily" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                          >
                            {isStudent ? "My Attendance" : "Daily Attendance"}
                          </button>
                          {!isStudent && (
                            <button
                              onClick={() => setTab("deductions")}
                              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "deductions" ? "bg-white shadow-sm text-gray-900" : "text-gray-500 hover:text-gray-700"}`}
                            >
                              <TrendingDown className="w-3.5 h-3.5" /> Deduction Report
                            </button>
                          )}
                        </div>

                        {/* ── BULK TAB ── */}
                        {tab === "bulk" && <BulkAttendance />}

                        {/* ── DEDUCTIONS TAB ── */}
                        {tab === "deductions" && <DeductionReport />}

                        {/* ── DAILY TAB ── */}
                        {tab === "daily" && (
                          <>
                            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                              {summaryCards.map((card, i) => (
                                <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: i * 0.05 }}>
                                  <Card className="overflow-hidden border-0 shadow-sm">
                                    <CardContent className="p-0">
                                      <div className={`bg-gradient-to-br ${card.gradient} p-4`}>
                                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                                          <div>
                                            <p className="text-white/80 text-xs font-medium uppercase tracking-wide">{card.label}</p>
                                            {isLoading
                                              ? <Skeleton className="h-6 w-10 mt-1 bg-white/30" />
                                              : <p className="text-white text-2xl font-bold mt-1">{card.value}</p>
                                            }
                                          </div>
                                          <div className="bg-white/20 rounded-xl p-2">
                                            <card.icon className="w-5 h-5 text-white" />
                                          </div>
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </motion.div>
                              ))}
                            </div>

                            <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-600">From:</label>
                                <Input
                                  type="date"
                                  value={dateFrom}
                                  onChange={e => {
                                    const v = e.target.value;
                                    setDateFrom(v);
                                    // Auto-snap dateTo forward if it ends up before dateFrom
                                    if (v && dateTo && v > dateTo) setDateTo(v);
                                  }}
                                  className="w-auto h-9"
                                />
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-gray-600">To:</label>
                                <Input
                                  type="date"
                                  value={dateTo}
                                  min={dateFrom}
                                  onChange={e => setDateTo(e.target.value)}
                                  className="w-auto h-9"
                                />
                              </div>
                              <Button size="sm" variant="ghost" onClick={() => { setDateFrom(today); setDateTo(today); }}>
                                Today
                              </Button>
                              <div className="flex gap-2 sm:ml-auto">
                                {(["student", "staff"] as const).map(t => (
                                  <Button
                                    key={t} size="sm"
                                    variant={typeFilter === t ? "default" : "outline"}
                                    onClick={() => setTypeFilter(t)}
                                    className="capitalize"
                                  >
                                    {t}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <Card>
                              <CardContent className="p-0">
                                {isLoading ? (
                                  <div className="p-6 space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          {["#", "Name", "Class / Role", "Date", "Type", "Status", ""].map(h => (
                                            <th key={h} className="text-left py-3 px-3 font-semibold text-gray-600">{h}</th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {!attendance?.length ? (
                                          <tr>
                                            <td colSpan={6} className="py-12 text-center text-gray-400">
                                              No attendance records for this date
                                            </td>
                                          </tr>
                                        ) : (
                                          attendance?.map((att, i) => {
                                            const sc = statusColors[att.status as keyof typeof statusColors] ?? statusColors.present; 
                              return (
                                <tr key={att.id} className="border-b hover:bg-gray-50">
                                  <td className="py-3 px-3 text-gray-500">{i + 1}</td>
                                  <td className="py-3 px-3 font-medium text-gray-900">{att.personName ?? "—"}</td>
                                  <td className="py-3 px-3 text-gray-600">{att.className ?? "—"}</td>
                                  <td className="py-3 px-3 text-gray-600">{att.date}</td>
                                  <td className="py-3 px-3 capitalize text-gray-600">{att.type}</td>
                                  <td className="py-3 px-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border capitalize ${sc}`}>
                                      {att.status}
                                    </span>
                                  </td>
                                  <td className="py-3 px-2">
                                    {!isStudent && (
                                      <button
                                        onClick={() => deleteAttendance.mutate(att.id)}
                                        disabled={deleteAttendance.isPending}
                                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 hover:text-red-700 transition-colors"
                                        title="Delete record"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
                                            