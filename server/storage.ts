import { 
  users, type User, type InsertUser, 
  transformations, type Transformation, type InsertTransformation,
  transformationOutputs, type TransformationOutput, type InsertTransformationOutput
} from "@shared/schema";

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

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private transformationsMap: Map<number, Transformation>;
  private transformationOutputsMap: Map<number, TransformationOutput[]>;
  private userIdCounter: number;
  private transformationIdCounter: number;
  private transformationOutputIdCounter: number;

  constructor() {
    this.users = new Map();
    this.transformationsMap = new Map();
    this.transformationOutputsMap = new Map();
    this.userIdCounter = 1;
    this.transformationIdCounter = 1;
    this.transformationOutputIdCounter = 1;
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
  
  // Transformation methods
  async createTransformation(data: InsertTransformation): Promise<Transformation> {
    const id = this.transformationIdCounter++;
    const createdAt = new Date();
    
    const transformation: Transformation = {
      ...data,
      id,
      createdAt
    };
    
    this.transformationsMap.set(id, transformation);
    return transformation;
  }
  
  async getTransformation(id: number): Promise<Transformation | undefined> {
    return this.transformationsMap.get(id);
  }
  
  async getRecentTransformations(limit: number): Promise<Transformation[]> {
    return Array.from(this.transformationsMap.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
  
  // Transformation output methods
  async createTransformationOutput(data: InsertTransformationOutput): Promise<TransformationOutput> {
    const id = this.transformationOutputIdCounter++;
    
    const output: TransformationOutput = {
      ...data,
      id
    };
    
    if (!this.transformationOutputsMap.has(data.transformationId)) {
      this.transformationOutputsMap.set(data.transformationId, []);
    }
    
    this.transformationOutputsMap.get(data.transformationId)!.push(output);
    
    return output;
  }
  
  async getTransformationOutputs(transformationId: number): Promise<TransformationOutput[]> {
    return this.transformationOutputsMap.get(transformationId) || [];
  }
}

export const storage = new MemStorage();
