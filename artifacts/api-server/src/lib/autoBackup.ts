import cron from "node-cron";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";
import { db } from "@workspace/db";
import {
  studentsTable, feesTable, attendanceTable, examsTable, examResultsTable,
  staffTable, salariesTable, accountEntriesTable, certificatesTable, classesTable, usersTable,
  feeStructuresTable, settingsTable
} from "@workspace/db";
import { logger } from "./logger";

const BACKUP_DIR = path.resolve(process.cwd(), "../../backups");

async function sendBackupEmail(filePath: string, filename: string) {
  const host = process.env.BACKUP_EMAIL_HOST || "smtp.gmail.com";
  const port = Number(process.env.BACKUP_EMAIL_PORT || "465");
  const secure = process.env.BACKUP_EMAIL_SECURE !== "false";
  const user = process.env.BACKUP_EMAIL_USER;
  const pass = process.env.BACKUP_EMAIL_PASSWORD;
  const recipient = process.env.BACKUP_EMAIL_RECIPIENT || "ayeshamalic54@gmail.com";

  if (!user || !pass || pass === "your_gmail_app_password_here") {
    logger.warn("SMTP credentials not configured or using placeholders. Skipping backup email sending.");
    return;
  }

  let attachmentPath = filePath;
  let isTempCreated = false;
  const tempPath = filePath.replace(".json", "-email-stripped.json");

  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed.data) {
      if (Array.isArray(parsed.data.students)) {
        parsed.data.students = parsed.data.students.map((s: any) => ({
          ...s,
          imageUrl: s.imageUrl && s.imageUrl.startsWith("data:") ? "[image_stripped]" : s.imageUrl
        }));
      }
      if (Array.isArray(parsed.data.staff)) {
        parsed.data.staff = parsed.data.staff.map((s: any) => ({
          ...s,
          imageUrl: s.imageUrl && s.imageUrl.startsWith("data:") ? "[image_stripped]" : s.imageUrl
        }));
      }
      fs.writeFileSync(tempPath, JSON.stringify(parsed, null, 2));
      attachmentPath = tempPath;
      isTempCreated = true;
      logger.info("Created stripped backup file for email attachment (removed large base64 student/staff photos)");
    }
  } catch (stripErr) {
    logger.warn({ err: stripErr }, "Failed to strip images from backup for email. Sending original instead.");
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"Kips School Backup" <${user}>`,
      to: recipient,
      subject: `Daily Database Backup - ${new Date().toLocaleDateString("en-PK", { timeZone: "Asia/Karachi" })}`,
      text: `Assalamu Alaikum,\n\nAttached is the automatic daily database backup file for Kips School Hassari, generated on ${new Date().toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}.\n\nNote: Large student/staff photo data has been stripped from this email attachment to comply with email size limits. The full backup file containing photos remains saved locally on the server.\n\nBest regards,\nSchool ERP System`,
      attachments: [
        {
          filename: filename,
          path: attachmentPath,
        },
      ],
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info({ messageId: info.messageId }, "Backup email sent successfully");
    autoBackupState.lastEmailStatus = "sent_successfully";
  } catch (emailErr: any) {
    logger.error({ err: emailErr }, "Failed to send backup email");
    autoBackupState.lastEmailStatus = `error: ${emailErr.message || String(emailErr)}`;
  } finally {
    if (isTempCreated) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupErr) {
        logger.warn({ err: cleanupErr }, "Failed to delete temporary email backup file");
      }
    }
  }
}

const MAX_AUTO_BACKUPS = 7;

export const autoBackupState = {
  lastRun: null as string | null,
  lastStatus: "never" as "never" | "success" | "error",
  lastError: null as string | null,
  lastEmailStatus: "never" as string,
  nextRun: "Daily at 10:00 AM and 3:00 PM (PKT)",
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
    const filePath = path.join(BACKUP_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(backup, null, 2));
    logger.info({ filename, students: students.length }, "Auto daily backup saved");

    // Email backup as attachment
    await sendBackupEmail(filePath, filename);

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
  // Run at 10:00 AM Pakistan Time (PKT)
  cron.schedule("0 10 * * *", runAutoBackup, { timezone: "Asia/Karachi" });
  
  // Run at 3:00 PM Pakistan Time (PKT)
  cron.schedule("0 15 * * *", runAutoBackup, { timezone: "Asia/Karachi" });
  
  logger.info("Auto daily backup scheduler started (runs at 10:00 AM and 3:00 PM PKT)");
}

export { runAutoBackup };
