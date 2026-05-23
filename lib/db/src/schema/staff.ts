import { pgTable, serial, text, varchar, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const staffTable = pgTable("staff", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull(),
  role:      varchar("role", { length: 30 }).notNull(),
  phone:     varchar("phone", { length: 20 }),
  email:     varchar("email", { length: 200 }),
  address:   text("address"),
  subject:   varchar("subject", { length: 100 }),
  salary:    numeric("salary", { precision: 10, scale: 2 }),
  joinDate:  varchar("join_date", { length: 20 }),
  status:    varchar("status", { length: 20 }).notNull().default("active"),
  username:  varchar("username", { length: 100 }),
  imageUrl:  text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStaffSchema = createInsertSchema(staffTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStaff = z.infer<typeof insertStaffSchema>;
export type Staff = typeof staffTable.$inferSelect;
