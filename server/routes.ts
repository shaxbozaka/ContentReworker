import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transformationRequestSchema, transformationResponseSchema, type TransformationRequest, type PlatformType } from "@shared/schema";
import { repurposeContent, regenerateContent } from "./services/openai";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for content repurposing
  app.post('/api/repurpose', async (req, res) => {
    try {
      // Validate the request body
      const validatedData = transformationRequestSchema.parse(req.body);
      
      // Get repurposed content from OpenAI
      const outputs = await repurposeContent(validatedData);
      
      // Save the transformation to storage
      const transformation = await storage.createTransformation({
        originalContent: validatedData.content,
        contentSource: validatedData.contentSource,
        tone: validatedData.tone,
        outputLength: validatedData.outputLength,
        useHashtags: validatedData.useHashtags,
        useEmojis: validatedData.useEmojis,
      });
      
      // Save each platform's output
      for (const [platform, output] of Object.entries(outputs)) {
        await storage.createTransformationOutput({
          transformationId: transformation.id,
          platformType: platform as PlatformType,
          content: output.content,
          characterCount: output.characterCount,
        });
      }
      
      // Return the response
      const response = transformationResponseSchema.parse({ outputs });
      return res.status(200).json(response);
      
    } catch (error) {
      console.error("Error repurposing content:", error);
      
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      
      return res.status(500).json({ message: "Failed to repurpose content" });
    }
  });
  
  // API route for regenerating a specific platform's content
  app.post('/api/repurpose/regenerate', async (req, res) => {
    try {
      // Validate required fields
      const { content, contentSource, platform, tone, outputLength, useHashtags, useEmojis } = req.body;
      
      if (!content || !contentSource || !platform || !tone || outputLength === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Regenerate content for the specific platform
      const output = await regenerateContent({
        content,
        contentSource,
        platform,
        tone,
        outputLength,
        useHashtags,
        useEmojis
      });
      
      // Return the response
      return res.status(200).json({ outputs: { [platform]: output } });
      
    } catch (error) {
      console.error("Error regenerating content:", error);
      return res.status(500).json({ message: "Failed to regenerate content" });
    }
  });
  
  // Get recent transformations
  app.get('/api/transformations', async (req, res) => {
    try {
      const transformations = await storage.getRecentTransformations(10);
      return res.status(200).json({ transformations });
    } catch (error) {
      console.error("Error fetching transformations:", error);
      return res.status(500).json({ message: "Failed to fetch transformations" });
    }
  });
  
  // Get a specific transformation with its outputs
  app.get('/api/transformations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid transformation ID" });
      }
      
      const transformation = await storage.getTransformation(id);
      if (!transformation) {
        return res.status(404).json({ message: "Transformation not found" });
      }
      
      const outputs = await storage.getTransformationOutputs(id);
      
      return res.status(200).json({ transformation, outputs });
    } catch (error) {
      console.error("Error fetching transformation:", error);
      return res.status(500).json({ message: "Failed to fetch transformation" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
