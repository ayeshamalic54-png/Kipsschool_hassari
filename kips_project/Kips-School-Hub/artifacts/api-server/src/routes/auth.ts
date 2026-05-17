import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { signToken, comparePassword, hashPassword, requireAuth } from "../lib/auth";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password required" });
      return;
    }
    const users = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!users.length) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const user = users[0];
    const valid = await comparePassword(password, user.password);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = signToken({ id: user.id, username: user.username, role: user.role, name: user.name });
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role, name: user.name, email: user.email }
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = (req as Request & { user: Record<string, unknown> }).user;
    res.json(user);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const reqUser = (req as Request & { user: Record<string, unknown> }).user;
    const users = await db.select().from(usersTable).where(eq(usersTable.id, Number(reqUser.id))).limit(1);
    if (!users.length) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const user = users[0];
    const valid = await comparePassword(currentPassword, user.password);
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const hashed = await hashPassword(newPassword);
    await db.update(usersTable).set({ password: hashed }).where(eq(usersTable.id, user.id));
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

import type { Request } from "express";

export default router;
