import { Router } from "express";
import { db } from "@workspace/db";
import {
  studentsTable, feesTable, attendanceTable, examsTable, examResultsTable,
  staffTable, salariesTable, accountEntriesTable, certificatesTable, classesTable, usersTable
} from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { requireAuth, hashPassword } from "../lib/auth";
import type { Request } from "express";
import fs from "fs";
import path from "path";
import { autoBackupState, runAutoBackup } from "../lib/autoBackup";

type AuthReq = Request & { user: Record<string, unknown> };

const router = Router();
const BACKUP_DIR = path.resolve(process.cwd(), "../../backups");

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// FIX: createdAt/updatedAt strip mat karo — Date string ko proper Date object mein convert karo
function sanitizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (Array.isArray(value)) {
      result[key] = value.join(",");
    } else if (value !== null && typeof value === "object" && !(value instanceof Date)) {
      result[key] = JSON.stringify(value);
    } else if ((key === "createdAt" || key === "updatedAt") && typeof value === "string") {
      // String date ko Date object mein convert karo
      const d = new Date(value);
      result[key] = isNaN(d.getTime()) ? new Date() : d;
    } else if ((key === "createdAt" || key === "updatedAt") && (value === null || value === undefined)) {
      // null/undefined hai to current time daal do
      result[key] = new Date();
    } else {
      result[key] = value;
    }
  }
  return result;
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

// GET /api/admin/backup
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

// POST /api/admin/backup/save
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

// GET /api/admin/backups
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

// GET /api/admin/backups/:filename
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

// DELETE /api/admin/backups/:filename
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

// FIX: sql.raw() Drizzle mein params support nahi karta — individual inserts use karo
async function truncateAndInsert(tableName: string, seqName: string, rows: Record<string, unknown>[]) {
  await db.execute(sql.raw(`TRUNCATE TABLE "${tableName}" RESTART IDENTITY CASCADE`));
  if (!rows?.length) return;
  for (const row of rows) {
    const sanitized = sanitizeRow(row);
    const cols = Object.keys(sanitized);
    if (!cols.length) continue;
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const values = cols.map(c => sanitized[c] ?? null);
    try {
      await db.execute(
        sql.raw(
          `INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
        ),
      );
      // Note: Drizzle ke saath raw parameterized queries ke liye better approach:
      // Upar wali line sirf structure ke liye hai — niche wali actual insert karta hai
      await db.execute(
        Object.assign(
          sql.raw(`INSERT INTO "${tableName}" (${cols.map(c => `"${c}"`).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}) ON CONFLICT DO NOTHING`),
          { values }
        ) as any
      );
    } catch { /* skip conflicting rows */ }
  }
  await db.execute(sql.raw(`SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM "${tableName}"), 0) + 1, false)`));
}

// ── Shared restore logic ───────────────────────────────────────────────────────
async function performRestore(
  backupData: Record<string, unknown[]>,
  errors: string[]
) {
  const { students, fees, attendance, exams, examResults, staff, salaries, accountEntries, certificates, classes } = backupData as any;

  // 1. Classes pehle insert karo (students inhe reference karte hain)
  if (classes?.length) {
    for (const c of classes) {
      try {
        await db.insert(classesTable).values(sanitizeRow(c) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`class ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('classes_id_seq', COALESCE((SELECT MAX(id) FROM "classes"), 0) + 1, false)`));
  }

  // 2. Dependent tables delete karo (order important hai — FK constraints)
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

  // 3. Students restore karo
  if (students?.length) {
    for (const s of students) {
      try {
        await db.insert(studentsTable).values(sanitizeRow(s) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`student ${s.id} (${s.name}): ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM "students"), 0) + 1, false)`));
  }

  // 4. Fees
  if (fees?.length) {
    for (const f of fees) {
      try {
        await db.insert(feesTable).values(sanitizeRow(f) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`fee ${f.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('fees_id_seq', COALESCE((SELECT MAX(id) FROM "fees"), 0) + 1, false)`));
  }

  // 5. Attendance
  if (attendance?.length) {
    for (const a of attendance) {
      try {
        await db.insert(attendanceTable).values(sanitizeRow(a) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`attendance ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('attendance_id_seq', COALESCE((SELECT MAX(id) FROM "attendance"), 0) + 1, false)`));
  }

  // 6. Exams
  if (exams?.length) {
    for (const e of exams) {
      try {
        await db.insert(examsTable).values(sanitizeRow(e) as any).onConflictDoNothing();
      } catch (err: unknown) {
        errors.push(`exam ${e.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('exams_id_seq', COALESCE((SELECT MAX(id) FROM "exams"), 0) + 1, false)`));
  }

  // 7. Exam results
  if (examResults?.length) {
    for (const r of examResults) {
      try {
        await db.insert(examResultsTable).values(sanitizeRow(r) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`examResult ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('exam_results_id_seq', COALESCE((SELECT MAX(id) FROM "exam_results"), 0) + 1, false)`));
  }

  // 8. FIX: Staff restore karo (pehle missing tha!)
  if (staff?.length) {
    for (const s of staff) {
      try {
        await db.insert(staffTable).values(sanitizeRow(s) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`staff ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('staff_id_seq', COALESCE((SELECT MAX(id) FROM "staff"), 0) + 1, false)`));
  }

  // 9. Salaries
  if (salaries?.length) {
    for (const s of salaries) {
      try {
        await db.insert(salariesTable).values(sanitizeRow(s) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`salary ${s.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('salaries_id_seq', COALESCE((SELECT MAX(id) FROM "salaries"), 0) + 1, false)`));
  }

  // 10. Account entries
  if (accountEntries?.length) {
    for (const a of accountEntries) {
      try {
        await db.insert(accountEntriesTable).values(sanitizeRow(a) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`accountEntry ${a.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('account_entries_id_seq', COALESCE((SELECT MAX(id) FROM "account_entries"), 0) + 1, false)`));
  }

  // 11. Certificates
  if (certificates?.length) {
    for (const c of certificates) {
      try {
        await db.insert(certificatesTable).values(sanitizeRow(c) as any).onConflictDoNothing();
      } catch (e: unknown) {
        errors.push(`certificate ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    await db.execute(sql.raw(`SELECT setval('certificates_id_seq', COALESCE((SELECT MAX(id) FROM "certificates"), 0) + 1, false)`));
  }
}

// POST /api/admin/restore
router.post("/restore", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const backup = req.body;
    if (!backup?.data) { res.status(400).json({ error: "Invalid backup file" }); return; }

    ensureBackupDir();
    const preData = await collectAllData();
    const preBackup = { version: "1.0", timestamp: new Date().toISOString(), note: "auto-save before restore", data: preData };
    const preFilename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, preFilename), JSON.stringify(preBackup, null, 2));

    const errors: string[] = [];
    await performRestore(backup.data, errors);

    const afterStudents = await db.select().from(studentsTable);
    req.log.info({ restored: afterStudents.length, errors }, "Restore complete");

    res.json({
      message: errors.length > 0 ? `Restore complete with ${errors.length} warning(s)` : "Restore complete",
      preBackup: preFilename,
      studentsRestored: afterStudents.length,
      errors,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: `Restore failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

// POST /api/admin/restore-from-server/:filename
router.post("/restore-from-server/:filename", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const filepath = path.join(BACKUP_DIR, req.params.filename);
    if (!fs.existsSync(filepath) || !req.params.filename.endsWith(".json")) {
      res.status(400).json({ error: "Backup not found" }); return;
    }
    const backup = JSON.parse(fs.readFileSync(filepath, "utf-8"));
    if (!backup?.data) { res.status(400).json({ error: "Invalid backup file" }); return; }

    ensureBackupDir();
    const preData = await collectAllData();
    const preBackup = { version: "1.0", timestamp: new Date().toISOString(), note: "auto-save before restore", data: preData };
    const preFilename = `pre-restore-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, preFilename), JSON.stringify(preBackup, null, 2));

    const errors: string[] = [];
    await performRestore(backup.data, errors);

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

// POST /api/admin/sync-student-users
router.post("/sync-student-users", requireAuth, async (req, res) => {
  const reqUser = (req as AuthReq).user;
  if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }
  try {
    const allStudents = await db.select().from(studentsTable);
    const allUsers = await db.select({
      relatedId: usersTable.relatedId,
      username: usersTable.username,
    }).from(usersTable).where(eq(usersTable.role, "student"));

    const existingRelatedIds = new Set(allUsers.map(u => u.relatedId).filter(Boolean));
    const existingUsernames = new Set(allUsers.map(u => u.username));

    const missingStudents = allStudents.filter(s =>
      !existingRelatedIds.has(s.id) && !existingUsernames.has(s.username ?? "")
    );

    const created: string[] = [];
    const errors: string[] = [];

    for (const student of missingStudents) {
      try {
        const username = student.username ??
          student.name.toLowerCase().replace(/\s+/g, ".") + "." + (student.admissionNumber?.split("-").pop() ?? String(student.id));
        const hashed = await hashPassword("kips123");
        await db.insert(usersTable).values({
          username,
          password: hashed,
          role: "student",
          name: student.name,
          relatedId: student.id,
        }).onConflictDoNothing();
        if (!student.username) {
          await db.update(studentsTable).set({ username }).where(eq(studentsTable.id, student.id));
        }
        created.push(`${student.name} — login: ${username}`);
      } catch (e: unknown) {
        errors.push(`${student.name}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    await db.execute(sql.raw(`SELECT setval('students_id_seq', COALESCE((SELECT MAX(id) FROM "students"), 0) + 1, false)`));
    await db.execute(sql.raw(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM "users"), 0) + 1, false)`));

    res.json({
      message: `Sync mukammal. ${created.length} account(s) banaye gaye.`,
      totalStudents: allStudents.length,
      alreadyHadAccounts: allStudents.length - missingStudents.length,
      created,
      errors,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: `Sync failed: ${err instanceof Error ? err.message : String(err)}` });
  }
});

export default router;
