import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Content type definitions
export const contentSources = ["Blog Post", "YouTube Transcript", "Podcast", "Article"] as const;
export type ContentSource = (typeof contentSources)[number];

export const platformTypes = ["Twitter", "LinkedIn", "Instagram", "Email", "Summary", "Calendar"] as const;
export type PlatformType = (typeof platformTypes)[number];

export const toneTypes = ["Professional", "Conversational", "Enthusiastic", "Informative", "Persuasive"] as const;
export type ToneType = (typeof toneTypes)[number];

export const aiProviders = ["OpenAI", "Anthropic"] as const;
export type AIProvider = (typeof aiProviders)[number];

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

// Content transformations table
export const transformations = pgTable("transformations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  originalContent: text("original_content").notNull(),
  contentSource: text("content_source").notNull(),
  tone: text("tone").notNull(),
  outputLength: integer("output_length").notNull(),
  useHashtags: boolean("use_hashtags").notNull(),
  useEmojis: boolean("use_emojis").notNull(),
  aiProvider: text("ai_provider").default("OpenAI").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Transformation outputs table
export const transformationOutputs = pgTable("transformation_outputs", {
  id: serial("id").primaryKey(),
  transformationId: integer("transformation_id")
    .notNull()
    .references(() => transformations.id, { onDelete: 'cascade' }),
  platformType: text("platform_type").notNull(),
  content: text("content").notNull(),
  characterCount: integer("character_count"),
});

// Social connections table
export const socialConnections = pgTable("social_connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text("provider").notNull(), // "linkedin", "twitter", etc.
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  profileData: json("profile_data"), // JSON data including name, profile picture, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Define relations after all tables are defined
export const usersRelations = relations(users, ({ many }) => ({
  transformations: many(transformations),
  socialConnections: many(socialConnections),
}));

export const transformationsRelations = relations(transformations, ({ one, many }) => ({
  user: one(users, {
    fields: [transformations.userId],
    references: [users.id],
  }),
  outputs: many(transformationOutputs),
}));

export const transformationOutputsRelations = relations(transformationOutputs, ({ one }) => ({
  transformation: one(transformations, {
    fields: [transformationOutputs.transformationId],
    references: [transformations.id],
  }),
}));

export const socialConnectionsRelations = relations(socialConnections, ({ one }) => ({
  user: one(users, {
    fields: [socialConnections.userId],
    references: [users.id],
  }),
}));

// Schema for user creation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Schema for creating a new transformation
export const createTransformationSchema = createInsertSchema(transformations).pick({
  originalContent: true,
  contentSource: true,
  tone: true,
  outputLength: true,
  useHashtags: true,
  useEmojis: true,
  aiProvider: true,
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
  aiProvider: z.enum(aiProviders).default("OpenAI"),
});

export const transformationResponseSchema = z.object({
  outputs: z.record(
    z.enum(platformTypes),
    z.object({
      content: z.string(),
      characterCount: z.number().optional(),
    })
  ),
});

// Export types
export type TransformationRequest = z.infer<typeof transformationRequestSchema>;
export type TransformationResponse = z.infer<typeof transformationResponseSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Transformation = typeof transformations.$inferSelect;
export type InsertTransformation = typeof transformations.$inferInsert;

export type TransformationOutput = typeof transformationOutputs.$inferSelect;
export type InsertTransformationOutput = typeof transformationOutputs.$inferInsert;

export type SocialConnection = typeof socialConnections.$inferSelect;
export type InsertSocialConnection = typeof socialConnections.$inferInsert;
