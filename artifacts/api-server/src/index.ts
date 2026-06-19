import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { startAutoBackupScheduler } from "./lib/autoBackup";
import { hashPassword } from "./lib/auth";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// Run safe DB migrations on startup
async function runMigrations() {
  try {
    await db.execute(sql.raw(`ALTER TABLE staff ADD COLUMN IF NOT EXISTS image_url TEXT`));
    logger.info("DB migrations complete");
  } catch (e) {
    logger.warn({ e }, "Migration warning (non-fatal)");
  }
}

// Seed default admin if DB is empty
async function seedDefaultAdmin() {
  try {
    const existingUsers = await db.select().from(usersTable).limit(1);
    if (existingUsers.length === 0) {
      logger.info("No users found in database. Seeding default admin user...");
      const hashedPassword = await hashPassword("@Munni0055@");
      await db.insert(usersTable).values({
        username: "admin",
        password: hashedPassword,
        role: "admin",
        name: "Administrator",
      });
      logger.info("Default admin user seeded successfully (username: 'admin', password: '@Munni0055@')");
    }
  } catch (err) {
    logger.warn({ err }, "Failed to seed default admin (non-fatal)");
  }
}

runMigrations().then(() => {
  seedDefaultAdmin().then(() => {
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
      startAutoBackupScheduler();
    });
  });
});
