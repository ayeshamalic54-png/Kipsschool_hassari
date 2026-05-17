import { pgTable, serial, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  studentId: integer("student_id"),
  staffId: integer("staff_id"),
  date: varchar("date", { length: 20 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(), // student, staff
  status: varchar("status", { length: 20 }).notNull(), // present, absent, late, leave
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAttendanceSchema = createInsertSchema(attendanceTable).omit({ id: true, createdAt: true });
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Attendance = typeof attendanceTable.$inferSelect;
