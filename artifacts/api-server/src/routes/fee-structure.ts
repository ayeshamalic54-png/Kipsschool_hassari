import { Router } from "express";
import { db } from "@workspace/db";
import { feeStructuresTable, classesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import type { Request } from "express";

type AuthReq = Request & { user: { id: number; role: string } };

const router = Router();

const toNum = (v: unknown) => Number(v ?? 0);

// GET /api/fee-structures
router.get("/", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(feeStructuresTable);
    res.json(rows.map(r => ({
      ...r,
      monthlyFee:   toNum(r.monthlyFee),
      admissionFee: toNum(r.admissionFee),
      examFee:      toNum(r.examFee),
      libraryFee:   toNum(r.libraryFee),
      transportFee: toNum(r.transportFee),
      // FIX: consistently use "Arrears" field name
      Arrears:      toNum((r as Record<string, unknown>).Arrears ?? 0),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/fee-structures/class/:classId
router.get("/class/:classId", requireAuth, async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(feeStructuresTable)
      .where(eq(feeStructuresTable.classId, Number(req.params.classId)));
    if (!row) { res.json(null); return; }
    res.json({
      ...row,
      monthlyFee:   toNum(row.monthlyFee),
      admissionFee: toNum(row.admissionFee),
      examFee:      toNum(row.examFee),
      libraryFee:   toNum(row.libraryFee),
      transportFee: toNum(row.transportFee),
      // FIX: was using wrong field name "ArrearsFee" — now consistently "Arrears"
      Arrears:      toNum((row as Record<string, unknown>).Arrears ?? 0),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/fee-structures (admin only) — upsert by classId
router.post("/", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const { classId, monthlyFee, admissionFee, examFee, libraryFee, transportFee, Arrears } = req.body;
    if (!classId || !monthlyFee) {
      res.status(400).json({ error: "classId and monthlyFee are required" });
      return;
    }

    const [cls] = await db.select({ name: classesTable.name }).from(classesTable).where(eq(classesTable.id, Number(classId)));
    const className = cls?.name ?? "";

    const [existing] = await db.select().from(feeStructuresTable).where(eq(feeStructuresTable.classId, Number(classId)));

    // FIX: include Arrears in both insert and update
    const feeValues = {
      className,
      monthlyFee:   String(monthlyFee   ?? 0),
      admissionFee: String(admissionFee ?? 0),
      examFee:      String(examFee      ?? 0),
      libraryFee:   String(libraryFee   ?? 0),
      transportFee: String(transportFee ?? 0),
      Arrears:      String(Arrears      ?? 0),
    };

    let row: Record<string, unknown>;
    if (existing) {
      const [updated] = await db.update(feeStructuresTable)
        .set(feeValues as never)
        .where(eq(feeStructuresTable.id, existing.id))
        .returning();
      row = updated as Record<string, unknown>;
    } else {
      const [inserted] = await db.insert(feeStructuresTable)
        .values({ classId: Number(classId), ...feeValues } as never)
        .returning();
      row = inserted as Record<string, unknown>;
    }

    res.status(existing ? 200 : 201).json({
      ...row,
      monthlyFee:   toNum(row.monthlyFee),
      admissionFee: toNum(row.admissionFee),
      examFee:      toNum(row.examFee),
      libraryFee:   toNum(row.libraryFee),
      transportFee: toNum(row.transportFee),
      Arrears:      toNum(row.Arrears),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT /api/fee-structures/:id (admin only)
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const [existing] = await db.select().from(feeStructuresTable).where(eq(feeStructuresTable.id, Number(req.params.id)));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const { monthlyFee, admissionFee, examFee, libraryFee, transportFee, Arrears } = req.body;
    const existingExt = existing as Record<string, unknown>;

    // FIX: include Arrears in update
    const [updated] = await db.update(feeStructuresTable).set({
      monthlyFee:   monthlyFee   !== undefined ? String(monthlyFee)   : existing.monthlyFee   ?? "0",
      admissionFee: admissionFee !== undefined ? String(admissionFee) : existing.admissionFee ?? "0",
      examFee:      examFee      !== undefined ? String(examFee)      : existing.examFee      ?? "0",
      libraryFee:   libraryFee   !== undefined ? String(libraryFee)   : existing.libraryFee   ?? "0",
      transportFee: transportFee !== undefined ? String(transportFee) : existing.transportFee ?? "0",
      Arrears:      Arrears      !== undefined ? String(Arrears)      : String(existingExt.Arrears ?? "0"),
    } as never).where(eq(feeStructuresTable.id, Number(req.params.id))).returning();

    const updatedExt = updated as Record<string, unknown>;
    res.json({
      ...updated,
      monthlyFee:   toNum(updatedExt.monthlyFee),
      admissionFee: toNum(updatedExt.admissionFee),
      examFee:      toNum(updatedExt.examFee),
      libraryFee:   toNum(updatedExt.libraryFee),
      transportFee: toNum(updatedExt.transportFee),
      Arrears:      toNum(updatedExt.Arrears),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/fee-structures/:id (admin only)
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const reqUser = (req as AuthReq).user;
    if (reqUser.role !== "admin") { res.status(403).json({ error: "Admin only" }); return; }

    const [existing] = await db.select().from(feeStructuresTable).where(eq(feeStructuresTable.id, Number(req.params.id)));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    await db.delete(feeStructuresTable).where(eq(feeStructuresTable.id, Number(req.params.id)));
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
