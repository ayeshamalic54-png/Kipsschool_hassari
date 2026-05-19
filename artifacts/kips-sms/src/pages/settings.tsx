import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Trash2, RefreshCw, Shield, Database, Clock, CheckCircle, CalendarClock, Play, AlertCircle, Zap, RotateCcw } from "lucide-react";

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

const API = "/api/admin";

function authHeader() {
  const token = localStorage.getItem("kips_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: { ...authHeader(), "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Request failed");
  return res;
}

export default function Settings() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<SavedBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [lastAutoBackup, setLastAutoBackup] = useState<string | null>(null);
  const [autoStatus, setAutoStatus] = useState<AutoBackupStatus | null>(null);
  const [loadingAutoStatus, setLoadingAutoStatus] = useState(false);
  const [runningNow, setRunningNow] = useState(false);

  useEffect(() => {
    loadAutoStatus();
  }, []);

  const loadAutoStatus = async () => {
    setLoadingAutoStatus(true);
    try {
      const res = await apiFetch("/auto-backup/status");
      setAutoStatus(await res.json());
    } catch {
      // silently fail
    } finally {
      setLoadingAutoStatus(false);
    }
  };

  const runBackupNow = async () => {
    setRunningNow(true);
    try {
      await apiFetch("/auto-backup/run-now", { method: "POST" });
      toast({ title: "Backup complete!", description: "Auto-backup ran successfully right now." });
      await loadAutoStatus();
      await loadBackups();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Backup failed", description: String(err) });
    } finally {
      setRunningNow(false);
    }
  };

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await apiFetch("/backups");
      setBackups(await res.json());
    } catch {
      toast({ variant: "destructive", title: "Failed to load backups" });
    } finally {
      setLoadingBackups(false);
    }
  };

  const downloadBackup = async () => {
    try {
      const res = await apiFetch("/backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kips-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded successfully" });
    } catch {
      toast({ variant: "destructive", title: "Backup download failed" });
    }
  };

  const saveToServer = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/backup/save", { method: "POST" });
      const data = await res.json();
      toast({ title: "Backup saved to server", description: data.filename });
      setLastAutoBackup(new Date().toLocaleString("en-PK"));
      await loadBackups();
    } catch {
      toast({ variant: "destructive", title: "Server backup failed" });
    } finally {
      setSaving(false);
    }
  };

  const deleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup: ${filename}?`)) return;
    try {
      await apiFetch(`/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
      toast({ title: "Backup deleted" });
      await loadBackups();
    } catch {
      toast({ variant: "destructive", title: "Delete failed" });
    }
  };

  const downloadSaved = async (filename: string) => {
    try {
      const res = await apiFetch(`/backups/${encodeURIComponent(filename)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ variant: "destructive", title: "Download failed" });
    }
  };

  const confirmAndRestore = (d: { students?: unknown[]; fees?: unknown[]; attendance?: unknown[]; salaries?: unknown[]; accountEntries?: unknown[] }, timestamp: string) => {
    const students = d?.students?.length ?? 0;
    const fees = d?.fees?.length ?? 0;
    const attendance = d?.attendance?.length ?? 0;
    const salaries = d?.salaries?.length ?? 0;
    const accounts = d?.accountEntries?.length ?? 0;
    const warning = students === 0
      ? `⚠️ WARNING: This backup has no students (0 students)!\n\nRestoring will delete ALL current students!\n\nBackup time: ${timestamp}\n\nAre you SURE you want to restore?`
      : `Backup contents:\n• Students: ${students}\n• Fees: ${fees}\n• Attendance: ${attendance}\n• Salaries: ${salaries}\n• Accounts: ${accounts}\n\nBackup time: ${timestamp}\n\nThis will replace all current data. Proceed with restore?`;
    return confirm(warning);
  };

  const showRestoreResult = (data: { studentsRestored?: number; preBackup?: string; errors?: string[] }) => {
    const count = data.studentsRestored ?? 0;
    const errs = data.errors ?? [];
    if (errs.length > 0) {
      toast({ variant: "destructive", title: `Restore with ${errs.length} errors`, description: `Students restored: ${count}. Errors: ${errs.slice(0, 2).join("; ")}` });
    } else {
      toast({ title: `Restore complete ✓  (${count} students restored)`, description: `Safety backup: ${data.preBackup}` });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    let backup: { data?: { students?: unknown[]; fees?: unknown[]; attendance?: unknown[]; salaries?: unknown[]; accountEntries?: unknown[] }; timestamp?: string };
    try {
      backup = JSON.parse(await file.text());
      if (!confirmAndRestore(backup.data ?? {}, backup.timestamp ?? "unknown")) {
        e.target.value = ""; return;
      }
    } catch {
      toast({ variant: "destructive", title: "Invalid backup file", description: "Could not parse backup file" });
      e.target.value = ""; return;
    }
    setRestoring(true);
    try {
      const res = await apiFetch("/restore", { method: "POST", body: JSON.stringify(backup) });
      showRestoreResult(await res.json());
      await loadBackups();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Restore failed", description: String(err) });
    } finally {
      setRestoring(false);
      e.target.value = "";
    }
  };

  const restoreFromServer = async (filename: string) => {
    setRestoring(true);
    try {
      // First fetch the backup to show confirmation
      const peekRes = await apiFetch(`/backups/${encodeURIComponent(filename)}`);
      const backup = await peekRes.json();
      if (!confirmAndRestore(backup.data ?? {}, backup.timestamp ?? filename)) {
        setRestoring(false); return;
      }
      const res = await apiFetch(`/restore-from-server/${encodeURIComponent(filename)}`, { method: "POST" });
      showRestoreResult(await res.json());
      await loadBackups();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Restore failed", description: String(err) });
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield className="w-6 h-6 text-blue-600" /> Settings & Backup
        </h1>
        <p className="text-gray-500 text-sm mt-1">Manage system backups and data restore</p>
      </div>

      {/* Auto Daily Backup */}
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
          <p className="text-white/70 text-xs mt-1">Automatically backs up every day at midnight (12:00 AM) Pakistan time</p>
        </div>
        <CardContent className="p-5 space-y-4">
          {loadingAutoStatus ? (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading status...
            </div>
          ) : autoStatus ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Clock className="w-3 h-3" /> Last Backup</p>
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
                  <p className="text-sm text-gray-400">Never run</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Status</p>
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
                    {autoStatus.lastError && <p className="text-xs text-red-400 mt-0.5">{autoStatus.lastError}</p>}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Pending...</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Database className="w-3 h-3" /> Saved Backups</p>
                <p className="text-sm font-semibold text-gray-800">{autoStatus.autoBackupCount} files</p>
                <p className="text-xs text-gray-400">Max 7 kept</p>
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
              <strong>Last 7 days of backups</strong> are automatically saved. Older backups are deleted when the limit is reached.
              Backup filename: <code className="bg-blue-100 px-1 rounded">auto-backup-YYYY-MM-DD...</code>
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Backup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Download className="w-4 h-4 text-emerald-600" /> Manual Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500">Download a full backup of all data (students, fees, attendance, exams, staff, accounts, certificates) as a JSON file.</p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={downloadBackup} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-4 h-4 mr-2" /> Download Backup File
            </Button>
            <Button onClick={saveToServer} disabled={saving} variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-50">
              {saving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Database className="w-4 h-4 mr-2" />}
              Save Backup to Server
            </Button>
          </div>
          {lastAutoBackup && (
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Last saved: {lastAutoBackup}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Restore */}
      <Card className="border-amber-200">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Upload className="w-4 h-4 text-amber-600" /> Restore from Backup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <strong>Warning:</strong> Restoring will replace all current student, fee, attendance, exam, and financial data with the backup. Staff records are preserved. A pre-restore backup is saved automatically. The backup data count will be shown before restoring.
          </div>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
          <Button
            onClick={() => fileRef.current?.click()}
            disabled={restoring}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            {restoring ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
            {restoring ? "Restoring..." : "Choose Backup File & Restore"}
          </Button>
        </CardContent>
      </Card>

      {/* Server Backups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" /> Saved Backups on Server
          </CardTitle>
          <Button size="sm" variant="outline" onClick={loadBackups} disabled={loadingBackups}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loadingBackups ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {backups.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Database className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No server backups yet. Click "Save Backup to Server" to create one.</p>
              <Button size="sm" variant="outline" className="mt-3" onClick={loadBackups}>
                Load List
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {backups.map(b => (
                <div key={b.filename} className={`flex items-center justify-between p-3 rounded-lg border ${b.filename.startsWith("auto-backup") ? "bg-blue-50 border-blue-100" : b.filename.startsWith("pre-restore") ? "bg-amber-50 border-amber-100" : "bg-gray-50 border-gray-100"}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-mono font-medium text-gray-800">{b.filename}</p>
                      {b.filename.startsWith("auto-backup") && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">Auto</span>
                      )}
                      {b.filename.startsWith("pre-restore") && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium">Safety</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(b.createdAt).toLocaleString("en-PK")} · {(b.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => restoreFromServer(b.filename)} disabled={restoring}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restore
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => downloadSaved(b.filename)}>
                      <Download className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-500 hover:bg-red-50" onClick={() => deleteBackup(b.filename)}>
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
