import { Router } from "express";
import { db } from "@workspace/db";
import { staffTable, usersTable } from "@workspace/db";
import { eq, isNull } from "drizzle-orm";
import { requireAuth, hashPassword } from "../lib/auth";

const router = Router();

function staffRoleToUserRole(staffRole: string): string {
  if (staffRole === "principal" || staffRole === "admin") return "admin";
  return "teacher";
}

async function ensureStaffLoginAccount(staff: { id: number; name: string; role: string; email?: string | null; username?: string | null }) {
  const username = staff.username ?? staff.name.toLowerCase().replace(/\s+/g, ".") + ".staff";
  const userRole = staffRoleToUserRole(staff.role);
  const hashed = await hashPassword("kips123");
  await db.insert(usersTable).values({
    username,
    password: hashed,
    role: userRole,
    name: staff.name,
    email: staff.email ?? null,
    relatedId: staff.id,
  }).onConflictDoNothing();
  if (!staff.username) {
    await db.update(staffTable).set({ username }).where(eq(staffTable.id, staff.id));
  }
  return username;
}

// GET /api/staff
router.get("/", requireAuth, async (req, res) => {
  try {
    const staff = await db.select().from(staffTable);
    res.json(staff.map(s => ({ ...s, salary: s.salary ? Number(s.salary) : null })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/staff/fix-logins — create missing login accounts for all staff
router.post("/fix-logins", requireAuth, async (req, res) => {
  try {
    const allStaff = await db.select().from(staffTable);
    let fixed = 0;
    for (const s of allStaff) {
      const username = s.username ?? s.name.toLowerCase().replace(/\s+/g, ".") + ".staff";
      const [existing] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
      if (!existing) {
        await ensureStaffLoginAccount(s);
        fixed++;
      }
    }
    res.json({ fixed, total: allStaff.length, message: `${fixed} staff login accounts created` });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/staff
router.post("/", requireAuth, async (req, res) => {
  try {
    const data = req.body;
    const username = data.name.toLowerCase().replace(/\s+/g, ".") + ".staff";
    const [staff] = await db.insert(staffTable).values({ ...data, username, status: data.status || "active" }).returning();

    await ensureStaffLoginAccount({ id: staff.id, name: staff.name, role: staff.role, email: staff.email, username });

    res.status(201).json({ ...staff, salary: staff.salary ? Number(staff.salary) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/staff/:id
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const [updated] = await db.update(staffTable).set({ ...req.body, updatedAt: new Date() }).where(eq(staffTable.id, Number(req.params.id))).returning();
    if (!updated) {
      res.status(404).json({ error: "Staff not found" });
      return;
    }
    res.json({ ...updated, salary: updated.salary ? Number(updated.salary) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/staff/:id  (same as PATCH — frontend uses PUT for edit)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const [existing] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
    if (!existing) { res.status(404).json({ error: "Staff not found" }); return; }
    const [updated] = await db.update(staffTable).set({ ...req.body, updatedAt: new Date() }).where(eq(staffTable.id, staffId)).returning();
    res.json({ ...updated, salary: updated.salary ? Number(updated.salary) : null });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/staff/:id
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const staffId = Number(req.params.id);
    const [existing] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
    if (!existing) { res.status(404).json({ error: "Staff not found" }); return; }
    await db.delete(staffTable).where(eq(staffTable.id, staffId));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
