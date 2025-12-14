import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export interface InventoryItem {
  id: string;
  itemName: string;
  itemDescription: string;
  itemCategory: string;
  itemLocation: string;
  currentStock: number;
  itemUnit: string;
  itemStatus: "In Stock" | "Low Stock" | "Out of Stock";
}

export interface CalendarEvent {
  id: string;
  eventName: string;
  date: string;
  time: string;
  location: string;
  notes: string;
  priority?: "High" | "Medium" | "Low";
}

export interface CalendarTask {
  id: string;
  taskName: string;
  dateTime: string;
  deadlineDateTime: string;
  description: string;
  status: "Upcoming" | "Overdue" | "Complete";
}

export interface Contact {
  id: string;
  name: string;
  agency: string;
  designation: string;
  phoneNumber: string;
  email: string;
  address?: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  createdTime?: string;
  modifiedTime?: string;
  size?: string;
  parents?: string[];
}

export interface DriveFolder {
  id: string;
  name: string;
  files?: DriveFile[];
  subfolders?: DriveFolder[];
}

export interface GalleryImage {
  id: string;
  name: string;
  thumbnailLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  description?: string;
  createdTime?: string;
  folder?: string;
}

export interface HazardZone {
  id: string;
  name: string;
  type: "flood" | "landslide" | "storm-surge" | "earthquake";
  riskLevel: "High" | "Medium" | "Low";
  coordinates: { lat: number; lng: number }[];
  description?: string;
  affectedBarangays?: string[];
  lastAssessment?: string;
}

export interface MapAsset {
  id: string;
  name: string;
  type: "evacuation-center" | "equipment" | "medical" | "rescue-vehicle" | "command-post";
  status: "available" | "low" | "deployed" | "unavailable";
  position: { lat: number; lng: number };
  description?: string;
  capacity?: number;
}

export interface MapLayer {
  id: string;
  name: string;
  type: "interactive" | "administrative" | "topographic" | "land-use" | "hazards" | "other" | "panorama" | "google-open";
  active: boolean;
  opacity?: number;
  folderId?: string;
  expanded?: boolean;
}

export interface GoogleOpenMap {
  id: string;
  name: string;
  iframeSrc: string;
}

export interface MapFileItem {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
}

export interface InventoryStats {
  totalItems: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export interface ContactStats {
  totalContacts: number;
  agencies: number;
  phoneNumbers: number;
  emailAddresses: number;
}

export interface DashboardModule {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  route: string;
}

export interface MapFrame {
  id: string;
  name: string;
  description: string;
  type: "marker" | "layer" | "polygon";
  coordinates: string;
  color: string;
  active: boolean;
}

export const insertInventorySchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  itemDescription: z.string().optional().default(""),
  itemCategory: z.string().min(1, "Category is required"),
  itemLocation: z.string().min(1, "Location is required"),
  currentStock: z.number().min(0, "Stock must be 0 or greater"),
  itemUnit: z.string().min(1, "Unit is required"),
  itemStatus: z.enum(["In Stock", "Low Stock", "Out of Stock"]),
});

export type InsertInventoryItem = z.infer<typeof insertInventorySchema>;

export const insertEventSchema = z.object({
  eventName: z.string().min(1, "Event name is required"),
  date: z.string().min(1, "Date is required"),
  time: z.string().min(1, "Time is required"),
  location: z.string().min(1, "Location is required"),
  notes: z.string().optional().default(""),
  priority: z.enum(["High", "Medium", "Low"]).optional().default("Medium"),
});

export type InsertCalendarEvent = z.infer<typeof insertEventSchema>;

export const insertTaskSchema = z.object({
  taskName: z.string().min(1, "Task name is required"),
  dateTime: z.string().min(1, "Start date/time is required"),
  deadlineDateTime: z.string().min(1, "Deadline is required"),
  description: z.string().optional().default(""),
  status: z.enum(["Upcoming", "Overdue", "Complete"]).optional().default("Upcoming"),
});

export type InsertCalendarTask = z.infer<typeof insertTaskSchema>;

export const insertContactSchema = z.object({
  name: z.string().min(1, "Name is required"),
  agency: z.string().min(1, "Agency is required"),
  designation: z.string().min(1, "Designation is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email("Valid email is required"),
  address: z.string().optional().default(""),
});

export type InsertContact = z.infer<typeof insertContactSchema>;

export const insertMapFrameSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().default(""),
  type: z.enum(["marker", "layer", "polygon"]),
  coordinates: z.string().min(1, "Coordinates are required"),
  color: z.string().min(1, "Color is required"),
  active: z.boolean().optional().default(true),
});

export type InsertMapFrame = z.infer<typeof insertMapFrameSchema>;