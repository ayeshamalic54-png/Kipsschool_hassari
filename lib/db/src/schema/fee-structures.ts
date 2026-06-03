import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feeStructuresTable = pgTable("fee_structures", {
  id: serial("id").primaryKey(),
  classId: integer("class_id").notNull().unique(),
  className: varchar("class_name", { length: 100 }).notNull().default(""),
  monthlyFee: numeric("monthly_fee", { precision: 10, scale: 2 }).default("0"),
  admissionFee: numeric("admission_fee", { precision: 10, scale: 2 }).default("0"),
  examFee: numeric("exam_fee", { precision: 10, scale: 2 }).default("0"),
  libraryFee: numeric("library_fee", { precision: 10, scale: 2 }).default("0"),
  transportFee: numeric("transport_fee", { precision: 10, scale: 2 }).default("0"),
  Arrears: numeric("Arrears", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFeeStructureSchema = createInsertSchema(feeStructuresTable).omit({ id: true, createdAt: true });
export type InsertFeeStructure = z.infer<typeof insertFeeStructureSchema>;
export type FeeStructure = typeof feeStructuresTable.$inferSelect;
