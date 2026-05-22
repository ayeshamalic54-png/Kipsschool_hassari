import cron from "node-cron";
import fs from "fs";
import path from "path";
import { db } from "@workspace/db";
import {
  studentsTable, feesTable, attendanceTable, examsTable, examResultsTable,
  staffTable, salariesTable, accountEntriesTable, certificatesTable, classesTable, usersTable,
  feeStructuresTable, settingsTable
} from "@workspace/db";
import { logger } from "./logger";

const BACKUP_DIR = path.resolve(process.cwd(), "../../backups");
const MAX_AUTO_BACKUPS = 7;

export const autoBackupState = {
  lastRun: null as string | null,
  lastStatus: "never" as "never" | "success" | "error",
  lastError: null as string | null,
  nextRun: "Every day at midnight (00:00)",
  enabled: true,
};

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

async function runAutoBackup() {
  try {
    ensureBackupDir();
    const [students, fees, attendance, exams, examResults, staff, salaries, accountEntries, certificates, classes, users, feeStructures, settings] = await Promise.all([
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
      db.select().from(feeStructuresTable),
      db.select().from(settingsTable),
    ]);

    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      note: "auto-daily-backup",
      data: { students, fees, attendance, exams, examResults, staff, salaries, accountEntries, certificates, classes, users, feeStructures, settings },
    };

    const filename = `auto-backup-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.json`;
    fs.writeFileSync(path.join(BACKUP_DIR, filename), JSON.stringify(backup, null, 2));
    logger.info({ filename, students: students.length }, "Auto daily backup saved");

    const autoFiles = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith("auto-backup-"))
      .sort()
      .reverse();
    if (autoFiles.length > MAX_AUTO_BACKUPS) {
      autoFiles.slice(MAX_AUTO_BACKUPS).forEach(f => {
        try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
      });
    }

    autoBackupState.lastRun = new Date().toISOString();
    autoBackupState.lastStatus = "success";
    autoBackupState.lastError = null;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Auto backup failed");
    autoBackupState.lastRun = new Date().toISOString();
    autoBackupState.lastStatus = "error";
    autoBackupState.lastError = msg;
  }
}

export function startAutoBackupScheduler() {
  cron.schedule("0 0 * * *", runAutoBackup, { timezone: "Asia/Karachi" });
  logger.info("Auto daily backup scheduler started (runs at midnight PKT)");
}

export { runAutoBackup };
