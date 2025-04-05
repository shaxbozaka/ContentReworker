import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transformationRequestSchema, transformationResponseSchema, type TransformationRequest, type PlatformType, type AIProvider } from "@shared/schema";
import * as openaiService from "./services/openai";
import * as anthropicService from "./services/anthropic";
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

      // Select AI service based on the provider in the request
      let outputs;
      if (validatedData.aiProvider === 'Anthropic') {
        // Check if Anthropic API key is set
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(400).json({ 
            message: "Anthropic API key (ANTHROPIC_API_KEY) is not configured." 
          });
        }
        outputs = await anthropicService.repurposeContent(
          validatedData.content,
          validatedData.contentSource,
          validatedData.platforms,
          validatedData.tone,
          validatedData.outputLength,
          validatedData.useHashtags,
          validatedData.useEmojis
        );
      } else {
        // Default to OpenAI
        outputs = await openaiService.repurposeContent(validatedData);
      }
      
      // Save the transformation to storage
      const transformation = await storage.createTransformation({
        originalContent: validatedData.content,
        contentSource: validatedData.contentSource,
        tone: validatedData.tone,
        outputLength: validatedData.outputLength,
        useHashtags: validatedData.useHashtags,
        useEmojis: validatedData.useEmojis,
        aiProvider: validatedData.aiProvider,
      });
      
      // Save each platform's output
      for (const [platform, output] of Object.entries(outputs)) {
        const typedOutput = output as { content: string, characterCount: number };
        await storage.createTransformationOutput({
          transformationId: transformation.id,
          platformType: platform as PlatformType,
          content: typedOutput.content,
          characterCount: typedOutput.characterCount,
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
      const { content, contentSource, platform, tone, outputLength, useHashtags, useEmojis, aiProvider } = req.body;
      
      if (!content || !contentSource || !platform || !tone || outputLength === undefined) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Create a regeneration request
      const regenerationRequest = {
        content,
        contentSource,
        platform,
        tone,
        outputLength,
        useHashtags: useHashtags || false,
        useEmojis: useEmojis || false
      };
      
      let output;
      
      // Select the appropriate AI service based on the provider
      if (aiProvider === 'Anthropic') {
        // Check if Anthropic API key is set
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(400).json({ 
            message: "Anthropic API key (ANTHROPIC_API_KEY) is not configured." 
          });
        }
        output = await anthropicService.regenerateContent(regenerationRequest);
      } else {
        // Default to OpenAI
        output = await openaiService.regenerateContent(regenerationRequest);
      }
      
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

  // API Provider Routes
  
  // Check if Anthropic API key is configured
  app.get('/api/ai/anthropic/config-status', (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    
    if (!apiKey) {
      return res.json({ 
        configured: false, 
        message: "Anthropic API key (ANTHROPIC_API_KEY) is not configured." 
      });
    }
    
    res.json({ configured: true });
  });
  
  // Request secrets endpoint (this is a stub, as the actual implementation depends on your frontend secret management)
  app.post('/api/secrets/request', (req, res) => {
    const { secrets } = req.body;
    
    // Log the secrets being requested (don't log actual secret values, just the keys)
    console.log('Secrets requested:', secrets);
    
    // This endpoint doesn't actually set secrets (that would be a security risk)
    // It just acknowledges the request, and the user would need to set secrets through
    // proper channels like environment variables or a secret management system
    
    res.status(200).json({ 
      message: "Secret request received. Please set the environment variables through the proper channels.", 
      requested: secrets 
    });
  });
  
  // LinkedIn OAuth Routes
  
  // Check if LinkedIn API credentials are configured
  app.get('/api/social/linkedin/config-status', (req, res) => {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
    
    if (!clientId || !clientSecret) {
      return res.json({ 
        configured: false, 
        message: "LinkedIn API credentials (LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET) are not configured." 
      });
    }
    
    res.json({ configured: true });
  });
  
  // Get LinkedIn auth URL
  app.get('/api/auth/linkedin', (req, res) => {
    // Check if LinkedIn API credentials are configured
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return res.status(400).json({ 
        error: 'LinkedIn API credentials are not configured.',
        missingCredentials: true
      });
    }
    
    const authUrl = getLinkedInAuthURL();
    res.status(200).json({ authUrl });
  });
  
  // Alias for the frontend
  app.get('/api/social/linkedin/auth', (req, res) => {
    // Check if LinkedIn API credentials are configured
    if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
      return res.status(400).json({ 
        error: 'LinkedIn API credentials are not configured.',
        missingCredentials: true
      });
    }
    
    const url = getLinkedInAuthURL();
    res.status(200).json({ url });
  });

  // LinkedIn OAuth callback
  app.get('/api/auth/linkedin/callback', async (req, res) => {
    try {
      // Check if LinkedIn API credentials are configured
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return res.redirect('/?linkedInConnected=false&error=LinkedIn+API+credentials+not+configured');
      }
      
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
      // Check if LinkedIn API credentials are configured
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return res.status(400).json({ 
          success: false, 
          error: 'LinkedIn API credentials are not configured.',
          missingCredentials: true
        });
      }
      
      const { content } = req.body;
      
      if (!content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Content is required' 
        });
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
