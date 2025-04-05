import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table (keeping the existing one)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Content type definitions
export const contentSources = ["Blog Post", "YouTube Transcript", "Podcast", "Article"] as const;
export type ContentSource = (typeof contentSources)[number];

export const platformTypes = ["Twitter", "LinkedIn", "Instagram", "Email", "Summary", "Calendar"] as const;
export type PlatformType = (typeof platformTypes)[number];

export const toneTypes = ["Professional", "Conversational", "Enthusiastic", "Informative", "Persuasive"] as const;
export type ToneType = (typeof toneTypes)[number];

// Content transformations table
export const transformations = pgTable("transformations", {
  id: serial("id").primaryKey(),
  originalContent: text("original_content").notNull(),
  contentSource: text("content_source").notNull(),
  tone: text("tone").notNull(),
  outputLength: integer("output_length").notNull(),
  useHashtags: boolean("use_hashtags").notNull(),
  useEmojis: boolean("use_emojis").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transformationOutputs = pgTable("transformation_outputs", {
  id: serial("id").primaryKey(),
  transformationId: integer("transformation_id").notNull(),
  platformType: text("platform_type").notNull(),
  content: text("content").notNull(),
  characterCount: integer("character_count"),
});

// Schema for creating a new transformation
export const createTransformationSchema = createInsertSchema(transformations).pick({
  originalContent: true,
  contentSource: true,
  tone: true,
  outputLength: true,
  useHashtags: true,
  useEmojis: true,
});

// Schema for making a transformation request
export const transformationRequestSchema = z.object({
  content: z.string().min(1, "Content is required"),
  contentSource: z.enum(contentSources),
  platforms: z.array(z.enum(platformTypes)).min(1, "At least one platform must be selected"),
  tone: z.enum(toneTypes),
  outputLength: z.number().min(1).max(5),
  useHashtags: z.boolean(),
  useEmojis: z.boolean(),
});

export type TransformationRequest = z.infer<typeof transformationRequestSchema>;

export const transformationResponseSchema = z.object({
  outputs: z.record(
    z.enum(platformTypes),
    z.object({
      content: z.string(),
      characterCount: z.number().optional(),
    })
  ),
});

export type TransformationResponse = z.infer<typeof transformationResponseSchema>;

export type Transformation = typeof transformations.$inferSelect;
export type InsertTransformation = typeof transformations.$inferInsert;

export type TransformationOutput = typeof transformationOutputs.$inferSelect;
export type InsertTransformationOutput = typeof transformationOutputs.$inferInsert;
