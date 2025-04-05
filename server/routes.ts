import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transformationRequestSchema, transformationResponseSchema, type TransformationRequest, type PlatformType } from "@shared/schema";
import { repurposeContent, regenerateContent } from "./services/openai";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  getLinkedInAuthURL, 
  getLinkedInAccessToken, 
  getLinkedInUserProfile, 
  storeLinkedInConnection,
  postToLinkedIn
} from "./services/linkedin";

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

  // LinkedIn OAuth Routes
  
  // Get LinkedIn auth URL
  app.get('/api/auth/linkedin', (req, res) => {
    const authUrl = getLinkedInAuthURL();
    res.status(200).json({ authUrl });
  });
  
  // Alias for the frontend
  app.get('/api/social/linkedin/auth', (req, res) => {
    const url = getLinkedInAuthURL();
    res.status(200).json({ url });
  });

  // LinkedIn OAuth callback
  app.get('/api/auth/linkedin/callback', async (req, res) => {
    try {
      const { code } = req.query;
      if (!code) {
        return res.status(400).json({ message: 'Authorization code is required' });
      }

      // For demo purposes, we're using a default user ID
      const userId = 1;

      // Exchange code for access token
      const tokenData = await getLinkedInAccessToken(code as string);
      
      // Get LinkedIn profile data
      const profileData = await getLinkedInUserProfile(tokenData.access_token);

      // Store LinkedIn connection in database
      await storeLinkedInConnection(userId, profileData, tokenData);

      // Redirect back to the application
      res.redirect('/?linkedInConnected=true');
    } catch (error) {
      console.error('LinkedIn OAuth callback error:', error);
      res.redirect('/?linkedInConnected=false&error=Authentication+failed');
    }
  });

  // Get LinkedIn connection status
  app.get('/api/auth/linkedin/status', async (req, res) => {
    try {
      // For demo purposes, we're using a default user ID
      const userId = 1;
      
      const connection = await storage.getSocialConnectionByUserAndProvider(userId, 'linkedin');
      
      if (!connection) {
        return res.status(200).json({ connected: false });
      }

      // Check if token is expired
      const isExpired = connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date();
      
      const profileData = connection.profileData ? 
        (typeof connection.profileData === 'string' ? 
          JSON.parse(connection.profileData) : 
          connection.profileData) : 
        {};
      
      return res.status(200).json({
        connected: !isExpired,
        profile: profileData,
        expired: isExpired
      });
    } catch (error) {
      console.error('Error checking LinkedIn status:', error);
      return res.status(500).json({ message: 'Failed to check LinkedIn connection status' });
    }
  });
  
  // Alias for the frontend
  app.get('/api/social/linkedin/status', async (req, res) => {
    try {
      // For demo purposes, we're using a default user ID
      const userId = 1;
      
      const connection = await storage.getSocialConnectionByUserAndProvider(userId, 'linkedin');
      
      if (!connection) {
        return res.status(200).json({ connected: false });
      }

      // Check if token is expired
      const isExpired = connection.tokenExpiresAt && new Date(connection.tokenExpiresAt.toString()) < new Date();
      
      const profileData = connection.profileData ? 
        (typeof connection.profileData === 'string' ? 
          JSON.parse(connection.profileData) : 
          connection.profileData) : 
        {};
      
      return res.status(200).json({
        connected: !isExpired,
        profile: profileData,
        expired: isExpired
      });
    } catch (error) {
      console.error('Error checking LinkedIn status:', error);
      return res.status(500).json({ message: 'Failed to check LinkedIn connection status' });
    }
  });

  // Post to LinkedIn
  app.post('/api/social/linkedin/post', async (req, res) => {
    try {
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ message: 'Content is required' });
      }
      
      // For demo purposes, we're using a default user ID
      const userId = 1;
      
      const result = await postToLinkedIn(userId, content);
      
      return res.status(result.success ? 200 : 400).json(result);
    } catch (error) {
      console.error('Error posting to LinkedIn:', error);
      return res.status(500).json({ success: false, error: 'Failed to post to LinkedIn' });
    }
  });

  // Disconnect LinkedIn
  app.delete('/api/auth/linkedin', async (req, res) => {
    try {
      // For demo purposes, we're using a default user ID
      const userId = 1;
      
      const connection = await storage.getSocialConnectionByUserAndProvider(userId, 'linkedin');
      
      if (connection) {
        await storage.deleteSocialConnection(connection.id);
        return res.status(200).json({ success: true });
      } else {
        return res.status(404).json({ success: false, message: 'No LinkedIn connection found' });
      }
    } catch (error) {
      console.error('Error disconnecting LinkedIn:', error);
      return res.status(500).json({ success: false, message: 'Failed to disconnect LinkedIn' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
