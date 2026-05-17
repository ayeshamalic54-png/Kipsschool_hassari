import { pgTable, serial, numeric, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const accountEntriesTable = pgTable("account_entries", {
  id: serial("id").primaryKey(),
  type: varchar("type", { length: 20 }).notNull(), // income, expense
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  category: varchar("category", { length: 100 }).notNull(),
  description: text("description").notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAccountEntrySchema = createInsertSchema(accountEntriesTable).omit({ id: true, createdAt: true });
export type InsertAccountEntry = z.infer<typeof insertAccountEntrySchema>;
export type AccountEntry = typeof accountEntriesTable.$inferSelect;
