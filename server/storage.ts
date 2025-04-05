import { 
  users, type User, type InsertUser, 
  transformations, type Transformation, type InsertTransformation,
  transformationOutputs, type TransformationOutput, type InsertTransformationOutput
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Transformation methods
  createTransformation(data: InsertTransformation): Promise<Transformation>;
  getTransformation(id: number): Promise<Transformation | undefined>;
  getRecentTransformations(limit: number): Promise<Transformation[]>;
  
  // Transformation output methods
  createTransformationOutput(data: InsertTransformationOutput): Promise<TransformationOutput>;
  getTransformationOutputs(transformationId: number): Promise<TransformationOutput[]>;
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
}

// Use DatabaseStorage instead of MemStorage
export const storage = new DatabaseStorage();
