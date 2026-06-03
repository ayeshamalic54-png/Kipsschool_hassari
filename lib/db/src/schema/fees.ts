import { pgTable, serial, integer, numeric, timestamp, varchar, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const feesTable = pgTable("fees", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  month: varchar("month", { length: 20 }).notNull(), // YYYY-MM
  dueDate: varchar("due_date", { length: 20 }).notNull(),
  paidDate: varchar("paid_date", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("unpaid"), // paid, unpaid, partial
  fine: numeric("fine", { precision: 10, scale: 2 }).notNull().default("0"),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  tuitionFee: numeric("tuition_fee", { precision: 10, scale: 2 }).default("0"),
  examFee: numeric("exam_fee", { precision: 10, scale: 2 }).default("0"),
  annualFee: numeric("annual_fee", { precision: 10, scale: 2 }).default("0"),
  transportFee: numeric("transport_fee", { precision: 10, scale: 2 }).default("0"),
  arrears: numeric("arrears", { precision: 10, scale: 2 }).default("0"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFeeSchema = createInsertSchema(feesTable).omit({ id: true, createdAt: true });
export type InsertFee = z.infer<typeof insertFeeSchema>;
export type Fee = typeof feesTable.$inferSelect;
