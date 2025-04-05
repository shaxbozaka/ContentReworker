import { 
  users, type User, type InsertUser, 
  transformations, type Transformation, type InsertTransformation,
  transformationOutputs, type TransformationOutput, type InsertTransformationOutput,
  socialConnections, type SocialConnection, type InsertSocialConnection
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Transformation methods
  createTransformation(data: InsertTransformation): Promise<Transformation>;
  getTransformation(id: number): Promise<Transformation | undefined>;
  getRecentTransformations(limit: number): Promise<Transformation[]>;
  
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
