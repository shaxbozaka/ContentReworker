import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transformationRequestSchema, transformationResponseSchema, type TransformationRequest, type PlatformType, type AIProvider, insertUserSchema } from "@shared/schema";
import * as openaiService from "./services/openai";
import * as anthropicService from "./services/anthropic";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import axios from 'axios';
import { 
  getLinkedInAuthURL, 
  getLinkedInAccessToken, 
  getLinkedInUserProfile, 
  storeLinkedInConnection,
  postToLinkedIn
} from "./services/linkedin";
import bcrypt from 'bcryptjs';

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
  
  // Handle OAuth completion with client-provided credentials
  app.post('/api/social/linkedin/exchange-code', async (req, res) => {
    try {
      const { code, clientId, clientSecret, redirectUri } = req.body;
      
      if (!code || !clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required parameters' 
        });
      }
      
      // Exchange code for token
      const tokenResponse = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
        params: {
          grant_type: 'authorization_code',
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
        },
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const tokenData = tokenResponse.data;
      
      // Get user profile
      const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        params: {
          projection: '(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
        },
      });
      
      const profileData = profileResponse.data;
      
      // For demo purposes, use user ID 1
      const userId = 1;
      
      // Store the connection in database
      await storeLinkedInConnection(userId, profileData, tokenData);
      
      return res.status(200).json({
        success: true,
        profile: {
          id: profileData.id,
          firstName: profileData.localizedFirstName,
          lastName: profileData.localizedLastName
        }
      });
    } catch (error: any) {
      console.error('Error exchanging LinkedIn authorization code:', error);
      return res.status(500).json({ 
        success: false, 
        error: error.response?.data?.error_description || error.message || 'Failed to exchange code'
      });
    }
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
      
      const { code, state, userId } = req.query;
      if (!code) {
        return res.status(400).json({ message: 'Authorization code is required' });
      }

      // Get user ID from query params or use default
      // In a production app, you would extract this from the state parameter or session
      const userIdValue = userId ? parseInt(userId as string) : 1;

      // Exchange code for access token
      const tokenData = await getLinkedInAccessToken(code as string);
      
      // Get LinkedIn profile data
      const profileData = await getLinkedInUserProfile(tokenData.access_token);

      // Store LinkedIn connection in database
      await storeLinkedInConnection(userIdValue, profileData, tokenData);

      // Redirect back to the application
      res.redirect('/?linkedInConnected=true&userId=' + userIdValue);
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
      // Get user ID from query parameters or use default
      const userId = req.query.userId ? parseInt(req.query.userId as string) : 1;
      
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
      
      const { content, userId } = req.body;
      
      if (!content) {
        return res.status(400).json({ 
          success: false, 
          error: 'Content is required' 
        });
      }
      
      // Use provided user ID or default to 1
      const userIdValue = userId ? parseInt(userId) : 1;
      
      const result = await postToLinkedIn(userIdValue, content);
      
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

  // User Management Routes
  
  // Get all users
  app.get('/api/users', async (req, res) => {
    try {
      // In a real application, you would add pagination and filtering
      const users = await storage.getAllUsers();
      
      // Don't send passwords to the frontend
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username
      }));
      
      return res.status(200).json({ users: sanitizedUsers });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
  
  // Register a new user
  app.post('/api/users/register', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Validate input
      const validationResult = insertUserSchema.safeParse({ username, password });
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: 'Invalid input',
          errors: validationResult.error.errors
        });
      }
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword
      });
      
      // Return user without password
      return res.status(201).json({
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error('Error registering user:', error);
      return res.status(500).json({ message: 'Failed to register user' });
    }
  });
  
  // Login
  app.post('/api/users/login', async (req, res) => {
    try {
      const { username, password } = req.body;
      
      // Validate input
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Return user without password
      return res.status(200).json({
        user: {
          id: user.id,
          username: user.username
        }
      });
    } catch (error) {
      console.error('Error logging in:', error);
      return res.status(500).json({ message: 'Failed to log in' });
    }
  });
  
  // Get user's social connections
  app.get('/api/users/:userId/social-connections', async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }
      
      // Check if user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get connections
      const connections = await storage.getUserSocialConnections(userId);
      
      // Transform connections for the frontend
      const formattedConnections = connections.map(conn => ({
        id: conn.id,
        userId: conn.userId,
        provider: conn.provider,
        tokenExpiresAt: conn.tokenExpiresAt,
        profileData: typeof conn.profileData === 'string' 
          ? JSON.parse(conn.profileData) 
          : conn.profileData,
        createdAt: conn.createdAt,
        updatedAt: conn.updatedAt
      }));
      
      return res.status(200).json({ connections: formattedConnections });
    } catch (error) {
      console.error('Error fetching user social connections:', error);
      return res.status(500).json({ message: 'Failed to fetch social connections' });
    }
  });
  
  // Delete a social connection
  app.delete('/api/social-connections/:connectionId', async (req, res) => {
    try {
      const connectionId = parseInt(req.params.connectionId);
      if (isNaN(connectionId)) {
        return res.status(400).json({ message: 'Invalid connection ID' });
      }
      
      // Check if connection exists
      const connection = await storage.getSocialConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: 'Connection not found' });
      }
      
      // Delete connection
      await storage.deleteSocialConnection(connectionId);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting social connection:', error);
      return res.status(500).json({ message: 'Failed to delete social connection' });
    }
  });
  
  // Update LinkedIn OAuth flow to support specifying a user
  app.get('/api/auth/linkedin/user', (req, res) => {
    try {
      // Check if LinkedIn API credentials are configured
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return res.status(400).json({ 
          error: 'LinkedIn API credentials are not configured.',
          missingCredentials: true
        });
      }
      
      // Get user ID from query parameters
      const userId = req.query.userId ? parseInt(req.query.userId as string) : null;
      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }
      
      // Get LinkedIn auth URL for user-specific flow
      const baseAuthUrl = getLinkedInAuthURL(true);
      
      // Add userId to the state parameter
      const authUrl = `${baseAuthUrl}&state=userId-${userId}`;
      
      return res.status(200).json({ authUrl });
    } catch (error) {
      console.error('Error generating LinkedIn auth URL:', error);
      return res.status(500).json({ message: 'Failed to generate LinkedIn auth URL' });
    }
  });
  
  // Modified LinkedIn OAuth callback to extract userId from state
  app.get('/api/auth/linkedin/user/callback', async (req, res) => {
    try {
      // Check if LinkedIn API credentials are configured
      if (!process.env.LINKEDIN_CLIENT_ID || !process.env.LINKEDIN_CLIENT_SECRET) {
        return res.redirect('/accounts?error=LinkedIn+API+credentials+not+configured');
      }
      
      const { code, state } = req.query;
      if (!code) {
        return res.redirect('/accounts?error=Authorization+code+is+required');
      }
      
      // Extract the user ID from the state parameter
      let userId = 1; // Default user ID as fallback
      if (state && typeof state === 'string' && state.startsWith('userId-')) {
        const stateUserId = parseInt(state.replace('userId-', ''));
        if (!isNaN(stateUserId)) {
          userId = stateUserId;
        }
      }
      
      // Exchange code for access token using the user-specific redirect URI
      const tokenData = await getLinkedInAccessToken(code as string, true);
      
      // Get LinkedIn profile data
      const profileData = await getLinkedInUserProfile(tokenData.access_token);
      
      // Store LinkedIn connection in database
      await storeLinkedInConnection(userId, profileData, tokenData);
      
      // Redirect back to the accounts page
      res.redirect(`/accounts?linkedInConnected=true&userId=${userId}`);
    } catch (error) {
      console.error('LinkedIn OAuth callback error:', error);
      res.redirect('/accounts?error=Authentication+failed');
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
