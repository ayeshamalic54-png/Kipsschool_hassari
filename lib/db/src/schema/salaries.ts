import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const salariesTable = pgTable("salaries", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  month: varchar("month", { length: 20 }).notNull(), // YYYY-MM
  paidDate: varchar("paid_date", { length: 20 }),
  status: varchar("status", { length: 20 }).notNull().default("unpaid"), // paid, unpaid
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSalarySchema = createInsertSchema(salariesTable).omit({ id: true, createdAt: true });
export type InsertSalary = z.infer<typeof insertSalarySchema>;
export type Salary = typeof salariesTable.$inferSelect;
