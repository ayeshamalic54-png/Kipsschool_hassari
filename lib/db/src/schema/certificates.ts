import { pgTable, serial, integer, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const certificatesTable = pgTable("certificates", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id").notNull(),
  type: varchar("type", { length: 50 }).notNull(), // leaving, birth, bonafide, character, result, fee_clearance
  issuedDate: varchar("issued_date", { length: 20 }).notNull(),
  certificateNumber: varchar("certificate_number", { length: 50 }).notNull(),
  remarks: text("remarks"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCertificateSchema = createInsertSchema(certificatesTable).omit({ id: true, createdAt: true });
export type InsertCertificate = z.infer<typeof insertCertificateSchema>;
export type Certificate = typeof certificatesTable.$inferSelect;
