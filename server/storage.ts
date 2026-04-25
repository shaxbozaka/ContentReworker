import {
  users, type User, type InsertUser,
  transformations, type Transformation, type InsertTransformation,
  transformationOutputs, type TransformationOutput, type InsertTransformationOutput,
  socialConnections, type SocialConnection, type InsertSocialConnection,
  scheduledPosts, type ScheduledPost, type InsertScheduledPost,
  contentPipelines, type ContentPipeline, type InsertContentPipeline,
  pipelineDrafts, type PipelineDraft, type InsertPipelineDraft,
  generatedMedia, type GeneratedMedia, type InsertGeneratedMedia,
  hookAnalytics,
  type DraftStatus
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, count, sql, or, lte, gte, isNull } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByLinkedInId(linkedinId: string): Promise<User | undefined>;
  getUserByPaddleSubscriptionId(subscriptionId: string): Promise<User | undefined>;
  getUserByPaddleCustomerId(customerId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<InsertUser>): Promise<User>;
  createAnonymousUser(): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Transformation methods
  createTransformation(data: InsertTransformation): Promise<Transformation>;
  getTransformation(id: number): Promise<Transformation | undefined>;
  getRecentTransformations(limit: number): Promise<Transformation[]>;
  updateTransformationStatus(id: number, userId: number, status: string, platform?: string): Promise<Transformation | undefined>;
  
  // Transformation output methods
  createTransformationOutput(data: InsertTransformationOutput): Promise<TransformationOutput>;
  getTransformationOutputs(transformationId: number): Promise<TransformationOutput[]>;
  
  // Social connection methods
  createSocialConnection(data: InsertSocialConnection): Promise<SocialConnection>;
  getSocialConnection(id: number): Promise<SocialConnection | undefined>;
  getSocialConnectionByUserAndProvider(userId: number, provider: string): Promise<SocialConnection | undefined>;
  updateSocialConnection(id: number, data: Partial<InsertSocialConnection>): Promise<SocialConnection>;
  deleteSocialConnection(id: number): Promise<void>;
  getUserSocialConnections(userId: number): Promise<SocialConnection[]>;

  // Scheduled posts methods
  createScheduledPost(data: InsertScheduledPost): Promise<ScheduledPost>;
  getScheduledPost(id: number): Promise<ScheduledPost | undefined>;
  getUserScheduledPosts(userId: number): Promise<ScheduledPost[]>;
  getPendingScheduledPosts(): Promise<ScheduledPost[]>;
  updateScheduledPost(id: number, data: Partial<InsertScheduledPost>): Promise<ScheduledPost>;
  deleteScheduledPost(id: number, userId: number): Promise<boolean>;

  // Content pipeline methods
  createPipeline(data: InsertContentPipeline): Promise<ContentPipeline>;
  getPipeline(id: number): Promise<ContentPipeline | undefined>;
  getUserPipelines(userId: number): Promise<ContentPipeline[]>;
  getActivePipelines(): Promise<ContentPipeline[]>;
  getDuePipelines(): Promise<ContentPipeline[]>;
  updatePipeline(id: number, data: Partial<InsertContentPipeline>): Promise<ContentPipeline>;
  deletePipeline(id: number, userId: number): Promise<boolean>;

  // Pipeline draft methods
  createDraft(data: InsertPipelineDraft): Promise<PipelineDraft>;
  getDraft(id: number): Promise<PipelineDraft | undefined>;
  getUserDrafts(userId: number, status?: DraftStatus): Promise<PipelineDraft[]>;
  getPipelineDrafts(pipelineId: number): Promise<PipelineDraft[]>;
  getPendingReviewDrafts(userId: number): Promise<PipelineDraft[]>;
  getDraftStats(userId: number): Promise<{ pending: number; approved: number; rejected: number; scheduled: number; posted: number }>;
  updateDraft(id: number, data: Partial<InsertPipelineDraft>): Promise<PipelineDraft>;
  deleteDraft(id: number, userId: number): Promise<boolean>;

  // Generated media methods
  createMedia(data: InsertGeneratedMedia): Promise<GeneratedMedia>;
  getMedia(id: number): Promise<GeneratedMedia | undefined>;
  getUserMedia(userId: number, type?: string): Promise<GeneratedMedia[]>;
  getMediaByJobId(jobId: string): Promise<GeneratedMedia | undefined>;
  updateMedia(id: number, data: Partial<InsertGeneratedMedia>): Promise<GeneratedMedia>;
  deleteMedia(id: number, userId: number): Promise<boolean>;

  // Analytics methods
  trackHookSelection(data: {
    userId: number | null;
    sessionId: string;
    hookType: string;
    hookIndex: number;
    hookContent?: string;
    platform?: string;
    contentLength?: number;
    wasCopied?: boolean;
    wasPosted?: boolean;
    feedback?: number; // 1 = good, -1 = bad
  }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async getUserByLinkedInId(linkedinId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.linkedinId, linkedinId));
    return user;
  }

  async getUserByPaddleSubscriptionId(subscriptionId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.paddleSubscriptionId, subscriptionId));
    return user;
  }

  async getUserByPaddleCustomerId(customerId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.paddleCustomerId, customerId));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, data: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
  }

  async createAnonymousUser(): Promise<User> {
    // Create anonymous user with random username and placeholder password
    const randomId = Math.random().toString(36).substring(2, 15);
    const [user] = await db.insert(users).values({
      username: `anon_${randomId}`,
      password: 'anonymous' // Not used for auth, just placeholder
    }).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  // Transformation methods
  async createTransformation(data: InsertTransformation): Promise<Transformation> {
    const [transformation] = await db
      .insert(transformations)
      .values(data)
      .returning();
    
    return transformation;
  }
  
  async getTransformation(id: number): Promise<Transformation | undefined> {
    const [transformation] = await db
      .select()
      .from(transformations)
      .where(eq(transformations.id, id));
    
    return transformation;
  }
  
  async getRecentTransformations(limit: number): Promise<Transformation[]> {
    return await db
      .select()
      .from(transformations)
      .orderBy(desc(transformations.createdAt))
      .limit(limit);
  }

  async updateTransformationStatus(id: number, userId: number, status: string, platform?: string): Promise<Transformation | undefined> {
    // Verify ownership
    const [existing] = await db
      .select()
      .from(transformations)
      .where(and(eq(transformations.id, id), eq(transformations.userId, userId)));

    if (!existing) return undefined;

    const updateData: Partial<InsertTransformation> & { status: string; postedAt?: Date; postedPlatform?: string } = { status };
    if (status === 'posted') {
      updateData.postedAt = new Date();
      if (platform) updateData.postedPlatform = platform;
    }

    const [updated] = await db
      .update(transformations)
      .set(updateData)
      .where(eq(transformations.id, id))
      .returning();

    return updated;
  }

  async getTodayTransformationCount(userId: number | null, sessionId?: string): Promise<number> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // For logged-in users, count by userId
    // For anonymous users, count by sessionId (less reliable but better than nothing)
    if (userId) {
      const [result] = await db
        .select({ count: count() })
        .from(transformations)
        .where(
          and(
            eq(transformations.userId, userId),
            gte(transformations.createdAt, startOfDay)
          )
        );
      return result?.count || 0;
    }

    // Anonymous users get a more generous limit since we can't track reliably
    return 0;
  }

  // Transformation output methods
  async createTransformationOutput(data: InsertTransformationOutput): Promise<TransformationOutput> {
    const [output] = await db
      .insert(transformationOutputs)
      .values(data)
      .returning();
    
    return output;
  }
  
  async getTransformationOutputs(transformationId: number): Promise<TransformationOutput[]> {
    return await db
      .select()
      .from(transformationOutputs)
      .where(eq(transformationOutputs.transformationId, transformationId));
  }
  
  // Social connection methods
  async createSocialConnection(data: InsertSocialConnection): Promise<SocialConnection> {
    const [connection] = await db
      .insert(socialConnections)
      .values(data)
      .returning();
    
    return connection;
  }

  async getSocialConnection(id: number): Promise<SocialConnection | undefined> {
    const [connection] = await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.id, id));
    
    return connection;
  }

  async getSocialConnectionByUserAndProvider(userId: number, provider: string): Promise<SocialConnection | undefined> {
    // Query with two separate conditions
    const connections = await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.userId, userId));
    
    // Filter for the matching provider
    const connection = connections.find(conn => conn.provider === provider);
    
    return connection;
  }

  async updateSocialConnection(id: number, data: Partial<InsertSocialConnection>): Promise<SocialConnection> {
    const [connection] = await db
      .update(socialConnections)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(socialConnections.id, id))
      .returning();
    
    return connection;
  }

  async deleteSocialConnection(id: number): Promise<void> {
    await db
      .delete(socialConnections)
      .where(eq(socialConnections.id, id));
  }

  async getUserSocialConnections(userId: number): Promise<SocialConnection[]> {
    return await db
      .select()
      .from(socialConnections)
      .where(eq(socialConnections.userId, userId));
  }

  // User transformation history methods
  async getUserTransformations(userId: number, options: { limit: number; offset: number; status?: string }): Promise<any[]> {
    // Get transformations with their outputs
    const conditions = [eq(transformations.userId, userId)];
    if (options.status) {
      conditions.push(eq(transformations.status, options.status));
    }

    const results = await db
      .select()
      .from(transformations)
      .where(and(...conditions))
      .orderBy(desc(transformations.createdAt))
      .limit(options.limit)
      .offset(options.offset);

    // For each transformation, get its outputs
    const withOutputs = await Promise.all(
      results.map(async (t) => {
        const outputs = await db
          .select()
          .from(transformationOutputs)
          .where(eq(transformationOutputs.transformationId, t.id));
        return {
          ...t,
          outputs: outputs.reduce((acc, o) => {
            acc[o.platformType] = { content: o.content, characterCount: o.characterCount };
            return acc;
          }, {} as Record<string, { content: string; characterCount: number | null }>)
        };
      })
    );

    return withOutputs;
  }

  async getUserTransformationCount(userId: number, status?: string): Promise<number> {
    const conditions = [eq(transformations.userId, userId)];
    if (status) {
      conditions.push(eq(transformations.status, status));
    }

    const result = await db
      .select({ count: count() })
      .from(transformations)
      .where(and(...conditions));
    return result[0]?.count || 0;
  }

  async deleteUserTransformation(transformationId: number, userId: number): Promise<boolean> {
    // First verify ownership
    const [existing] = await db
      .select()
      .from(transformations)
      .where(and(eq(transformations.id, transformationId), eq(transformations.userId, userId)));

    if (!existing) {
      return false;
    }

    // Delete (cascade will handle outputs)
    await db.delete(transformations).where(eq(transformations.id, transformationId));
    return true;
  }

  // Scheduled posts methods
  async createScheduledPost(data: InsertScheduledPost): Promise<ScheduledPost> {
    const [post] = await db
      .insert(scheduledPosts)
      .values(data)
      .returning();
    return post;
  }

  async getScheduledPost(id: number): Promise<ScheduledPost | undefined> {
    const [post] = await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.id, id));
    return post;
  }

  async getUserScheduledPosts(userId: number): Promise<ScheduledPost[]> {
    return await db
      .select()
      .from(scheduledPosts)
      .where(eq(scheduledPosts.userId, userId))
      .orderBy(desc(scheduledPosts.scheduledAt));
  }

  async getPendingScheduledPosts(): Promise<ScheduledPost[]> {
    // Get posts that are pending and scheduled for now or earlier
    return await db
      .select()
      .from(scheduledPosts)
      .where(
        and(
          eq(scheduledPosts.status, 'pending'),
          sql`${scheduledPosts.scheduledAt} <= NOW()`
        )
      )
      .orderBy(scheduledPosts.scheduledAt);
  }

  async updateScheduledPost(id: number, data: Partial<InsertScheduledPost>): Promise<ScheduledPost> {
    const [post] = await db
      .update(scheduledPosts)
      .set(data)
      .where(eq(scheduledPosts.id, id))
      .returning();
    return post;
  }

  async deleteScheduledPost(id: number, userId: number): Promise<boolean> {
    // Verify ownership before deleting
    const [existing] = await db
      .select()
      .from(scheduledPosts)
      .where(and(eq(scheduledPosts.id, id), eq(scheduledPosts.userId, userId)));

    if (!existing) {
      return false;
    }

    await db.delete(scheduledPosts).where(eq(scheduledPosts.id, id));
    return true;
  }

  // ============ CONTENT PIPELINE METHODS ============

  async createPipeline(data: InsertContentPipeline): Promise<ContentPipeline> {
    const [pipeline] = await db
      .insert(contentPipelines)
      .values(data)
      .returning();
    return pipeline;
  }

  async getPipeline(id: number): Promise<ContentPipeline | undefined> {
    const [pipeline] = await db
      .select()
      .from(contentPipelines)
      .where(eq(contentPipelines.id, id));
    return pipeline;
  }

  async getUserPipelines(userId: number): Promise<ContentPipeline[]> {
    return await db
      .select()
      .from(contentPipelines)
      .where(and(
        eq(contentPipelines.userId, userId),
        or(eq(contentPipelines.status, 'active'), eq(contentPipelines.status, 'paused'))
      ))
      .orderBy(desc(contentPipelines.createdAt));
  }

  async getActivePipelines(): Promise<ContentPipeline[]> {
    return await db
      .select()
      .from(contentPipelines)
      .where(eq(contentPipelines.status, 'active'));
  }

  async getDuePipelines(): Promise<ContentPipeline[]> {
    // Get pipelines that are active and due for generation
    return await db
      .select()
      .from(contentPipelines)
      .where(
        and(
          eq(contentPipelines.status, 'active'),
          or(
            isNull(contentPipelines.nextRunAt),
            lte(contentPipelines.nextRunAt, new Date())
          )
        )
      );
  }

  async updatePipeline(id: number, data: Partial<InsertContentPipeline>): Promise<ContentPipeline> {
    const [pipeline] = await db
      .update(contentPipelines)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(contentPipelines.id, id))
      .returning();
    return pipeline;
  }

  async deletePipeline(id: number, userId: number): Promise<boolean> {
    // Soft delete - set status to 'deleted'
    const [existing] = await db
      .select()
      .from(contentPipelines)
      .where(and(eq(contentPipelines.id, id), eq(contentPipelines.userId, userId)));

    if (!existing) {
      return false;
    }

    await db
      .update(contentPipelines)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(contentPipelines.id, id));
    return true;
  }

  // ============ PIPELINE DRAFT METHODS ============

  async createDraft(data: InsertPipelineDraft): Promise<PipelineDraft> {
    const [draft] = await db
      .insert(pipelineDrafts)
      .values(data)
      .returning();
    return draft;
  }

  async getDraft(id: number): Promise<PipelineDraft | undefined> {
    const [draft] = await db
      .select()
      .from(pipelineDrafts)
      .where(eq(pipelineDrafts.id, id));
    return draft;
  }

  async getUserDrafts(userId: number, status?: DraftStatus): Promise<PipelineDraft[]> {
    if (status) {
      return await db
        .select()
        .from(pipelineDrafts)
        .where(and(
          eq(pipelineDrafts.userId, userId),
          eq(pipelineDrafts.status, status)
        ))
        .orderBy(desc(pipelineDrafts.createdAt));
    }
    return await db
      .select()
      .from(pipelineDrafts)
      .where(eq(pipelineDrafts.userId, userId))
      .orderBy(desc(pipelineDrafts.createdAt));
  }

  async getPipelineDrafts(pipelineId: number): Promise<PipelineDraft[]> {
    return await db
      .select()
      .from(pipelineDrafts)
      .where(eq(pipelineDrafts.pipelineId, pipelineId))
      .orderBy(desc(pipelineDrafts.createdAt));
  }

  async getPendingReviewDrafts(userId: number): Promise<PipelineDraft[]> {
    return await db
      .select()
      .from(pipelineDrafts)
      .where(and(
        eq(pipelineDrafts.userId, userId),
        eq(pipelineDrafts.status, 'pending_review')
      ))
      .orderBy(desc(pipelineDrafts.createdAt));
  }

  async getDraftStats(userId: number): Promise<{ pending: number; approved: number; rejected: number; scheduled: number; posted: number }> {
    const drafts = await db
      .select()
      .from(pipelineDrafts)
      .where(eq(pipelineDrafts.userId, userId));

    return {
      pending: drafts.filter(d => d.status === 'pending_review').length,
      approved: drafts.filter(d => d.status === 'approved').length,
      rejected: drafts.filter(d => d.status === 'rejected').length,
      scheduled: drafts.filter(d => d.status === 'scheduled').length,
      posted: drafts.filter(d => d.status === 'posted').length,
    };
  }

  async updateDraft(id: number, data: Partial<InsertPipelineDraft>): Promise<PipelineDraft> {
    const [draft] = await db
      .update(pipelineDrafts)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(pipelineDrafts.id, id))
      .returning();
    return draft;
  }

  async deleteDraft(id: number, userId: number): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(pipelineDrafts)
      .where(and(eq(pipelineDrafts.id, id), eq(pipelineDrafts.userId, userId)));

    if (!existing) {
      return false;
    }

    await db.delete(pipelineDrafts).where(eq(pipelineDrafts.id, id));
    return true;
  }

  // ============ GENERATED MEDIA METHODS ============

  async createMedia(data: InsertGeneratedMedia): Promise<GeneratedMedia> {
    const [media] = await db
      .insert(generatedMedia)
      .values(data)
      .returning();
    return media;
  }

  async getMedia(id: number): Promise<GeneratedMedia | undefined> {
    const [media] = await db
      .select()
      .from(generatedMedia)
      .where(eq(generatedMedia.id, id));
    return media;
  }

  async getUserMedia(userId: number, type?: string): Promise<GeneratedMedia[]> {
    if (type) {
      return await db
        .select()
        .from(generatedMedia)
        .where(and(
          eq(generatedMedia.userId, userId),
          eq(generatedMedia.type, type),
          eq(generatedMedia.status, 'ready')
        ))
        .orderBy(desc(generatedMedia.createdAt));
    }
    return await db
      .select()
      .from(generatedMedia)
      .where(and(
        eq(generatedMedia.userId, userId),
        eq(generatedMedia.status, 'ready')
      ))
      .orderBy(desc(generatedMedia.createdAt));
  }

  async getMediaByJobId(jobId: string): Promise<GeneratedMedia | undefined> {
    const [media] = await db
      .select()
      .from(generatedMedia)
      .where(eq(generatedMedia.jobId, jobId));
    return media;
  }

  async updateMedia(id: number, data: Partial<InsertGeneratedMedia>): Promise<GeneratedMedia> {
    const [media] = await db
      .update(generatedMedia)
      .set(data)
      .where(eq(generatedMedia.id, id))
      .returning();
    return media;
  }

  async deleteMedia(id: number, userId: number): Promise<boolean> {
    const [existing] = await db
      .select()
      .from(generatedMedia)
      .where(and(eq(generatedMedia.id, id), eq(generatedMedia.userId, userId)));

    if (!existing) {
      return false;
    }

    await db.delete(generatedMedia).where(eq(generatedMedia.id, id));
    return true;
  }

  // Analytics methods
  async trackHookSelection(data: {
    userId: number | null;
    sessionId: string;
    hookType: string;
    hookIndex: number;
    hookContent?: string;
    platform?: string;
    contentLength?: number;
    wasCopied?: boolean;
    wasPosted?: boolean;
    feedback?: number; // 1 = good, -1 = bad
  }): Promise<void> {
    await db.insert(hookAnalytics).values({
      userId: data.userId,
      sessionId: data.sessionId,
      hookType: data.hookType,
      hookIndex: data.hookIndex,
      hookContent: data.hookContent,
      platform: data.platform || 'LinkedIn',
      contentLength: data.contentLength,
      wasCopied: data.wasCopied || false,
      wasPosted: data.wasPosted || false,
      feedback: data.feedback,
    });
  }

  // Returns the user's recent hooks where they took a real action: posted to
  // the platform, copied to clipboard, or thumbs-upped. These are the
  // ground-truth signals for what voice/style works for THIS user, and they
  // get fed back into the generation prompt as voice anchors.
  // Ranking: posted > copied > thumbs-up, then most recent.
  async getUserSuccessfulHookExamples(
    userId: number,
    platform: string = 'LinkedIn',
    limit: number = 3,
  ): Promise<string[]> {
    const rows = await db
      .select({
        hookContent: hookAnalytics.hookContent,
        wasPosted: hookAnalytics.wasPosted,
        wasCopied: hookAnalytics.wasCopied,
      })
      .from(hookAnalytics)
      .where(
        and(
          eq(hookAnalytics.userId, userId),
          eq(hookAnalytics.platform, platform),
          or(
            eq(hookAnalytics.wasPosted, true),
            eq(hookAnalytics.wasCopied, true),
            eq(hookAnalytics.feedback, 1),
          ),
          sql`${hookAnalytics.hookContent} IS NOT NULL`,
          sql`length(${hookAnalytics.hookContent}) > 0`,
        ),
      )
      .orderBy(
        desc(hookAnalytics.wasPosted),
        desc(hookAnalytics.wasCopied),
        desc(hookAnalytics.createdAt),
      )
      .limit(limit);

    // Deduplicate identical hooks (user might have copied the same hook twice).
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of rows) {
      if (!r.hookContent) continue;
      const trimmed = r.hookContent.trim();
      if (!trimmed || seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
    }
    return out;
  }
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
