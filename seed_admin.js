import pg from 'pg';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read root .env file
let connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key === 'NEON_DATABASE_URL' || key === 'DATABASE_URL') {
          connectionString = val;
        }
      }
    }
  }
} catch (err) {
  console.log("No .env file read, using environment variables...");
}

if (!connectionString) {
  console.error("ERROR: Database connection string not found. Please set NEON_DATABASE_URL in the .env file.");
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to database successfully!");

    const adminHash = bcrypt.hashSync('admin123', 10);

    // Check if admin user already exists
    const checkRes = await client.query("SELECT id FROM users WHERE username = 'admin'");
    if (checkRes.rows.length > 0) {
      console.log("Admin user already exists. Updating password to 'admin123'...");
      await client.query(
        `UPDATE "users" SET "password" = $1, "updated_at" = NOW() WHERE "username" = 'admin'`,
        [adminHash]
      );
      console.log("Password updated successfully!");
    } else {
      console.log("Creating default admin user...");
      await client.query(
        `INSERT INTO "users" ("username", "password", "role", "name", "created_at", "updated_at") 
         VALUES ('admin', $1, 'admin', 'Administrator', NOW(), NOW())`,
        [adminHash]
      );
      console.log("Default admin user created successfully!");
      console.log("Credentials: username = 'admin', password = 'admin123'");
    }

  } catch (err) {
    console.error("Error seeding database:", err.message);
  } finally {
    await client.end();
  }
}

main();
