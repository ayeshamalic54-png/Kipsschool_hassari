import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Download, Upload, Trash2, RefreshCw, Shield, Database, Clock,
  CheckCircle, CalendarClock, Play, AlertCircle, Zap, RotateCcw,
  Calculator, Save,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface SavedBackup {
  filename: string;
  size: number;
  createdAt: string;
}

interface AutoBackupStatus {
  lastRun: string | null;
  lastStatus: "never" | "success" | "error";
  lastError: string | null;
  nextRun: string;
  enabled: boolean;
  autoBackupCount: number;
  autoBackupFiles: string[];
}

interface DeductionCriteria {
  workingDaysPerMonth: number;
  absentPenaltyFraction: string;
  latePenaltyFraction: string;
  leavePenaltyFraction: string;
}

const API = "/api/admin";

// ── Token — multiple possible keys try karta hai ─────────────────────────────
function getToken(): string {
  return (
    localStorage.getItem("kips_token") ??
    localStorage.getItem("token")      ??
    localStorage.getItem("authToken")  ??
    sessionStorage.getItem("token")    ??
    ""
  );
}

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ── Safe fetch wrapper ────────────────────────────────────────────────────────
async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...authHeader(),
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try {
      const clone = res.clone();
      const json = await clone.json();
      errMsg = json.error ?? json.message ?? errMsg;
    } catch { /* response not JSON — keep HTTP status */ }
    throw new Error(errMsg);
  }
  return res;
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Settings() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [backups,           setBackups]           = useState<SavedBackup[]>([]);
  const [loadingBackups,    setLoadingBackups]    = useState(false);
  const [saving,            setSaving]            = useState(false);
  const [restoring,         setRestoring]         = useState(false);
  const [restoreTarget,     setRestoreTarget]     = useState<string>("");   // which file is being restored
  const [autoStatus,        setAutoStatus]        = useState<AutoBackupStatus | null>(null);
  const [loadingAutoStatus, setLoadingAutoStatus] = useState(false);
  const [runningNow,        setRunningNow]        = useState(false);

  // ── Deduction criteria ────────────────────────────────────────────────────
  const [criteria, setCriteria] = useState<DeductionCriteria>({
    workingDaysPerMonth:   26,
    absentPenaltyFraction: "1.00",
    latePenaltyFraction:   "0.50",
    leavePenaltyFraction:  "0.00",
  });
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaSaving,  setCriteriaSaving]  = useState(false);

  const loadCriteria = async () => {
    setCriteriaLoading(true);
    try {
      const res = await fetch("/api/settings", {
        headers: authHeader() as HeadersInit,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCriteria({
        workingDaysPerMonth:   Number(data.workingDaysPerMonth)   || 26,
        absentPenaltyFraction: String(data.absentPenaltyFraction ?? "1.00"),
        latePenaltyFraction:   String(data.latePenaltyFraction   ?? "0.50"),
        leavePenaltyFraction:  String(data.leavePenaltyFraction  ?? "0.00"),
      });
    } catch {
      toast({ variant: "destructive", title: "Deduction criteria load nahi hue" });
    } finally {
      setCriteriaLoading(false);
    }
  };

  const saveCriteria = async () => {
    setCriteriaSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method:  "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body:    JSON.stringify({
          workingDaysPerMonth:   Number(criteria.workingDaysPerMonth),
          absentPenaltyFraction: Number(criteria.absentPenaltyFraction),
          latePenaltyFraction:   Number(criteria.latePenaltyFraction),
          leavePenaltyFraction:  Number(criteria.leavePenaltyFraction),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Failed");
      }
      toast({ title: "Deduction criteria save ho gaye ✓" });
      await loadCriteria();
    } catch (err) {
      toast({ variant: "destructive", title: "Save failed", description: String(err) });
    } finally {
      setCriteriaSaving(false);
    }
  };

  useEffect(() => {
    loadAutoStatus();
    loadCriteria();
    loadBackups();
  }, []);

  // ── Auto-backup status ────────────────────────────────────────────────────
  const loadAutoStatus = async () => {
    setLoadingAutoStatus(true);
    try {
      const res = await apiFetch("/auto-backup/status");
      setAutoStatus(await res.json());
    } catch { /* silently fail */ }
    finally { setLoadingAutoStatus(false); }
  };

  const runBackupNow = async () => {
    setRunningNow(true);
    try {
      await apiFetch("/auto-backup/run-now", { method: "POST" });
      toast({ title: "Backup complete!", description: "Auto-backup abhi chalaya gaya." });
      await Promise.all([loadAutoStatus(), loadBackups()]);
    } catch (err) {
      toast({ variant: "destructive", title: "Backup failed", description: String(err) });
    } finally {
      setRunningNow(false);
    }
  };

  // ── Server backups list ───────────────────────────────────────────────────
  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await apiFetch("/backups");
      setBackups(await res.json());
    } catch {
      toast({ variant: "destructive", title: "Backups list load nahi hua" });
    } finally {
      setLoadingBackups(false);
    }
  };

  // ── Download current DB as backup file ───────────────────────────────────
  const downloadBackup = async () => {
    try {
      const res = await apiFetch("/backup");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `kips-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup file download ho gayi ✓" });
    } catch (err) {
      toast({ variant: "destructive", title: "Download failed", description: String(err) });
    }
  };

  // ── Save backup to server folder ─────────────────────────────────────────
  const saveToServer = async () => {
    setSaving(true);
    try {
      const res  = await apiFetch("/backup/save", { method: "POST" });
      const data = await res.json();
      toast({ title: "Server pe save ho gaya ✓", description: data.filename });
      await loadBackups();
    } catch (err) {
      toast({ variant: "destructive", title: "Server backup failed", description: String(err) });
    } finally {
      setSaving(false);
    }
  };

  // ── Delete a saved backup ─────────────────────────────────────────────────
  const deleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup:\n${filename}\n\nYe backup hamesha ke liye delete ho jayega.`)) return;
    try {
      await apiFetch(`/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
      toast({ title: "Backup delete ho gaya" });
      await loadBackups();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete failed", description: String(err) });
    }
  };

  // ── Download a saved backup file ──────────────────────────────────────────
  const downloadSaved = async (filename: string) => {
    try {
      const res  = await apiFetch(`/backups/${encodeURIComponent(filename)}`);
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ variant: "destructive", title: "Download failed", description: String(err) });
    }
  };

  // ── Confirm dialog with data counts ──────────────────────────────────────
  const confirmRestore = (
    d: { students?: unknown[]; fees?: unknown[]; attendance?: unknown[]; salaries?: unknown[]; accountEntries?: unknown[]; classes?: unknown[] },
    timestamp: string
  ): boolean => {
    const students  = d?.students?.length  ?? 0;
    const classes   = d?.classes?.length   ?? 0;
    const fees      = d?.fees?.length      ?? 0;
    const attendance= d?.attendance?.length?? 0;
    const salaries  = d?.salaries?.length  ?? 0;
    const accounts  = d?.accountEntries?.length ?? 0;

    const warn = students === 0
      ? `⚠️ KHABARDAR: Is backup mein 0 students hain!\n\nRestore karne se SARE current students delete ho jayenge!\n\nBackup time: ${timestamp}\n\nKya ap YAQEENAN restore karna chahte hain?`
      : `Backup ki details:\n• Classes: ${classes}\n• Students: ${students}\n• Fees: ${fees}\n• Attendance: ${attendance}\n• Salaries: ${salaries}\n• Accounts: ${accounts}\n\nBackup time: ${timestamp}\n\nYe sab current data replace ho jayega.\n\nRestore karein?`;
    return confirm(warn);
  };

  // ── Show restore result toast ─────────────────────────────────────────────
  const showRestoreResult = (data: { studentsRestored?: number; preBackup?: string; errors?: string[] }) => {
    const count = data.studentsRestored ?? 0;
    const errs  = data.errors ?? [];
    if (errs.length > 0) {
      toast({
        variant:     "destructive",
        title:       `Restore complete — ${errs.length} warning(s)`,
        description: `Students restore hue: ${count}. Errors: ${errs.slice(0, 3).join(" | ")}`,
      });
    } else {
      toast({
        title:       `Restore mukammal ✓  (${count} students)`,
        description: `Safety backup: ${data.preBackup}`,
      });
    }
  };

  // ── Restore from uploaded JSON file ──────────────────────────────────────
  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let backup: {
      data?: { students?: unknown[]; fees?: unknown[]; attendance?: unknown[]; salaries?: unknown[]; accountEntries?: unknown[]; classes?: unknown[] };
      timestamp?: string;
    };

    try {
      const text = await file.text();
      backup = JSON.parse(text);
      if (!backup?.data) throw new Error("data field missing");
    } catch (parseErr) {
      toast({ variant: "destructive", title: "Invalid backup file", description: "JSON parse error ya galat format" });
      e.target.value = "";
      return;
    }

    if (!confirmRestore(backup.data ?? {}, backup.timestamp ?? "unknown")) {
      e.target.value = "";
      return;
    }

    setRestoring(true);
    setRestoreTarget(file.name);
    try {
      const res  = await apiFetch("/restore", {
        method: "POST",
        body:   JSON.stringify(backup),
      });
      const data = await res.json();
      showRestoreResult(data);
      await loadBackups();
    } catch (err) {
      toast({ variant: "destructive", title: "Restore failed", description: String(err) });
    } finally {
      setRestoring(false);
      setRestoreTarget("");
      e.target.value = "";
    }
  };

  // ── Restore from server-saved backup ─────────────────────────────────────
  const restoreFromServer = async (filename: string) => {
    // 1. Backup ka content fetch karo confirmation ke liye
    let backup: {
      data?: { students?: unknown[]; fees?: unknown[]; attendance?: unknown[]; salaries?: unknown[]; accountEntries?: unknown[]; classes?: unknown[] };
      timestamp?: string;
    };
    try {
      const peekRes = await apiFetch(`/backups/${encodeURIComponent(filename)}`);
      backup = await peekRes.json();
      if (!backup?.data) throw new Error("Invalid backup format");
    } catch (err) {
      toast({ variant: "destructive", title: "Backup preview failed", description: String(err) });
      return;
    }

    if (!confirmRestore(backup.data ?? {}, backup.timestamp ?? filename)) return;

    setRestoring(true);
    setRestoreTarget(filename);
    try {
      // 2. Server-side restore (file already on server, no re-upload needed)
      const res  = await apiFetch(`/restore-from-server/${encodeURIComponent(filename)}`, { method: "POST" });
      const data = await res.json();
      showRestoreResult(data);
      await loadBackups();
    } catch (err) {
      toast({ variant: "destructive", title: "Restore failed", description: String(err) });
    } finally {
      setRestoring(false);
      setRestoreTarget("");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" /> Settings & Backup
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Deduction criteria, system backups, aur data restore manage karein
        </p>
      </div>

      {/* ── Deduction Criteria ──────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-4">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-white" />
            <h2 className="text-white font-semibold text-base">Deduction Criteria</h2>
          </div>
          <p className="text-white/80 text-xs mt-1">
            Attendance ka salary/fee deductions par asar. Per-day rate = amount ÷ working days.
            Har absent/late/leave day mein (per-day × fraction) kata hai.
          </p>
        </div>
        <CardContent className="p-5 space-y-4">
          {criteriaLoading ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Working Days / Month
                  </label>
                  <Input
                    type="number" min={1} max={31}
                    value={criteria.workingDaysPerMonth}
                    onChange={e => setCriteria(c => ({ ...c, workingDaysPerMonth: Number(e.target.value) || 0 }))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">Default: 26</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Absent Penalty (× per-day)
                  </label>
                  <Input
                    type="number" min={0} max={5} step="0.05"
                    value={criteria.absentPenaltyFraction}
                    onChange={e => setCriteria(c => ({ ...c, absentPenaltyFraction: e.target.value }))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">1.00 = pura din kata (default)</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Late Penalty (× per-day)
                  </label>
                  <Input
                    type="number" min={0} max={5} step="0.05"
                    value={criteria.latePenaltyFraction}
                    onChange={e => setCriteria(c => ({ ...c, latePenaltyFraction: e.target.value }))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">0.50 = adha din kata (default)</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">
                    Leave Penalty (× per-day)
                  </label>
                  <Input
                    type="number" min={0} max={5} step="0.05"
                    value={criteria.leavePenaltyFraction}
                    onChange={e => setCriteria(c => ({ ...c, leavePenaltyFraction: e.target.value }))}
                    className="h-9"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">0.00 = koi deduction nahi (default)</p>
                </div>
              </div>

              {/* Live example */}
              {(() => {
                const wd  = Number(criteria.workingDaysPerMonth) || 26;
                const af  = Number(criteria.absentPenaltyFraction);
                const lf  = Number(criteria.latePenaltyFraction);
                const lvf = Number(criteria.leavePenaltyFraction);
                const example = 26000;
                const perDay  = Math.round(example / wd);
                return (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm">
                    <p className="text-xs font-semibold text-amber-800 mb-1">
                      Misaal: salary PKR {example.toLocaleString()}
                    </p>
                    <div className="text-xs text-amber-700 space-y-0.5">
                      <div>Per-day rate: <strong>PKR {perDay.toLocaleString()}</strong> (= {example.toLocaleString()} ÷ {wd})</div>
                      <div>1 absent din = <strong>−PKR {Math.round(perDay * af).toLocaleString()}</strong></div>
                      <div>1 late din   = <strong>−PKR {Math.round(perDay * lf).toLocaleString()}</strong></div>
                      <div>1 leave din  = <strong>−PKR {Math.round(perDay * lvf).toLocaleString()}</strong></div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center gap-3 pt-1">
                <Button
                  onClick={saveCriteria}
                  disabled={criteriaSaving}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  {criteriaSaving
                    ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                    : <><Save className="w-4 h-4 mr-2" /> Save Criteria</>
                  }
                </Button>
                <Button variant="outline" size="sm" onClick={loadCriteria} disabled={criteriaLoading}>
                  <RefreshCw className={`w-3.5 h-3.5 mr-1 ${criteriaLoading ? "animate-spin" : ""}`} /> Reload
                </Button>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-700">
                  Changes sirf <strong>future</strong> calculations pe lagenge. Already-save salaries recompute nahi honge.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ── Auto Daily Backup ───────────────────────────────────────────── */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-white" />
              <h2 className="text-white font-semibold text-base">Auto Daily Backup</h2>
            </div>
            <span className="bg-white/20 text-white text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-300 animate-pulse" />
              Active
            </span>
          </div>
          <p className="text-white/70 text-xs mt-1">
            Har roz raat 12 baje (Pakistan time) automatic backup hota hai
          </p>
        </div>
        <CardContent className="p-5 space-y-4">
          {loadingAutoStatus ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading status...
            </div>
          ) : autoStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Last Backup
                </p>
                {autoStatus.lastRun ? (
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {new Date(autoStatus.lastRun).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(autoStatus.lastRun).toLocaleTimeString("en-PK")}
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Abhi tak nahi chala</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Status
                </p>
                {autoStatus.lastStatus === "success" ? (
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm font-semibold text-emerald-700">Successful</span>
                  </div>
                ) : autoStatus.lastStatus === "error" ? (
                  <div>
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-red-500" />
                      <span className="text-sm font-semibold text-red-700">Error</span>
                    </div>
                    {autoStatus.lastError && (
                      <p className="text-xs text-red-400 mt-0.5 break-all">{autoStatus.lastError}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Pending...</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Saved Backups
                </p>
                <p className="text-sm font-semibold text-gray-800">{autoStatus.autoBackupCount} files</p>
                <p className="text-xs text-gray-400">Max 7 rakhay jate hain</p>
              </div>
            </div>
          ) : null}

          <div className="flex items-center gap-3 pt-1">
            <Button
              onClick={runBackupNow}
              disabled={runningNow}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {runningNow
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Running...</>
                : <><Play className="w-4 h-4 mr-2" /> Run Backup Now</>
              }
            </Button>
            <Button variant="outline" size="sm" onClick={loadAutoStatus} disabled={loadingAutoStatus}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingAutoStatus ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex items-start gap-2">
            <Zap className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700">
              <strong>Last 7 din ke backups</strong> automatically save rehte hain. Purane delete ho jate hain.
              Filename: <code className="bg-blue-100 px-1 rounded">auto-backup-YYYY-MM-DD...</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Manual Backup ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-600" /> Manual Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">
            Sab data ka full backup download karein ya server pe save karein (students, fees, attendance, exams, staff, accounts, certificates).
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadBackup} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-4 h-4 mr-2" /> Download Backup File
            </Button>
            <Button onClick={saveToServer} disabled={saving} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
              {saving
                ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
                : <><Database className="w-4 h-4 mr-2" /> Save Backup to Server</>
              }
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Restore ─────────────────────────────────────────────────────── */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-600" /> Restore from Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Khabardar:</strong> Restore karne se current students, fees, attendance, exams, aur financial data backup se replace ho jayega.
            Staff records mahfooz rehenge. Restore se pehle safety backup automatically ban jata hai.
            Restore karne se pehle data count confirm karna hoga.
          </div>

          {restoring && restoreTarget && (
            <div className="flex items-center gap-2 text-blue-700 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>Restore ho raha hai: <strong>{restoreTarget}</strong> — please wait…</span>
            </div>
          )}

          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {restoring
              ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Restoring...</>
              : <><Upload className="w-4 h-4 mr-2" /> Backup File Choose Karein & Restore</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* ── Server Backups List ─────────────────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" /> Server pe Saved Backups
          </CardTitle>
          <Button size="sm" variant="outline" onClick={loadBackups} disabled={loadingBackups}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingBackups ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {loadingBackups ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading backups...
            </div>
          ) : backups.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Abhi koi server backup nahi. "Save Backup to Server" click karein.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={loadBackups}>
                List Load Karein
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map(b => (
                <div
                  key={b.filename}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    b.filename.startsWith("auto-backup")  ? "bg-blue-50  border-blue-100"  :
                    b.filename.startsWith("pre-restore")  ? "bg-amber-50 border-amber-100" :
                    "bg-gray-50 border-gray-100"
                  }`}
                >
                  <div className="min-w-0 mr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-mono font-medium text-gray-800 truncate">{b.filename}</p>
                      {b.filename.startsWith("auto-backup") && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">Auto</span>
                      )}
                      {b.filename.startsWith("pre-restore") && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium shrink-0">Safety</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(b.createdAt).toLocaleString("en-PK")} · {(b.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                      onClick={() => restoreFromServer(b.filename)}
                      disabled={restoring}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      {restoring && restoreTarget === b.filename ? "..." : "Restore"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadSaved(b.filename)} disabled={restoring}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deleteBackup(b.filename)} disabled={restoring}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
