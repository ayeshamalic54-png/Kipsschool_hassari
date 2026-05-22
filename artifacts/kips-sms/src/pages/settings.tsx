import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { getSchoolInfo, saveSchoolInfo } from "@/lib/school-info";
import {
  School, KeyRound, Calculator, Database, Download, Upload, Trash2,
  Save, Loader2, Eye, EyeOff, Camera, CheckCircle,
  Play, Clock, AlertCircle, RotateCcw,
} from "lucide-react";

function authHeader(): Record<string, string> {
  const t = localStorage.getItem("kips_token") ?? localStorage.getItem("token") ?? "";
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const res = await fetch(`/api/admin${path}`, {
    ...opts,
    headers: { ...authHeader(), "Content-Type": "application/json", ...(opts.headers ?? {}) },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.clone().json(); msg = j.error ?? j.message ?? msg; } catch {}
    throw new Error(msg);
  }
  return res;
}

function Section({ icon: Icon, title, subtitle, children, color = "indigo" }: {
  icon: React.ElementType; title: string; subtitle?: string;
  children: React.ReactNode; color?: string;
}) {
  const colors: Record<string, string> = {
    indigo: "from-indigo-500 to-purple-500",
    emerald: "from-emerald-500 to-teal-500",
    rose: "from-rose-500 to-red-500",
    amber: "from-amber-400 to-orange-500",
    blue: "from-blue-500 to-cyan-500",
  };
  return (
    <Card className="shadow-sm border-0 ring-1 ring-gray-100">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colors[color] ?? colors.indigo} flex items-center justify-center shadow-sm`}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-base font-bold text-gray-900">{title}</CardTitle>
            {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

interface SavedBackup { filename: string; size: number; createdAt: string; }
interface AutoBackupStatus {
  lastRun: string | null; lastStatus: "never" | "success" | "error";
  lastError: string | null; nextRun: string; enabled: boolean;
  autoBackupCount: number; autoBackupFiles: string[];
}
interface DeductionCriteria {
  workingDaysPerMonth: number;
  absentPenaltyFraction: string;
  latePenaltyFraction: string;
  leavePenaltyFraction: string;
}

export default function Settings() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  // ── School Info ──────────────────────────────────────────────────────────
  const currentInfo = getSchoolInfo();
  const [schoolName,    setSchoolName]    = useState(currentInfo.name);
  const [schoolTagline, setSchoolTagline] = useState(currentInfo.tagline);
  const [logoPreview,   setLogoPreview]   = useState<string>(currentInfo.logoUrl);
  const [schoolSaving,  setSchoolSaving]  = useState(false);

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const saveSchool = () => {
    setSchoolSaving(true);
    saveSchoolInfo({ name: schoolName.trim() || "KIPS School", tagline: schoolTagline.trim(), logoUrl: logoPreview });
    setTimeout(() => {
      setSchoolSaving(false);
      toast({ title: "School info saved", description: "Applied across login page, sidebar, and print headers." });
    }, 400);
  };

  // ── Admin Password Change ────────────────────────────────────────────────
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [pwSaving,  setPwSaving]  = useState(false);

  const changePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      toast({ variant: "destructive", title: "All password fields are required" }); return;
    }
    if (newPw.length < 6) {
      toast({ variant: "destructive", title: "New password must be at least 6 characters" }); return;
    }
    if (newPw !== confirmPw) {
      toast({ variant: "destructive", title: "New passwords do not match" }); return;
    }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method:  "PUT",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error ?? "Failed"); }
      toast({ title: "Password changed successfully" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      toast({ variant: "destructive", title: "Password change failed", description: String(err) });
    } finally { setPwSaving(false); }
  };

  // ── Deduction Criteria ───────────────────────────────────────────────────
  const [criteria, setCriteria] = useState<DeductionCriteria>({
    workingDaysPerMonth: 26, absentPenaltyFraction: "1.00",
    latePenaltyFraction: "0.50", leavePenaltyFraction: "0.00",
  });
  const [criteriaLoading, setCriteriaLoading] = useState(false);
  const [criteriaSaving,  setCriteriaSaving]  = useState(false);

  const loadCriteria = async () => {
    setCriteriaLoading(true);
    try {
      const res = await fetch("/api/settings", { headers: authHeader() as HeadersInit });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCriteria({
        workingDaysPerMonth:   Number(data.workingDaysPerMonth)   || 26,
        absentPenaltyFraction: String(data.absentPenaltyFraction ?? "1.00"),
        latePenaltyFraction:   String(data.latePenaltyFraction   ?? "0.50"),
        leavePenaltyFraction:  String(data.leavePenaltyFraction  ?? "0.00"),
      });
    } catch { toast({ variant: "destructive", title: "Could not load deduction settings" }); }
    finally { setCriteriaLoading(false); }
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
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error); }
      toast({ title: "Deduction settings saved" });
      await loadCriteria();
    } catch (err) { toast({ variant: "destructive", title: "Save failed", description: String(err) }); }
    finally { setCriteriaSaving(false); }
  };

  // ── Backup ───────────────────────────────────────────────────────────────
  const [backups,        setBackups]        = useState<SavedBackup[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [restoring,      setRestoring]      = useState(false);
  const [restoreTarget,  setRestoreTarget]  = useState("");
  const [autoStatus,     setAutoStatus]     = useState<AutoBackupStatus | null>(null);
  const [runningNow,     setRunningNow]     = useState(false);

  const loadBackups = async () => {
    setLoadingBackups(true);
    try { const res = await apiFetch("/backups"); setBackups(await res.json()); }
    catch { toast({ variant: "destructive", title: "Could not load backup list" }); }
    finally { setLoadingBackups(false); }
  };

  const loadAutoStatus = async () => {
    try { const res = await apiFetch("/auto-backup/status"); setAutoStatus(await res.json()); }
    catch {}
  };

  useEffect(() => { loadCriteria(); loadBackups(); loadAutoStatus(); }, []);

  const downloadBackup = async () => {
    try {
      const res = await apiFetch("/backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `kips-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click(); URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded" });
    } catch (err) { toast({ variant: "destructive", title: "Download failed", description: String(err) }); }
  };

  const saveToServer = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/backup/save", { method: "POST" });
      const data = await res.json();
      toast({ title: "Saved to server", description: data.filename });
      await loadBackups();
    } catch (err) { toast({ variant: "destructive", title: "Server backup failed", description: String(err) }); }
    finally { setSaving(false); }
  };

  const deleteBackup = async (filename: string) => {
    if (!confirm(`Delete backup: ${filename}?`)) return;
    try {
      await apiFetch(`/backups/${encodeURIComponent(filename)}`, { method: "DELETE" });
      toast({ title: "Backup deleted" }); await loadBackups();
    } catch (err) { toast({ variant: "destructive", title: "Delete failed", description: String(err) }); }
  };

  const downloadSaved = async (filename: string) => {
    try {
      const res = await apiFetch(`/backups/${encodeURIComponent(filename)}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename;
      a.click(); URL.revokeObjectURL(url);
    } catch (err) { toast({ variant: "destructive", title: "Download failed", description: String(err) }); }
  };

  const confirmRestore = (d: any, ts: string) => {
    const students = d?.students?.length ?? 0;
    return confirm(students === 0
      ? `WARNING: This backup has 0 students!\nRestoring will DELETE all current students!\nBackup time: ${ts}\n\nAre you sure?`
      : `Backup: ${students} students, ${d?.fees?.length ?? 0} fees, ${d?.classes?.length ?? 0} classes\nBackup time: ${ts}\n\nThis will replace current data. Restore?`);
  };

  const showRestoreResult = (data: any) => {
    const errs = data.errors ?? [];
    if (errs.length > 0) {
      toast({ variant: "destructive", title: `Restore done — ${errs.length} warning(s)`, description: `Students: ${data.studentsRestored}` });
    } else {
      toast({ title: `Restore complete (${data.studentsRestored} students)`, description: `Safety backup: ${data.preBackup}` });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    let backup: any;
    try { backup = JSON.parse(await file.text()); if (!backup?.data) throw new Error(); }
    catch { toast({ variant: "destructive", title: "Invalid backup file" }); e.target.value = ""; return; }
    if (!confirmRestore(backup.data, backup.timestamp ?? "unknown")) { e.target.value = ""; return; }
    setRestoring(true); setRestoreTarget(file.name);
    try {
      const res = await apiFetch("/restore", { method: "POST", body: JSON.stringify(backup) });
      showRestoreResult(await res.json()); await loadBackups();
    } catch (err) { toast({ variant: "destructive", title: "Restore failed", description: String(err) }); }
    finally { setRestoring(false); setRestoreTarget(""); e.target.value = ""; }
  };

  const restoreFromServer = async (filename: string) => {
    let backup: any;
    try {
      const res = await apiFetch(`/backups/${encodeURIComponent(filename)}`);
      backup = await res.json(); if (!backup?.data) throw new Error();
    } catch (err) { toast({ variant: "destructive", title: "Preview failed", description: String(err) }); return; }
    if (!confirmRestore(backup.data, backup.timestamp ?? filename)) return;
    setRestoring(true); setRestoreTarget(filename);
    try {
      const res = await apiFetch("/restore", { method: "POST", body: JSON.stringify(backup) });
      showRestoreResult(await res.json());
    } catch (err) { toast({ variant: "destructive", title: "Restore failed", description: String(err) }); }
    finally { setRestoring(false); setRestoreTarget(""); }
  };

  const runBackupNow = async () => {
    setRunningNow(true);
    try {
      await apiFetch("/auto-backup/run-now", { method: "POST" });
      toast({ title: "Backup complete!" }); await Promise.all([loadAutoStatus(), loadBackups()]);
    } catch (err) { toast({ variant: "destructive", title: "Backup failed", description: String(err) }); }
    finally { setRunningNow(false); }
  };

  const fmt = (d: string | null) => d ? new Date(d).toLocaleString("en-PK") : "Never";

  return (
    <div className="max-w-3xl mx-auto space-y-5 pb-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-400 mt-0.5">Manage school profile, security, salary rules, and database backups</p>
      </div>

      {/* 1. School Information */}
      <Section icon={School} title="School Information" subtitle="Applies across login page, sidebar, print headers, and the entire app" color="indigo">
        <div className="space-y-5">
          <div className="flex items-center gap-5">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full border-4 border-indigo-100 overflow-hidden bg-gray-50 flex items-center justify-center shadow-md">
                {logoPreview
                  ? <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" onError={() => setLogoPreview("/kips-logo.jpeg")} />
                  : <School className="w-10 h-10 text-indigo-200" />}
              </div>
              <button type="button" onClick={() => logoRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg transition-colors">
                <Camera size={14} />
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">School Logo</p>
              <p className="text-xs text-gray-400">PNG or JPG — replaces the logo everywhere in the app.</p>
              <Button type="button" variant="outline" size="sm" onClick={() => logoRef.current?.click()} className="gap-1.5">
                <Camera size={13} /> Choose Logo
              </Button>
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogoChange} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="School / College Name" hint="Shown on login page, sidebar, and all print pages">
              <Input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="e.g. KIPS School Hassari" />
            </Field>
            <Field label="Tagline / Slogan" hint="Short phrase shown below the school name">
              <Input value={schoolTagline} onChange={e => setSchoolTagline(e.target.value)} placeholder="e.g. Bright Future" />
            </Field>
          </div>

          {/* Preview */}
          <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 p-4">
            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-3">Sidebar Preview</p>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-orange-400 shadow shrink-0">
                {logoPreview
                  ? <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-indigo-100" />}
              </div>
              <div>
                <p className="font-bold text-sm text-gray-900">{schoolName || "School Name"}</p>
                <p className="text-[10px] uppercase font-semibold tracking-wider text-orange-500">{schoolTagline || "Tagline"}</p>
              </div>
            </div>
          </div>

          <Button onClick={saveSchool} disabled={schoolSaving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 w-full sm:w-auto">
            {schoolSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save School Info</>}
          </Button>
        </div>
      </Section>

      {/* 2. Admin Password Change */}
      <Section icon={KeyRound} title="Change Admin Password" subtitle="Update your admin account login password" color="rose">
        <div className="space-y-4">
          <Field label="Current Password">
            <div className="relative">
              <Input type={showPw ? "text" : "password"} value={currentPw}
                onChange={e => setCurrentPw(e.target.value)} placeholder="Enter current password" />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="New Password" hint="Minimum 6 characters">
              <Input type={showPw ? "text" : "password"} value={newPw}
                onChange={e => setNewPw(e.target.value)} placeholder="New password" />
            </Field>
            <Field label="Confirm New Password">
              <Input type={showPw ? "text" : "password"} value={confirmPw}
                onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" />
            </Field>
          </div>
          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> Passwords do not match</p>
          )}
          {newPw && confirmPw && newPw === confirmPw && newPw.length >= 6 && (
            <p className="text-xs text-emerald-600 flex items-center gap-1"><CheckCircle size={12} /> Passwords match</p>
          )}
          <Button onClick={changePassword} disabled={pwSaving} className="bg-rose-600 hover:bg-rose-700 text-white gap-2 w-full sm:w-auto">
            {pwSaving ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : <><KeyRound size={14} /> Change Password</>}
          </Button>
        </div>
      </Section>

      {/* 3. Salary Deduction Rules */}
      <Section icon={Calculator} title="Salary Deduction Rules" subtitle="Used when calculating salary slips with deductions" color="amber">
        {criteriaLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
            <Loader2 size={14} className="animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Working Days per Month" hint="Used to calculate the per-day salary rate">
                <Input type="number" min={1} max={31}
                  value={criteria.workingDaysPerMonth}
                  onChange={e => setCriteria(p => ({ ...p, workingDaysPerMonth: Number(e.target.value) }))} />
              </Field>
              <Field label="Absent Penalty (× per-day)" hint="1.0 = full day deducted per absent day">
                <Input type="number" min={0} max={5} step={0.1}
                  value={criteria.absentPenaltyFraction}
                  onChange={e => setCriteria(p => ({ ...p, absentPenaltyFraction: e.target.value }))} />
              </Field>
              <Field label="Late Penalty (× per-day)" hint="0.5 = half day deducted per late arrival">
                <Input type="number" min={0} max={5} step={0.1}
                  value={criteria.latePenaltyFraction}
                  onChange={e => setCriteria(p => ({ ...p, latePenaltyFraction: e.target.value }))} />
              </Field>
              <Field label="Leave Penalty (× per-day)" hint="0 = no deduction for approved leave">
                <Input type="number" min={0} max={5} step={0.1}
                  value={criteria.leavePenaltyFraction}
                  onChange={e => setCriteria(p => ({ ...p, leavePenaltyFraction: e.target.value }))} />
              </Field>
            </div>
            <Button onClick={saveCriteria} disabled={criteriaSaving} className="bg-amber-500 hover:bg-amber-600 text-white gap-2 w-full sm:w-auto">
              {criteriaSaving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={14} /> Save Deduction Rules</>}
            </Button>
          </div>
        )}
      </Section>

      {/* 4. Database Backup */}
      <Section icon={Database} title="Database Backup & Restore" subtitle="Download, save on server, and restore school data" color="blue">
        <div className="space-y-5">
          {autoStatus && (
            <div className={`rounded-xl p-4 border ${
              autoStatus.lastStatus === "success" ? "bg-emerald-50 border-emerald-200" :
              autoStatus.lastStatus === "error"   ? "bg-red-50 border-red-200" :
              "bg-gray-50 border-gray-200"}`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                    {autoStatus.lastStatus === "success" ? <CheckCircle size={14} className="text-emerald-600" /> :
                     autoStatus.lastStatus === "error"   ? <AlertCircle  size={14} className="text-red-600" /> :
                     <Clock size={14} className="text-gray-400" />}
                    Auto-Backup
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Last run: {fmt(autoStatus.lastRun)}</p>
                  <p className="text-xs text-gray-500">Next run: {autoStatus.nextRun}</p>
                  {autoStatus.lastError && <p className="text-xs text-red-500 mt-1">{autoStatus.lastError}</p>}
                </div>
                <Button size="sm" variant="outline" onClick={runBackupNow} disabled={runningNow} className="gap-1.5">
                  {runningNow ? <><Loader2 size={13} className="animate-spin" /> Running…</> : <><Play size={13} /> Run Now</>}
                </Button>
              </div>
              {autoStatus.autoBackupCount > 0 && (
                <p className="text-xs text-gray-400 mt-2">{autoStatus.autoBackupCount} auto-backup file(s) saved</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={downloadBackup} className="gap-2">
              <Download size={15} /> Download Backup
            </Button>
            <Button variant="outline" onClick={saveToServer} disabled={saving} className="gap-2">
              {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : <><Save size={15} /> Save to Server</>}
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={restoring} className="gap-2">
              <Upload size={15} /> Restore from File
            </Button>
            <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleRestore} />
          </div>

          {loadingBackups ? (
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Loader2 size={14} className="animate-spin" /> Loading backups…
            </div>
          ) : backups.length > 0 ? (
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {["File", "Size", "Date", ""].map(h => (
                      <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {backups.map((b, i) => (
                    <tr key={i} className="border-t hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs text-gray-700 truncate max-w-[160px]">{b.filename}</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{(b.size / 1024).toFixed(1)} KB</td>
                      <td className="py-2.5 px-4 text-xs text-gray-500">{new Date(b.createdAt).toLocaleDateString("en-PK")}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-1 justify-end">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-blue-500"
                            onClick={() => downloadSaved(b.filename)}><Download size={13} /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-emerald-600"
                            disabled={!!restoreTarget} onClick={() => restoreFromServer(b.filename)}>
                            {restoreTarget === b.filename ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500"
                            onClick={() => deleteBackup(b.filename)}><Trash2 size={13} /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-400 py-2">No server backups yet. Click "Save to Server" to create one.</p>
          )}
        </div>
      </Section>
    </div>
  );
}
