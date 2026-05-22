import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, studentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, requireAuth } from "../lib/auth";
import type { Request } from "express";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }

    const trimmed = String(username).trim();

    // Step 1: usersTable mein username se dhundo
    const [existingUser] = await db.select().from(usersTable)
      .where(eq(usersTable.username, trimmed)).limit(1);

    if (existingUser) {
      const valid = await comparePassword(password, existingUser.password);
      if (!valid) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      const token = signToken({ id: existingUser.id, username: existingUser.username, role: existingUser.role, name: existingUser.name });
      res.json({ token, user: { id: existingUser.id, username: existingUser.username, role: existingUser.role, name: existingUser.name, email: existingUser.email } });
      return;
    }

    // Step 2: admissionNumber se student dhundo
    let student = null;
    const [byAdm] = await db.select().from(studentsTable)
      .where(eq(studentsTable.admissionNumber, trimmed)).limit(1);
    if (byAdm) {
      student = byAdm;
    } else {
      // Step 3: rollNumber se dhundo
      const [byRoll] = await db.select().from(studentsTable)
        .where(eq(studentsTable.rollNumber, trimmed)).limit(1);
      if (byRoll) student = byRoll;
    }

    if (!student) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // Password check - sirf kips123 chalega
    if (password.trim() !== "kips123") {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    // User account banaao
    const newUsername = student.username ??
      student.name.toLowerCase().replace(/\s+/g, ".") + "." +
      (student.admissionNumber?.split("-").pop()?.trim() ?? String(student.id));

    const hashed = await hashPassword("kips123");

    await db.insert(usersTable).values({
      username: newUsername,
      password: hashed,
      role: "student",
      name: student.name,
      relatedId: student.id,
    }).onConflictDoNothing();

    if (!student.username) {
      await db.update(studentsTable)
        .set({ username: newUsername })
        .where(eq(studentsTable.id, student.id));
    }

    const [newUser] = await db.select().from(usersTable)
      .where(eq(usersTable.username, newUsername)).limit(1);

    if (!newUser) {
      res.status(500).json({ error: "Account creation failed" });
      return;
    }

    const token = signToken({ id: newUser.id, username: newUser.username, role: "student", name: newUser.name });
    res.json({ token, user: { id: newUser.id, username: newUser.username, role: "student", name: newUser.name, email: null } });

  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = (req as Request & { user: Record<string, unknown> }).user;
    res.json(user);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const reqUser = (req as Request & { user: Record<string, unknown> }).user;
    const [user] = await db.select().from(usersTable)
      .where(eq(usersTable.id, Number(reqUser.id))).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const hashed = await hashPassword(newPassword);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/auth/change-password — change logged-in user's password
router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required" }); return;
    }
    if (String(newPassword).length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters" }); return;
    }
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    if (!dbUser) { res.status(404).json({ error: "User not found" }); return; }
    const valid = await comparePassword(String(currentPassword), dbUser.password);
    if (!valid) { res.status(401).json({ error: "Current password is incorrect" }); return; }
    const hashed = await hashPassword(String(newPassword));
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;