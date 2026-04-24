import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Content type definitions (simplified per CEO feedback - merged Blog Post & Article)
export const contentSources = ["Blog Post", "YouTube Transcript", "Podcast"] as const;
export type ContentSource = (typeof contentSources)[number];

export const platformTypes = ["Twitter", "LinkedIn", "Instagram", "Threads", "Email"] as const;
export type PlatformType = (typeof platformTypes)[number];

export const toneTypes = ["Professional", "Conversational", "Enthusiastic", "Informative", "Persuasive"] as const;
export type ToneType = (typeof toneTypes)[number];

// Gemini is the default and primary provider (best value: fast, cheap, quality)
export const aiProviders = ["Gemini", "OpenAI", "Anthropic"] as const;
export type AIProvider = (typeof aiProviders)[number];

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").unique(),
  googleId: text("google_id").unique(),
  linkedinId: text("linkedin_id").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  // Subscription fields
  plan: text("plan").default("free").notNull(), // 'free' or 'pro'
  paddleCustomerId: text("paddle_customer_id"),
  paddleSubscriptionId: text("paddle_subscription_id"),
  subscriptionStatus: text("subscription_status"), // 'active', 'canceled', 'past_due', etc.
  subscriptionEndDate: timestamp("subscription_end_date"),
  // Onboarding
  hasSeenOnboarding: boolean("has_seen_onboarding").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
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
  aiProvider: text("ai_provider").default("Gemini").notNull(),
  status: text("status").default("draft").notNull(), // 'draft' | 'posted'
  postedAt: timestamp("posted_at"),
  postedPlatform: text("posted_platform"), // e.g. "LinkedIn", "Twitter"
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

// Scheduled posts table (extended for pipeline integration)
export const scheduledPosts = pgTable("scheduled_posts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text("content").notNull(),
  platform: text("platform").notNull().default("linkedin"), // linkedin, twitter, etc.
  scheduledAt: timestamp("scheduled_at").notNull(),
  status: text("status").notNull().default("pending"), // pending, posted, failed
  postedAt: timestamp("posted_at"),
  postId: text("post_id"), // ID returned from platform after posting
  postUrl: text("post_url"), // URL to view the post
  errorMessage: text("error_message"),
  // Pipeline integration fields
  source: text("source").default("manual"), // 'manual' or 'pipeline'
  pipelineDraftId: integer("pipeline_draft_id"), // FK to pipeline_drafts (set after table defined)
  mediaId: integer("media_id"), // FK to generated_media (set after table defined)
  mediaUrl: text("media_url"), // Denormalized for easy posting
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ CONTENT PIPELINE ============

// Pipeline frequency types
export const pipelineFrequencies = ["daily", "every_other_day", "weekly", "custom"] as const;
export type PipelineFrequency = (typeof pipelineFrequencies)[number];

// Draft status types
export const draftStatuses = ["pending_review", "approved", "rejected", "scheduled", "posted"] as const;
export type DraftStatus = (typeof draftStatuses)[number];

// Media types
export const mediaTypes = ["image", "video", "carousel_pdf"] as const;
export type MediaType = (typeof mediaTypes)[number];

// Media providers
export const mediaProviders = ["dalle", "runway", "pika", "internal"] as const;
export type MediaProvider = (typeof mediaProviders)[number];

// Content pipelines table - auto-generation settings
export const contentPipelines = pgTable("content_pipelines", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(), // "Daily LinkedIn Tips", "Weekly Tech Insights"
  description: text("description"),

  // Generation settings
  topics: json("topics").$type<string[]>().notNull(), // ["AI", "productivity", "leadership"]
  tone: text("tone").notNull(), // From toneTypes
  platforms: json("platforms").$type<string[]>().notNull(), // ["LinkedIn", "Twitter"]

  // Scheduling
  frequency: text("frequency").notNull(), // 'daily', 'every_other_day', 'weekly', 'custom'
  cronExpression: text("cron_expression"), // For custom: "0 9 * * 1" (Mon 9am)
  timezone: text("timezone").default("UTC"),
  nextRunAt: timestamp("next_run_at"),
  lastRunAt: timestamp("last_run_at"),

  // Settings
  draftsPerRun: integer("drafts_per_run").default(1), // How many drafts to generate per run
  useHashtags: boolean("use_hashtags").default(true),
  useEmojis: boolean("use_emojis").default(true),
  aiProvider: text("ai_provider").default("Gemini"),
  autoGenerateMedia: boolean("auto_generate_media").default(false), // Auto-generate images/videos
  preferredMediaType: text("preferred_media_type"), // 'image', 'video', 'carousel', null for auto

  // State
  status: text("status").default("active"), // 'active', 'paused', 'deleted'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Pipeline drafts table - generated content awaiting review
export const pipelineDrafts = pgTable("pipeline_drafts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  pipelineId: integer("pipeline_id")
    .notNull()
    .references(() => contentPipelines.id, { onDelete: 'cascade' }),

  // Content
  content: text("content").notNull(),
  platform: text("platform").notNull(), // Target platform
  topic: text("topic"), // The topic this was generated for

  // Media suggestions
  suggestedMediaType: text("suggested_media_type"), // 'image', 'video', 'carousel', null
  mediaId: integer("media_id"), // FK to generated_media (optional)

  // Workflow
  status: text("status").default("pending_review").notNull(), // pending_review, approved, rejected, scheduled, posted
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"), // Rejection reason or edit notes

  // After scheduling
  scheduledPostId: integer("scheduled_post_id"), // FK to scheduled_posts

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Generated media table - persistent media storage
export const generatedMedia = pgTable("generated_media", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),

  // Media info
  type: text("type").notNull(), // 'image', 'video', 'carousel_pdf'
  provider: text("provider").notNull(), // 'dalle', 'runway', 'pika', 'internal'

  // Storage
  url: text("url").notNull(), // Permanent storage URL (S3/R2)
  thumbnailUrl: text("thumbnail_url"), // For videos
  originalUrl: text("original_url"), // Original provider URL (may expire)

  // Metadata
  prompt: text("prompt"), // Original prompt
  revisedPrompt: text("revised_prompt"), // DALL-E revised prompt
  style: text("style"), // 'professional', 'creative', 'minimal'
  dimensions: json("dimensions").$type<{ width: number; height: number }>(),
  duration: integer("duration"), // For videos (seconds)
  fileSize: integer("file_size"), // In bytes
  mimeType: text("mime_type"),

  // Associations (optional)
  pipelineId: integer("pipeline_id").references(() => contentPipelines.id, { onDelete: 'set null' }),

  // State
  status: text("status").default("ready"), // 'processing', 'ready', 'failed'
  jobId: text("job_id"), // External job ID for async generation (videos)
  errorMessage: text("error_message"),
  expiresAt: timestamp("expires_at"), // For cleanup if needed
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============ ANALYTICS ============

// Hook selection analytics - track which hooks users choose
export const hookAnalytics = pgTable("hook_analytics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: 'set null' }),
  sessionId: text("session_id"), // For anonymous tracking

  // Hook info
  hookType: text("hook_type").notNull(), // 'bold_take', 'results_story', 'pain_point'
  hookIndex: integer("hook_index").notNull(), // 0, 1, or 2
  hookContent: text("hook_content"), // The actual hook text selected

  // Context
  platform: text("platform").default("LinkedIn"),
  contentLength: integer("content_length"), // Original content word count

  // Actions taken
  wasCopied: boolean("was_copied").default(false),
  wasPosted: boolean("was_posted").default(false),

  // Feedback (1 = thumbs up, -1 = thumbs down, null = no feedback)
  feedback: integer("feedback"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define relations after all tables are defined
export const usersRelations = relations(users, ({ many }) => ({
  hookAnalytics: many(hookAnalytics),
  transformations: many(transformations),
  socialConnections: many(socialConnections),
  scheduledPosts: many(scheduledPosts),
  contentPipelines: many(contentPipelines),
  pipelineDrafts: many(pipelineDrafts),
  generatedMedia: many(generatedMedia),
}));

export const scheduledPostsRelations = relations(scheduledPosts, ({ one }) => ({
  user: one(users, {
    fields: [scheduledPosts.userId],
    references: [users.id],
  }),
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

export const contentPipelinesRelations = relations(contentPipelines, ({ one, many }) => ({
  user: one(users, {
    fields: [contentPipelines.userId],
    references: [users.id],
  }),
  drafts: many(pipelineDrafts),
  media: many(generatedMedia),
}));

export const pipelineDraftsRelations = relations(pipelineDrafts, ({ one }) => ({
  user: one(users, {
    fields: [pipelineDrafts.userId],
    references: [users.id],
  }),
  pipeline: one(contentPipelines, {
    fields: [pipelineDrafts.pipelineId],
    references: [contentPipelines.id],
  }),
  media: one(generatedMedia, {
    fields: [pipelineDrafts.mediaId],
    references: [generatedMedia.id],
  }),
  scheduledPost: one(scheduledPosts, {
    fields: [pipelineDrafts.scheduledPostId],
    references: [scheduledPosts.id],
  }),
}));

export const generatedMediaRelations = relations(generatedMedia, ({ one }) => ({
  user: one(users, {
    fields: [generatedMedia.userId],
    references: [users.id],
  }),
  pipeline: one(contentPipelines, {
    fields: [generatedMedia.pipelineId],
    references: [contentPipelines.id],
  }),
}));

// Schema for user creation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
}).extend({
  email: z.string().email().optional(),
  googleId: z.string().optional(),
  linkedinId: z.string().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
  plan: z.string().optional(),
  paddleCustomerId: z.string().optional(),
  paddleSubscriptionId: z.string().optional(),
  subscriptionStatus: z.string().optional(),
  subscriptionEndDate: z.date().optional(),
  hasSeenOnboarding: z.boolean().optional(),
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
  aiProvider: z.enum(aiProviders).default("Gemini"),
});

// LinkedIn-specific output with hook variations
export const linkedInOutputSchema = z.object({
  content: z.string(),
  characterCount: z.number().optional(),
  hooks: z.array(z.string()).optional(), // 3 hook variations
  body: z.string().optional(), // Post body without hook
  cta: z.string().optional(), // Call to action
  selectedHook: z.number().optional(), // Which hook is currently selected (0, 1, or 2)
});

export const platformOutputSchema = z.object({
  content: z.string(),
  characterCount: z.number().optional(),
  // LinkedIn-specific fields (optional for other platforms)
  hooks: z.array(z.string()).optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  selectedHook: z.number().optional(),
});

export const transformationResponseSchema = z.object({
  outputs: z.record(
    z.enum(platformTypes),
    platformOutputSchema
  ),
});

// Export types
export type TransformationRequest = z.infer<typeof transformationRequestSchema>;
export type TransformationResponse = z.infer<typeof transformationResponseSchema>;
export type PlatformOutput = z.infer<typeof platformOutputSchema>;
export type LinkedInOutput = z.infer<typeof linkedInOutputSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Transformation = typeof transformations.$inferSelect;
export type InsertTransformation = typeof transformations.$inferInsert;

export type TransformationOutput = typeof transformationOutputs.$inferSelect;
export type InsertTransformationOutput = typeof transformationOutputs.$inferInsert;

export type SocialConnection = typeof socialConnections.$inferSelect;
export type InsertSocialConnection = typeof socialConnections.$inferInsert;

export type ScheduledPost = typeof scheduledPosts.$inferSelect;
export type InsertScheduledPost = typeof scheduledPosts.$inferInsert;

export type ContentPipeline = typeof contentPipelines.$inferSelect;
export type InsertContentPipeline = typeof contentPipelines.$inferInsert;

export type PipelineDraft = typeof pipelineDrafts.$inferSelect;
export type InsertPipelineDraft = typeof pipelineDrafts.$inferInsert;

export type GeneratedMedia = typeof generatedMedia.$inferSelect;
export type InsertGeneratedMedia = typeof generatedMedia.$inferInsert;

// Zod schemas for pipeline management
export const createPipelineSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  topics: z.array(z.string()).min(1, "At least one topic is required"),
  tone: z.enum(toneTypes),
  platforms: z.array(z.enum(platformTypes)).min(1, "At least one platform is required"),
  frequency: z.enum(pipelineFrequencies),
  cronExpression: z.string().optional(),
  timezone: z.string().default("UTC"),
  draftsPerRun: z.number().min(1).max(5).default(1),
  useHashtags: z.boolean().default(true),
  useEmojis: z.boolean().default(true),
  aiProvider: z.enum(aiProviders).default("Gemini"),
  autoGenerateMedia: z.boolean().default(false),
  preferredMediaType: z.enum(mediaTypes).nullable().optional(),
});

export const updatePipelineSchema = createPipelineSchema.partial().extend({
  status: z.enum(["active", "paused"]).optional(),
});

export const approveDraftSchema = z.object({
  scheduledAt: z.string().datetime().optional(), // ISO string, if provided will also schedule
});

export const rejectDraftSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const updateDraftSchema = z.object({
  content: z.string().min(1),
});

export const generateMediaSchema = z.object({
  content: z.string().min(1),
  type: z.enum(mediaTypes),
  style: z.enum(["professional", "creative", "minimal"]).default("professional"),
  platform: z.enum(platformTypes).optional(),
});

export type CreatePipelineInput = z.infer<typeof createPipelineSchema>;
export type UpdatePipelineInput = z.infer<typeof updatePipelineSchema>;
export type GenerateMediaInput = z.infer<typeof generateMediaSchema>;

// ============ TRENDING CONTENT ============

// Trending content sources
export const trendingSourceTypes = ["hackernews", "reddit", "youtube", "curated"] as const;
export type TrendingSourceType = (typeof trendingSourceTypes)[number];

// Trending content categories
export const trendingCategories = ["tech", "business", "marketing", "ai", "startup", "productivity", "general"] as const;
export type TrendingCategory = (typeof trendingCategories)[number];

// Trending content table - caches external API data
export const trendingContent = pgTable("trending_content", {
  id: serial("id").primaryKey(),

  // Source identification
  source: text("source").notNull(), // hackernews, reddit, youtube, etc.
  externalId: text("external_id").notNull(), // ID from source platform
  externalUrl: text("external_url").notNull(), // Link to original

  // Content data
  title: text("title").notNull(),
  content: text("content"), // Full text if available
  hook: text("hook"), // First line/hook extracted
  author: text("author"),
  authorUrl: text("author_url"),
  thumbnailUrl: text("thumbnail_url"),

  // Engagement metrics
  views: integer("views"),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),
  score: integer("score"), // Platform-specific score (karma, points, etc.)

  // Media
  mediaType: text("media_type").default("text"), // 'text' | 'image' | 'video' | 'carousel'
  videoUrl: text("video_url"),
  duration: integer("duration"), // seconds, for videos

  // Categorization
  category: text("category").default("general"),
  tags: json("tags").$type<string[]>(),

  // AI-extracted insights
  hookAnalysis: text("hook_analysis"), // Why this hook works
  contentPattern: text("content_pattern"), // Pattern type identified

  // Metadata
  publishedAt: timestamp("published_at"),
  fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(), // When to refresh
  isActive: boolean("is_active").default(true),
});

// Curated viral examples — live ingest keyed by (platform, platformPostId) from
// scrapers (YouTube API server-side, open-source browser extension for LinkedIn/IG/TikTok).
// trackedAccountId null → legacy seed (Phase 3 will delete).
export const curatedVirals = pgTable("curated_virals", {
  id: serial("id").primaryKey(),

  // Content
  platform: text("platform").notNull(), // linkedin, twitter, instagram, tiktok, youtube
  authorName: text("author_name").notNull(),
  authorHandle: text("author_handle"),
  authorFollowers: integer("author_followers"),
  content: text("content").notNull(),
  hook: text("hook").notNull(),

  // Media
  mediaType: text("media_type").default("text").notNull(), // 'text' | 'image' | 'video' | 'carousel'
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"), // seconds, for videos

  // Verified metrics
  views: integer("views"),
  likes: integer("likes"),
  comments: integer("comments"),
  shares: integer("shares"),

  // Analysis
  category: text("category").notNull(),
  whyItWorks: text("why_it_works"),
  hookPattern: text("hook_pattern"), // "contrarian", "story", "listicle", etc.

  // Source
  sourceUrl: text("source_url"),
  platformPostId: text("platform_post_id"), // per-platform permalink id; (platform,platformPostId) unique
  screenshotUrl: text("screenshot_url"),
  verifiedAt: timestamp("verified_at"),
  publishedAt: timestamp("published_at"),

  // Ownership / attribution
  addedBy: integer("added_by").references(() => users.id),
  trackedAccountId: integer("tracked_account_id"), // FK added below via relation; nullable for legacy seeds
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true),
});

// Per-user list of competitor handles we ingest posts from.
export const trackedAccounts = pgTable("tracked_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  platform: text("platform").notNull(), // linkedin, instagram, tiktok, youtube, twitter
  handle: text("handle").notNull(), // e.g. "justinwelsh", or YouTube channel id "UC..."
  displayName: text("display_name"),
  profileUrl: text("profile_url"),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastPostCount: integer("last_post_count").default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Per-user niche/topic preferences that feed the ranking and keyword queries.
export const userContentPreferences = pgTable("user_content_preferences", {
  userId: integer("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  niche: text("niche"),
  targetAudience: text("target_audience"),
  contentGoal: text("content_goal"), // hooks | storytelling | short-form-video | carousels
  topics: json("topics").$type<string[]>().default([]),
  languages: json("languages").$type<string[]>().default(["en"]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type TrendingContent = typeof trendingContent.$inferSelect;
export type InsertTrendingContent = typeof trendingContent.$inferInsert;
export type CuratedViral = typeof curatedVirals.$inferSelect;
export type InsertCuratedViral = typeof curatedVirals.$inferInsert;
export type TrackedAccount = typeof trackedAccounts.$inferSelect;
export type InsertTrackedAccount = typeof trackedAccounts.$inferInsert;
export type UserContentPreferences = typeof userContentPreferences.$inferSelect;
export type InsertUserContentPreferences = typeof userContentPreferences.$inferInsert;
