import { pgTable, serial, text, integer, timestamp, varchar, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const studentsTable = pgTable("students", {
  id: serial("id").primaryKey(),
  admissionNumber: varchar("admission_number", { length: 50 }).notNull().unique(),
  name: text("name").notNull(),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  dateOfBirth: varchar("date_of_birth", { length: 20 }),
  gender: varchar("gender", { length: 10 }),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  emergencyContact: varchar("emergency_contact", { length: 20 }),
  classId: integer("class_id").notNull(),
  section: varchar("section", { length: 10 }),
  rollNumber: varchar("roll_number", { length: 20 }),
  feeAmount: numeric("fee_amount", { precision: 10, scale: 2 }),
  status: varchar("status", { length: 20 }).notNull().default("active"), // active, inactive, left
  imageUrl: text("image_url"),
  username: varchar("username", { length: 100 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type Student = typeof studentsTable.$inferSelect;
