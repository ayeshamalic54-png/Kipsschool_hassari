import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable, feesTable, attendanceTable, examsTable, examResultsTable,
  staffTable, salariesTable, accountEntriesTable, certificatesTable, classesTable, usersTable
} from "@workspace/db";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";
import fs from "fs";
import path from "path";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();
const BACKUP_DIR = path.resolve("/home/runner/workspace/backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function collectAllData() {
  const [students, fees, attendance, exams, examResults, staff, salaries, accountEntries, certificates, classes, users] = await Promise.all([
    db.select().from(studentsTable),
    db.select().from(feesTable),
    db.select().from(attendanceTable),
    db.select().from(examsTable),
    db.select().from(examResultsTable),
    db.select().from(staffTable),
    db.select().from(salariesTable),
    db.select().from(accountEntriesTable),
    db.select().from(certificatesTable),
    db.select().from(classesTable),
    db.select({ id: usersTable.id, username: usersTable.username, name: usersTable.name, role: usersTable.role, email: usersTable.email }).from(usersTable),
  ]);
  return { students, fees, attendance, exams, examResults, staff, salaries, accountEntries, certificates, classes, users };
}

// GET /api/admin/backup — download backup JSON
router.get("/backup", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const data = await collectAllData();
    const backup = { version: "1.0", timestamp: new Date().toISOString(), data };
    res.setHeader("Content-Disposition", `attachment; filename="kips-backup-${new Date().toISOString().slice(0,10)}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(backup);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Backup failed" });
  }
});

// POST /api/admin/backup/save — save backup to disk
router.post("/backup/save", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    ensureBackupDir();
    const data = await collectAllData();
    const backup = { version: "1.0", timestamp: new Date().toISOString(), data };
    const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    const filepath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    res.json({ message: "Backup saved", filename });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Auto-backup failed" });
  }
});

// GET /api/admin/backups — list saved backups
router.get("/backups", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith(".json"))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return { filename: f, size: stat.size, createdAt: stat.mtime.toISOString() };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(files);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to list backups" });
  }
});

// GET /api/admin/backups/:filename — download a saved backup
router.get("/backups/:filename", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const filepath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filepath) || !req.params.filename.endsWith(".json")) {
      res.status(404).json({ error: "Backup not found" }); return;
    }
    res.setHeader("Content-Disposition", `attachment; filename="${req.params.filename}"`);
    res.setHeader("Content-Type", "application/json");
    res.send(fs.readFileSync(filepath));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Download failed" });
  }
});

// DELETE /api/admin/backups/:filename — delete a saved backup
router.delete("/backups/:filename", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const filepath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filepath)) { res.status(404).json({ error: "Not found" }); return; }
    fs.unlinkSync(filepath);
    res.json({ message: "Deleted" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Delete failed" });
  }
});

// POST /api/admin/restore — restore from uploaded JSON
router.post("/restore", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const backup = req.body;
    if (!backup?.data) { res.status(400).json({ error: "Invalid backup file" }); return; }
    const { students, fees, attendance, exams, examResults, staff, salaries, accountEntries, certificates, classes } = backup.data;

    // Save current state before restore
    ensureBackupDir();
    const preData = await collectAllData();
    const preBackup = { version: "1.0", timestamp: new Date().toISOString(), note: "auto-save before restore", data: preData };
    const preFilename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, preFilename), JSON.stringify(preBackup, null, 2));

    // Clear existing data (preserve staff and admin/teacher users)
    await db.delete(examResultsTable);
    await db.delete(examsTable);
    await db.delete(feesTable);
    await db.delete(attendanceTable);
    await db.delete(certificatesTable);
    await db.delete(salariesTable);
    await db.delete(accountEntriesTable);
    await db.delete(studentsTable);

    // Restore data
    if (classes?.length) {
      for (const c of classes) {
        try { await db.insert(classesTable).values(c).onConflictDoNothing(); } catch {}
      }
    }
    if (students?.length) {
      for (const s of students) {
        try { await db.insert(studentsTable).values(s).onConflictDoNothing(); } catch {}
      }
    }
    if (fees?.length) {
      for (const f of fees) {
        try { await db.insert(feesTable).values(f).onConflictDoNothing(); } catch {}
      }
    }
    if (attendance?.length) {
      for (const a of attendance) {
        try { await db.insert(attendanceTable).values(a).onConflictDoNothing(); } catch {}
      }
    }
    if (exams?.length) {
      for (const e of exams) {
        try { await db.insert(examsTable).values(e).onConflictDoNothing(); } catch {}
      }
    }
    if (examResults?.length) {
      for (const r of examResults) {
        try { await db.insert(examResultsTable).values(r).onConflictDoNothing(); } catch {}
      }
    }
    if (salaries?.length) {
      for (const s of salaries) {
        try { await db.insert(salariesTable).values(s).onConflictDoNothing(); } catch {}
      }
    }
    if (accountEntries?.length) {
      for (const a of accountEntries) {
        try { await db.insert(accountEntriesTable).values(a).onConflictDoNothing(); } catch {}
      }
    }
    if (certificates?.length) {
      for (const c of certificates) {
        try { await db.insert(certificatesTable).values(c).onConflictDoNothing(); } catch {}
      }
    }

    res.json({ message: "Restore complete", preBackup: preFilename });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Restore failed" });
  }
});

export default router;
