import { pgTable, serial, integer, numeric, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  classId: integer("class_id").notNull(),
  subject: varchar("subject", { length: 100 }).notNull(),
  examDate: varchar("exam_date", { length: 20 }).notNull(),
  totalMarks: numeric("total_marks", { precision: 6, scale: 2 }).notNull(),
  passingMarks: numeric("passing_marks", { precision: 6, scale: 2 }).notNull().default("40"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const examResultsTable = pgTable("exam_results", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  studentId: integer("student_id").notNull(),
  marksObtained: numeric("marks_obtained", { precision: 6, scale: 2 }).notNull(),
  grade: varchar("grade", { length: 5 }).notNull().default("F"),
  position: integer("position"),
  remarks: varchar("remarks", { length: 500 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExamSchema = createInsertSchema(examsTable).omit({ id: true, createdAt: true });
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof examsTable.$inferSelect;

export const insertExamResultSchema = createInsertSchema(examResultsTable).omit({ id: true, createdAt: true });
export type InsertExamResult = z.infer<typeof insertExamResultSchema>;
export type ExamResult = typeof examResultsTable.$inferSelect;
