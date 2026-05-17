import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Download, Upload, Trash2, RefreshCw, Shield, Database, Clock, CheckCircle } from "lucide-react";

interface SavedBackup {
  filename: string;
  size: number;
  createdAt: string;
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

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await apiFetch("/backups");
      setBackups(await res.json());
    } catch (e: unknown) {
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

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm("This will REPLACE all current data with the backup. Are you sure?")) {
      e.target.value = ""; return;
    }
    setRestoring(true);
    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      const res = await apiFetch("/restore", {
        method: "POST",
        body: JSON.stringify(backup),
      });
      const data = await res.json();
      toast({ title: "Restore complete", description: `Pre-restore backup: ${data.preBackup}` });
      await loadBackups();
    } catch (err: unknown) {
      toast({ variant: "destructive", title: "Restore failed", description: String(err) });
    } finally {
      setRestoring(false);
      e.target.value = "";
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
            <strong>Warning:</strong> Restoring will replace all current student, fee, attendance, exam, and financial data with the backup. Staff records are preserved. A pre-restore backup is saved automatically.
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
                <div key={b.filename} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-mono font-medium text-gray-800">{b.filename}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(b.createdAt).toLocaleString("en-PK")} · {(b.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <div className="flex gap-2">
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
