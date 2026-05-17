import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable, feesTable, attendanceTable, examsTable, examResultsTable,
  staffTable, salariesTable, accountEntriesTable, certificatesTable, classesTable, usersTable
} from "@workspace/db";
import { sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";
import fs from "fs";
import path from "path";
import { autoBackupState, runAutoBackup } from "../lib/autoBackup";

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

// Helper: truncate a table and reset its sequence, then bulk-insert rows
async function truncateAndInsert(tableName: string, seqName: string, rows: Record<string, unknown>[]) {
  await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`));
  if (!rows?.length) return;
  // Insert in batches of 50
  const BATCH = 50;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    // Use raw SQL so we can supply explicit id values that override the sequence
    const cols = Object.keys(batch[0]!);
    const valuesSql = batch.map((row, ri) =>
      `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`
    ).join(", ");
    const params = batch.flatMap(row => cols.map(c => (row as Record<string, unknown>)[c] ?? null));
    await db.execute(sql.raw(
      `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES ${valuesSql} ON CONFLICT DO NOTHING`,
      params
    ));
  }
  // Reset sequence to max id
  await db.execute(sql.raw(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 0) + 1, false)`));
}

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

    const errors: string[] = [];

    // Restore in dependency order — classes first (no FK deps), then students, then everything else
    // Classes: preserve existing, only add missing ones from backup
    if (classes?.length) {
      for (const c of classes) {
        try { await db.insert(classesTable).values(c).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`class ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('classes_id_seq', COALESCE((SELECT MAX(id) FROM "classes"), 0) + 1, false)`));
    }

    // Students: truncate + re-insert with explicit IDs
    try {
      await db.execute(sql.raw(`DELETE FROM "exam_results"`));
      await db.execute(sql.raw(`DELETE FROM "exams"`));
      await db.execute(sql.raw(`DELETE FROM "fees"`));
      await db.execute(sql.raw(`DELETE FROM "attendance"`));
      await db.execute(sql.raw(`DELETE FROM "certificates"`));
      await db.execute(sql.raw(`DELETE FROM "salaries"`));
      await db.execute(sql.raw(`DELETE FROM "account_entries"`));
      await db.execute(sql.raw(`DELETE FROM "students"`));
    } catch (e: unknown) {
      errors.push(`clear: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (students?.length) {
      for (const s of students) {
        try { await db.insert(studentsTable).values(s).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`student ${s.id} (${s.name}): ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM "students"), 0) + 1, false)`));
    }

    if (fees?.length) {
      for (const f of fees) {
        try { await db.insert(feesTable).values(f).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`fee ${f.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('fees_id_seq', COALESCE((SELECT MAX(id) FROM "fees"), 0) + 1, false)`));
    }

    if (attendance?.length) {
      for (const a of attendance) {
        try { await db.insert(attendanceTable).values(a).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`attendance ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM "attendance"), 0) + 1, false)`));
    }

    if (exams?.length) {
      for (const e of exams) {
        try { await db.insert(examsTable).values(e).onConflictDoNothing(); } catch (err: unknown) {
          errors.push(`exam ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('exams_id_seq', COALESCE((SELECT MAX(id) FROM "exams"), 0) + 1, false)`));
    }

    if (examResults?.length) {
      for (const r of examResults) {
        try { await db.insert(examResultsTable).values(r).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`examResult ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('exam_results_id_seq', COALESCE((SELECT MAX(id) FROM "exam_results"), 0) + 1, false)`));
    }

    if (salaries?.length) {
      for (const s of salaries) {
        try { await db.insert(salariesTable).values(s).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`salary ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('salaries_id_seq', COALESCE((SELECT MAX(id) FROM "salaries"), 0) + 1, false)`));
    }

    if (accountEntries?.length) {
      for (const a of accountEntries) {
        try { await db.insert(accountEntriesTable).values(a).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`accountEntry ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('account_entries_id_seq', COALESCE((SELECT MAX(id) FROM "account_entries"), 0) + 1, false)`));
    }

    if (certificates?.length) {
      for (const c of certificates) {
        try { await db.insert(certificatesTable).values(c).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`certificate ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('certificates_id_seq', COALESCE((SELECT MAX(id) FROM "certificates"), 0) + 1, false)`));
    }

    // Verify restore counts
    const afterStudents = await db.select().from(studentsTable);
    req.log.info({ restored: afterStudents.length, errors }, "Restore complete");

    if (errors.length > 0) {
      res.json({
        message: `Restore complete with ${errors.length} warning(s)`,
        preBackup: preFilename,
        studentsRestored: afterStudents.length,
        errors,
      });
    } else {
      res.json({
        message: "Restore complete",
        preBackup: preFilename,
        studentsRestored: afterStudents.length,
        errors: [],
      });
    }
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: `Restore failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// POST /api/admin/restore-from-server/:filename — restore directly from a saved server backup
router.post("/restore-from-server/:filename", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const filepath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filepath) || !req.params.filename.endsWith(".json")) {
      res.status(404).json({ error: "Backup not found" }); return;
    }
    const backup = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    req.body = backup;
    // Forward to the restore handler by calling the same logic
    // Inline the restore logic for simplicity
    if (!backup?.data) { res.status(400).json({ error: "Invalid backup file" }); return; }
    const { students, fees, attendance, exams, examResults, salaries, accountEntries, certificates, classes } = backup.data;

    ensureBackupDir();
    const preData = await collectAllData();
    const preBackup = { version: "1.0", timestamp: new Date().toISOString(), note: "auto-save before restore", data: preData };
    const preFilename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, preFilename), JSON.stringify(preBackup, null, 2));

    const errors: string[] = [];

    if (classes?.length) {
      for (const c of classes) {
        try { await db.insert(classesTable).values(c).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`class ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('classes_id_seq', COALESCE((SELECT MAX(id) FROM "classes"), 0) + 1, false)`));
    }

    await db.execute(sql.raw(`DELETE FROM "exam_results"`));
    await db.execute(sql.raw(`DELETE FROM "exams"`));
    await db.execute(sql.raw(`DELETE FROM "fees"`));
    await db.execute(sql.raw(`DELETE FROM "attendance"`));
    await db.execute(sql.raw(`DELETE FROM "certificates"`));
    await db.execute(sql.raw(`DELETE FROM "salaries"`));
    await db.execute(sql.raw(`DELETE FROM "account_entries"`));
    await db.execute(sql.raw(`DELETE FROM "students"`));

    if (students?.length) {
      for (const s of students) {
        try { await db.insert(studentsTable).values(s).onConflictDoNothing(); } catch (e: unknown) {
          errors.push(`student ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      await db.execute(sql.raw(`SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM "students"), 0) + 1, false)`));
    }
    if (fees?.length) {
      for (const f of fees) {
        try { await db.insert(feesTable).values(f).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('fees_id_seq', COALESCE((SELECT MAX(id) FROM "fees"), 0) + 1, false)`));
    }
    if (attendance?.length) {
      for (const a of attendance) {
        try { await db.insert(attendanceTable).values(a).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM "attendance"), 0) + 1, false)`));
    }
    if (exams?.length) {
      for (const e of exams) {
        try { await db.insert(examsTable).values(e).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('exams_id_seq', COALESCE((SELECT MAX(id) FROM "exams"), 0) + 1, false)`));
    }
    if (examResults?.length) {
      for (const r of examResults) {
        try { await db.insert(examResultsTable).values(r).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('exam_results_id_seq', COALESCE((SELECT MAX(id) FROM "exam_results"), 0) + 1, false)`));
    }
    if (salaries?.length) {
      for (const s of salaries) {
        try { await db.insert(salariesTable).values(s).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('salaries_id_seq', COALESCE((SELECT MAX(id) FROM "salaries"), 0) + 1, false)`));
    }
    if (accountEntries?.length) {
      for (const a of accountEntries) {
        try { await db.insert(accountEntriesTable).values(a).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('account_entries_id_seq', COALESCE((SELECT MAX(id) FROM "account_entries"), 0) + 1, false)`));
    }
    if (certificates?.length) {
      for (const c of certificates) {
        try { await db.insert(certificatesTable).values(c).onConflictDoNothing(); } catch {}
      }
      await db.execute(sql.raw(`SELECT setval('certificates_id_seq', COALESCE((SELECT MAX(id) FROM "certificates"), 0) + 1, false)`));
    }

    const afterStudents = await db.select().from(studentsTable);
    res.json({ message: "Restore complete", preBackup: preFilename, studentsRestored: afterStudents.length, errors });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: `Restore failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// GET /api/admin/auto-backup/status
router.get("/auto-backup/status", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const autoFiles = fs.existsSync(BACKUP_DIR)
      ? fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith("auto-backup-")).sort().reverse()
      : [];
    res.json({ ...autoBackupState, autoBackupCount: autoFiles.length, autoBackupFiles: autoFiles.slice(0, 7) });
  } catch (err) {
    res.status(500).json({ error: "Status check failed" });
  }
});

// POST /api/admin/auto-backup/run-now
router.post("/auto-backup/run-now", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    await runAutoBackup();
    res.json({ message: "Backup ran successfully", state: autoBackupState });
  } catch (err) {
    res.status(500).json({ error: "Manual backup run failed" });
  }
});

export default router;
