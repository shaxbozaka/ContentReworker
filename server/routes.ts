import type { Express, Request, Response, NextFunction } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transformationRequestSchema, transformationResponseSchema, type TransformationRequest, type PlatformType, type AIProvider, insertUserSchema, trackedAccounts, userContentPreferences, viralInteractions, curatedVirals, users as usersTable } from "@shared/schema";
import { db } from "./db";
import { and, desc, eq } from "drizzle-orm";
import { ingestForAccount } from "./services/competitor-ingest";
import { importYouTubeForUser, ingestAllYouTubeForUser } from "./services/youtube-bootstrap";
import { tagUntagged } from "./services/viral-tagger";
import { requireAdmin, regenerateSession } from "./middleware/auth";
import rateLimit from "express-rate-limit";
import * as openaiService from "./services/openai";
import * as anthropicService from "./services/anthropic";
import * as geminiService from "./services/gemini";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import axios from 'axios';
import {
  getLinkedInAuthURL,
  getLinkedInLoginURL,
  getLinkedInAccessToken,
  getLinkedInUserProfile,
  storeLinkedInConnection,
  postToLinkedIn,
  isLinkedInAuthConfigured
} from "./services/linkedin";
import {
  getGoogleAuthURL,
  getGoogleAccessToken,
  getGoogleUserInfo,
  isGoogleAuthConfigured
} from "./services/google-auth";
import * as trendingService from "./services/trending";
import bcrypt from 'bcryptjs';
import crypto from "crypto";

const SUPPORTED_SCHEDULED_PLATFORM = 'linkedin';
const SUPPORTED_PIPELINE_PLATFORM = 'LinkedIn';

// CSPRNG for OAuth state tokens (and similar CSRF defences). Math.random
// is not cryptographically secure; an attacker who observes one token
// could reduce entropy enough to predict future ones. 16 bytes of CSPRNG
// entropy → 128 bits → unforgeable.
function genState(prefix: string = ''): string {
  return `${prefix}${prefix ? '_' : ''}${crypto.randomBytes(16).toString('hex')}`;
}

// Second line of defence against cookie-rotating cost abuse on the paid LLM
// endpoint. Per-user (FREE_DAILY_LIMIT=3) caps the legitimate case; this
// caps the spammer who churns anon users from one IP.
const repurposeIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests from this IP. Please try again later.' },
});

// Credential-stuffing / brute-force defence on the password login endpoint.
// 10 attempts per IP per 15 minutes is loose enough for legitimate typos +
// users behind NAT, tight enough that a 6-char random password (36^6 space)
// takes ~300 years to brute-force per IP. Successful logins skip the counter
// so a real user isn't locked out after a few legitimate sign-ins.
const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { message: 'Too many login attempts. Try again in a few minutes.' },
});

// Account-creation spam defence. 5 new accounts per IP per hour.
const registerIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many accounts from this IP. Try again later.' },
});

// Cost-inflation defence for endpoints that hit expensive external APIs
// (YouTube Data API quota, HN/Reddit scrape, YT subscription imports).
// Looser than login but tight relative to the cost — 30 calls/IP/hour means
// a malicious authenticated user can still refresh legitimately several times
// per hour while not draining the 10k-unit/day YouTube quota.
const expensiveApiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many refresh requests. Try again in a few minutes.' },
});

// Helper to get or create user ID from session
async function ensureUserId(req: Request): Promise<number> {
  if (req.session.userId) {
    return req.session.userId;
  }

  // Create anonymous user
  const user = await storage.createAnonymousUser();
  req.session.userId = user.id;
  req.session.isAnonymous = true;

  return user.id;
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function serializeUser(user: {
  id: number;
  username: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  plan?: string | null;
  subscriptionStatus?: string | null;
  hasSeenOnboarding?: boolean | null;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email || undefined,
    name: user.name || undefined,
    avatarUrl: user.avatarUrl || undefined,
    plan: user.plan || 'free',
    subscriptionStatus: user.subscriptionStatus || undefined,
    hasSeenOnboarding: Boolean(user.hasSeenOnboarding),
  };
}

function normalizeScheduledPlatform(platform: unknown): string | null {
  if (platform == null || platform === '') {
    return SUPPORTED_SCHEDULED_PLATFORM;
  }

  if (typeof platform !== 'string') {
    return null;
  }

  return platform.trim().toLowerCase() === SUPPORTED_SCHEDULED_PLATFORM
    ? SUPPORTED_SCHEDULED_PLATFORM
    : null;
}

function normalizePipelinePlatform(platform: unknown): string | null {
  if (typeof platform !== 'string') {
    return null;
  }

  return platform.trim().toLowerCase() === SUPPORTED_SCHEDULED_PLATFORM
    ? SUPPORTED_PIPELINE_PLATFORM
    : null;
}

function normalizePipelinePlatforms(platforms: unknown): string[] | null {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return null;
  }

  const normalized = platforms
    .map(normalizePipelinePlatform)
    .filter((platform): platform is string => Boolean(platform));

  if (normalized.length !== platforms.length) {
    return null;
  }

  return Array.from(new Set(normalized));
}

// Helper to generate OAuth callback HTML (handles both popup and redirect)
function generateOAuthCallbackHTML(userData: any, error?: string): string {
  const userDataJSON = userData ? JSON.stringify(userData) : 'null';
  const errorMessage = error ? JSON.stringify(error) : 'null';

  return `
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Complete</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      background: #0f0f0f;
      color: #faf7f2;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .container {
      text-align: center;
      padding: 2rem;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #f59e0b;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    .success {
      color: #22c55e;
      font-size: 48px;
      margin-bottom: 1rem;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>
  <div class="container">
    <div id="loading">
      <div class="spinner"></div>
      <p>Completing sign in...</p>
    </div>
    <div id="success" style="display:none">
      <div class="success">&#10003;</div>
      <p>Signed in! You can close this window.</p>
    </div>
  </div>
  <script>
    (function() {
      var userData = ${userDataJSON};
      var error = ${errorMessage};
      var origin = window.location.origin;
      var messageSent = false;

      function sendMessageAndClose() {
        if (messageSent) return;

        // Try to find opener (might be window.opener or parent from different contexts)
        var opener = window.opener;

        if (opener && !opener.closed) {
          try {
            if (error) {
              opener.postMessage({ type: 'oauth-error', error: error }, origin);
            } else if (userData) {
              opener.postMessage({ type: 'oauth-success', user: userData }, origin);
            }
            messageSent = true;

            // Show success state
            document.getElementById('loading').style.display = 'none';
            document.getElementById('success').style.display = 'block';

            // Close after a short delay
            setTimeout(function() {
              window.close();
            }, 500);

            // If window didn't close (some browsers block), show message
            setTimeout(function() {
              if (!window.closed) {
                document.querySelector('#success p').textContent = 'Signed in! Please close this window.';
              }
            }, 1000);

            return true;
          } catch (e) {
            console.error('PostMessage failed:', e);
          }
        }
        return false;
      }

      // Try immediately
      if (!sendMessageAndClose()) {
        // If no opener, redirect to main page
        if (error) {
          window.location.href = '/?error=' + encodeURIComponent(error);
        } else if (userData) {
          window.location.href = '/?loggedIn=true&userData=' + encodeURIComponent(JSON.stringify(userData));
        } else {
          window.location.href = '/';
        }
      }
    })();
  </script>
</body>
</html>
  `.trim();
}

function getProviderFallbackOrder(preferred: string): string[] {
  const all = ['Gemini', 'OpenAI', 'Anthropic'];
  return [preferred, ...all.filter(p => p !== preferred)];
}

export async function registerRoutes(app: Express): Promise<Server> {
  // API routes for content repurposing
  app.post('/api/repurpose', repurposeIpLimiter, async (req, res) => {
    try {
      // Validate the request body
      const validatedData = transformationRequestSchema.parse(req.body);

      // Rate limiting for free tier users (3 posts/day)
      const FREE_DAILY_LIMIT = 3;
      const userId = await ensureUserId(req);
      const user = await storage.getUser(userId);
      const isPro = user?.plan === 'pro';

      if (!isPro) {
        const todayCount = await storage.getTodayTransformationCount(userId);
        if (todayCount >= FREE_DAILY_LIMIT) {
          return res.status(429).json({
            message: `Daily limit reached (${FREE_DAILY_LIMIT} posts/day). Upgrade to Pro for unlimited posts.`,
            limitReached: true,
            todayCount,
            limit: FREE_DAILY_LIMIT,
          });
        }
      }

      // Voice anchors: hooks the user has previously copied or posted. Used to
      // tune the LinkedIn hook generation toward this user's actual taste.
      // Only fetch when LinkedIn is in the requested platforms — saves a query
      // on Twitter/Instagram/Threads/Email-only generations.
      const voiceExamples = validatedData.platforms.includes('LinkedIn')
        ? await storage.getUserSuccessfulHookExamples(userId, 'LinkedIn', 3).catch((err) => {
            console.warn('[voiceExamples] failed to load:', err);
            return [] as string[];
          })
        : [];

      // Use Gemini as primary provider with automatic fallback
      let outputs;
      const providerOrder = getProviderFallbackOrder(validatedData.aiProvider);
      let lastError: Error | null = null;

      for (const provider of providerOrder) {
        try {
          if (provider === 'OpenAI') {
            if (!process.env.OPENAI_API_KEY) continue;
            outputs = await openaiService.repurposeContent(validatedData);
          } else if (provider === 'Anthropic') {
            if (!process.env.ANTHROPIC_API_KEY) continue;
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
            if (!process.env.GEMINI_API_KEY) continue;
            outputs = await geminiService.repurposeContent(validatedData, { voiceExamples });
          }
          break; // Success — stop trying other providers
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          console.warn(`[AI Fallback] ${provider} failed: ${lastError.message}, trying next provider...`);
        }
      }

      if (!outputs) {
        const errMsg = lastError?.message || 'All AI providers failed';
        return res.status(502).json({ message: `AI generation failed: ${errMsg}` });
      }
      
      // Save the transformation to storage (linked to user if logged in)
      const transformation = await storage.createTransformation({
        userId,
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
      
      // Return the response with transformationId
      const response = transformationResponseSchema.parse({ outputs });
      return res.status(200).json({ ...response, transformationId: transformation.id });
      
    } catch (error) {
      console.error("Error repurposing content:", error);

      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.status(500).json({ message: `Failed to repurpose content: ${errorMessage}` });
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

      // Voice anchors for LinkedIn regeneration — same feedback loop as /api/repurpose.
      const regenUserId = req.session?.userId;
      const voiceExamples = (platform === 'LinkedIn' && regenUserId)
        ? await storage.getUserSuccessfulHookExamples(regenUserId, 'LinkedIn', 3).catch(() => [] as string[])
        : [];

      let output;

      // Use Gemini as primary provider
      if (aiProvider === 'OpenAI') {
        output = await openaiService.regenerateContent(regenerationRequest);
      } else if (aiProvider === 'Anthropic') {
        if (!process.env.ANTHROPIC_API_KEY) {
          return res.status(400).json({
            message: "Anthropic API key (ANTHROPIC_API_KEY) is not configured."
          });
        }
        output = await anthropicService.regenerateContent(regenerationRequest);
      } else {
        // Default to Gemini (primary provider)
        if (!process.env.GEMINI_API_KEY) {
          return res.status(400).json({
            message: "Gemini API key (GEMINI_API_KEY) is not configured."
          });
        }
        output = await geminiService.regenerateContent(regenerationRequest, { voiceExamples });
      }
      
      // Return the response
      return res.status(200).json({ outputs: { [platform]: output } });
      
    } catch (error) {
      console.error("Error regenerating content:", error);
      return res.status(500).json({ message: "Failed to regenerate content" });
    }
  });

  // API route for tracking hook selection analytics
  app.post('/api/analytics/hook-selection', async (req, res) => {
    try {
      const { hookType, hookIndex, hookContent, platform, contentLength, action, feedback } = req.body;

      // Get user ID if logged in
      const userId = req.session?.userId || null;
      const sessionId = req.sessionID;

      // Insert analytics record
      await storage.trackHookSelection({
        userId,
        sessionId,
        hookType: hookType || `hook_${hookIndex}`,
        hookIndex: hookIndex ?? 0,
        hookContent,
        platform: platform || 'LinkedIn',
        contentLength,
        wasCopied: action === 'copy',
        wasPosted: action === 'post',
        feedback: feedback, // 1 = thumbs up, -1 = thumbs down
      });

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error tracking hook analytics:", error);
      // Don't fail the request for analytics errors
      return res.status(200).json({ success: false });
    }
  });

  // Get recent transformations
  // Recent transformations — scoped to the caller's own user. The
  // unscoped list endpoint (that previously leaked everyone's content)
  // is removed; use /api/transformations/history for the authenticated
  // paginated list.
  app.get('/api/transformations', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(200).json({ transformations: [] });
      }
      const transformations = await storage.getUserTransformations(req.session.userId, { limit: 10, offset: 0 });
      return res.status(200).json({ transformations });
    } catch (error) {
      console.error("Error fetching transformations:", error);
      return res.status(500).json({ message: "Failed to fetch transformations" });
    }
  });

  // Get a specific transformation with its outputs — 404s unless the
  // caller owns the row. Previously IDOR: any numeric id returned any
  // user's content regardless of ownership.
  app.get('/api/transformations/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid transformation ID" });
      }
      if (!req.session.userId) {
        return res.status(404).json({ message: "Transformation not found" });
      }

      const transformation = await storage.getTransformation(id);
      if (!transformation || transformation.userId !== req.session.userId) {
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
      
      if (!req.session.userId || req.session.isAnonymous) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }
      
      // Store the connection in database
      await storeLinkedInConnection(req.session.userId, profileData, tokenData);
      
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

  const startLinkedInConnect = async (req: Request, res: Response, responseKey: 'authUrl' | 'url' = 'authUrl') => {
    if (!isLinkedInAuthConfigured()) {
      return res.status(400).json({
        error: 'LinkedIn API credentials are not configured.',
        missingCredentials: true
      });
    }

    if (!req.session.userId || req.session.isAnonymous) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const state = genState('connect');
    req.session.linkedinConnectState = state;
    await saveSession(req);

    const authUrl = getLinkedInAuthURL(state, 'user');
    return res.status(200).json({ [responseKey]: authUrl });
  };

  const getLinkedInConnectionStatus = async (req: Request, res: Response) => {
    try {
      if (!req.session.userId || req.session.isAnonymous) {
        return res.status(200).json({ connected: false });
      }

      const connection = await storage.getSocialConnectionByUserAndProvider(req.session.userId, 'linkedin');

      if (!connection) {
        return res.status(200).json({ connected: false });
      }

      const isExpired = Boolean(connection.tokenExpiresAt && new Date(connection.tokenExpiresAt.toString()) < new Date());
      const profileData = connection.profileData
        ? (typeof connection.profileData === 'string' ? JSON.parse(connection.profileData) : connection.profileData)
        : {};

      return res.status(200).json({
        connected: !isExpired,
        profile: profileData,
        expired: isExpired
      });
    } catch (error) {
      console.error('Error checking LinkedIn status:', error);
      return res.status(500).json({ message: 'Failed to check LinkedIn connection status' });
    }
  };
  
  // Get LinkedIn auth URL
  app.get('/api/auth/linkedin', async (req, res) => {
    try {
      return await startLinkedInConnect(req, res, 'authUrl');
    } catch (error) {
      console.error('Error generating LinkedIn auth URL:', error);
      return res.status(500).json({ message: 'Failed to generate LinkedIn auth URL' });
    }
  });
  
  // Alias for the frontend
  app.get('/api/social/linkedin/auth', async (req, res) => {
    try {
      return await startLinkedInConnect(req, res, 'url');
    } catch (error) {
      console.error('Error generating LinkedIn auth URL:', error);
      return res.status(500).json({ message: 'Failed to generate LinkedIn auth URL' });
    }
  });

  // LinkedIn OAuth callback for login
  app.get('/api/auth/linkedin/callback', async (req, res) => {
    try {
      if (!isLinkedInAuthConfigured()) {
        res.setHeader('Content-Type', 'text/html');
        res.send(generateOAuthCallbackHTML(null, 'LinkedIn API credentials are not configured'));
        return;
      }

      const { code, state } = req.query;
      if (typeof code !== 'string') {
        res.setHeader('Content-Type', 'text/html');
        res.send(generateOAuthCallbackHTML(null, 'Authorization code is required'));
        return;
      }

      if (typeof state !== 'string' || !state.startsWith('login_')) {
        res.setHeader('Content-Type', 'text/html');
        res.send(generateOAuthCallbackHTML(null, 'Invalid LinkedIn login state'));
        return;
      }

      if (req.session.linkedinLoginState !== state) {
        res.setHeader('Content-Type', 'text/html');
        res.send(generateOAuthCallbackHTML(null, 'LinkedIn login session expired. Please try again.'));
        return;
      }

      const tokenData = await getLinkedInAccessToken(code, 'login');
      const profile = await getLinkedInUserProfile(tokenData.access_token);

      const fullName = `${profile.localizedFirstName} ${profile.localizedLastName}`.trim();
      const email = profile.email;

      let user = email ? await storage.getUserByEmail(email) : null;
      if (!user) {
        user = await storage.getUserByLinkedInId(profile.id);
      }

      if (!user) {
        const username = email || `linkedin_${profile.id}`;
        user = await storage.createUser({
          username,
          password: '',
          email: email || undefined,
          linkedinId: profile.id,
          name: fullName,
          avatarUrl: profile.profilePicture?.displayImage
        });
      } else {
        user = await storage.updateUser(user.id, {
          linkedinId: profile.id,
          email: user.email || email || undefined,
          name: user.name || fullName || undefined,
          avatarUrl: profile.profilePicture?.displayImage || user.avatarUrl || undefined
        });
      }

      await storeLinkedInConnection(user.id, profile, tokenData);

      // Session fixation defence: new session ID on privilege elevation.
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.isAnonymous = false;
      await saveSession(req);

      res.setHeader('Content-Type', 'text/html');
      res.send(generateOAuthCallbackHTML(serializeUser(user)));
    } catch (error) {
      console.error('LinkedIn OAuth callback error:', error);
      res.setHeader('Content-Type', 'text/html');
      res.send(generateOAuthCallbackHTML(null, 'LinkedIn authentication failed'));
    }
  });

  // Get LinkedIn connection status
  app.get('/api/auth/linkedin/status', async (req, res) => {
    return getLinkedInConnectionStatus(req, res);
  });
  
  // Alias for the frontend
  app.get('/api/social/linkedin/status', async (req, res) => {
    return getLinkedInConnectionStatus(req, res);
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

      // Require authenticated user from session
      if (!req.session.userId) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required to post to LinkedIn'
        });
      }
      const userIdValue = req.session.userId;

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
      // Get user from session (creates anonymous user if needed)
      const userId = await ensureUserId(req);
      
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

  // List all users — admin only. Set ADMIN_EMAILS env var to a comma-separated
  // list of emails that should have access.
  app.get('/api/users', requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const sanitizedUsers = users.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        plan: user.plan,
        createdAt: user.createdAt,
      }));
      return res.status(200).json({ users: sanitizedUsers });
    } catch (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ message: 'Failed to fetch users' });
    }
  });
  
  // Register a new user
  app.post('/api/users/register', registerIpLimiter, async (req, res) => {
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

      // Session fixation defence.
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.isAnonymous = false;
      await saveSession(req);

      return res.status(201).json({ user: serializeUser(user) });
    } catch (error) {
      console.error('Error registering user:', error);
      return res.status(500).json({ message: 'Failed to register user' });
    }
  });
  
  // Login
  app.post('/api/users/login', loginIpLimiter, async (req, res) => {
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

      if (!user.password) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }
      
      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Session fixation defence.
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.isAnonymous = false;
      await saveSession(req);

      return res.status(200).json({ user: serializeUser(user) });
    } catch (error) {
      console.error('Error logging in:', error);
      return res.status(500).json({ message: 'Failed to log in' });
    }
  });

  app.post('/api/users/logout', async (req, res) => {
    req.session.destroy((error) => {
      if (error) {
        console.error('Error logging out:', error);
        return res.status(500).json({ message: 'Failed to log out' });
      }

      res.clearCookie('connect.sid');
      return res.status(200).json({ success: true });
    });
  });

  // Mark onboarding as complete
  app.post('/api/users/onboarding-complete', async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      await storage.updateUser(userId, { hasSeenOnboarding: true });
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error marking onboarding complete:', error);
      return res.status(500).json({ message: 'Failed to update onboarding status' });
    }
  });

  // Get user's social connections
  app.get('/api/users/:userId/social-connections', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const userId = parseInt(req.params.userId);
      if (isNaN(userId)) {
        return res.status(400).json({ message: 'Invalid user ID' });
      }

      if (req.session.userId !== userId) {
        return res.status(403).json({ message: 'You do not have access to these connections' });
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
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const connectionId = parseInt(req.params.connectionId);
      if (isNaN(connectionId)) {
        return res.status(400).json({ message: 'Invalid connection ID' });
      }
      
      // Check if connection exists
      const connection = await storage.getSocialConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: 'Connection not found' });
      }

      if (connection.userId !== req.session.userId) {
        return res.status(403).json({ message: 'You do not have access to this connection' });
      }
      
      // Delete connection
      await storage.deleteSocialConnection(connectionId);
      
      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting social connection:', error);
      return res.status(500).json({ message: 'Failed to delete social connection' });
    }
  });

  // ============ TWITTER/X INTEGRATION ============

  // Check if Twitter is configured
  app.get('/api/social/twitter/config-status', (req, res) => {
    const twitterService = require('./services/twitter');
    return res.status(200).json({
      configured: twitterService.isTwitterConfigured(),
      message: twitterService.isTwitterConfigured()
        ? 'Twitter API is configured'
        : 'Twitter API credentials not configured. Add TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET, and TWITTER_REDIRECT_URI to enable.'
    });
  });

  // Get Twitter auth URL
  app.get('/api/auth/twitter', async (req, res) => {
    try {
      const twitterService = require('./services/twitter');

      if (!twitterService.isTwitterConfigured()) {
        return res.status(400).json({
          error: 'Twitter API credentials not configured',
          configured: false
        });
      }

      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const authUrl = twitterService.getTwitterAuthUrl(req.session.userId);
      return res.status(200).json({ authUrl });
    } catch (error) {
      console.error('Error generating Twitter auth URL:', error);
      return res.status(500).json({ error: 'Failed to generate Twitter auth URL' });
    }
  });

  // Twitter OAuth callback
  app.get('/api/auth/twitter/callback', async (req, res) => {
    try {
      const twitterService = require('./services/twitter');
      const { code, state, error: oauthError } = req.query;

      if (oauthError) {
        return res.redirect(`/accounts?error=Twitter+authorization+denied`);
      }

      if (!code || !state) {
        return res.redirect('/accounts?error=Missing+authorization+code');
      }

      const result = await twitterService.handleTwitterCallback(code as string, state as string);

      // Store Twitter connection in database
      await storage.createSocialConnection({
        userId: result.userId,
        provider: 'twitter',
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        profileData: {
          id: result.twitterUserId,
          username: result.twitterUsername,
        },
      });

      res.redirect('/accounts?twitterConnected=true');
    } catch (error) {
      console.error('Twitter OAuth callback error:', error);
      res.redirect('/accounts?error=Twitter+authentication+failed');
    }
  });

  // Get Twitter connection status
  app.get('/api/social/twitter/status', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ connected: false, error: 'Not authenticated' });
      }

      const connection = await storage.getSocialConnectionByUserAndProvider(req.session.userId, 'twitter');

      if (!connection) {
        return res.status(200).json({ connected: false });
      }

      // Get username from profileData JSON
      const profileData = connection.profileData as { username?: string; id?: string } | null;

      return res.status(200).json({
        connected: true,
        username: profileData?.username || 'connected',
        connectedAt: connection.createdAt,
      });
    } catch (error) {
      console.error('Error checking Twitter status:', error);
      return res.status(500).json({ error: 'Failed to check Twitter status' });
    }
  });

  // Post a tweet
  app.post('/api/social/twitter/post', async (req, res) => {
    try {
      const twitterService = require('./services/twitter');

      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const connection = await storage.getSocialConnectionByUserAndProvider(req.session.userId, 'twitter');
      if (!connection) {
        return res.status(400).json({ error: 'Twitter account not connected' });
      }

      // Check if token needs refresh
      let accessToken = connection.accessToken;
      if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date()) {
        if (connection.refreshToken) {
          const refreshed = await twitterService.refreshTwitterToken(connection.refreshToken);
          accessToken = refreshed.accessToken;

          // Update stored tokens
          await storage.updateSocialConnection(connection.id, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
          });
        } else {
          return res.status(400).json({ error: 'Twitter token expired. Please reconnect your account.' });
        }
      }

      const result = await twitterService.postTweet(accessToken, content);

      return res.status(200).json({
        success: true,
        tweetId: result.id,
        tweetUrl: `https://twitter.com/i/status/${result.id}`,
      });
    } catch (error: any) {
      console.error('Error posting tweet:', error);
      return res.status(500).json({ error: error.message || 'Failed to post tweet' });
    }
  });

  // Post a thread
  app.post('/api/social/twitter/thread', async (req, res) => {
    try {
      const twitterService = require('./services/twitter');

      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { tweets } = req.body;
      if (!tweets || !Array.isArray(tweets) || tweets.length === 0) {
        return res.status(400).json({ error: 'Tweets array is required' });
      }

      const connection = await storage.getSocialConnectionByUserAndProvider(req.session.userId, 'twitter');
      if (!connection) {
        return res.status(400).json({ error: 'Twitter account not connected' });
      }

      // Check if token needs refresh
      let accessToken = connection.accessToken;
      if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date()) {
        if (connection.refreshToken) {
          const refreshed = await twitterService.refreshTwitterToken(connection.refreshToken);
          accessToken = refreshed.accessToken;

          await storage.updateSocialConnection(connection.id, {
            accessToken: refreshed.accessToken,
            refreshToken: refreshed.refreshToken,
            tokenExpiresAt: new Date(Date.now() + refreshed.expiresIn * 1000),
          });
        } else {
          return res.status(400).json({ error: 'Twitter token expired. Please reconnect your account.' });
        }
      }

      const result = await twitterService.postThread(accessToken, tweets);

      return res.status(200).json({
        success: true,
        tweetIds: result.ids,
        threadUrl: `https://twitter.com/i/status/${result.ids[0]}`,
      });
    } catch (error: any) {
      console.error('Error posting thread:', error);
      return res.status(500).json({ error: error.message || 'Failed to post thread' });
    }
  });

  // Update LinkedIn OAuth flow to support specifying a user
  app.get('/api/auth/linkedin/user', async (req, res) => {
    try {
      return await startLinkedInConnect(req, res, 'authUrl');
    } catch (error) {
      console.error('Error generating LinkedIn auth URL:', error);
      return res.status(500).json({ message: 'Failed to generate LinkedIn auth URL' });
    }
  });
  
  // LinkedIn OAuth callback for connect flow
  app.get('/api/auth/linkedin/user/callback', async (req, res) => {
    try {
      if (!isLinkedInAuthConfigured()) {
        return res.redirect('/accounts?error=LinkedIn+API+credentials+not+configured');
      }

      const { code, state } = req.query;
      if (typeof code !== 'string') {
        return res.redirect('/accounts?error=Authorization+code+is+required');
      }

      if (typeof state !== 'string' || !state.startsWith('connect_')) {
        return res.redirect('/accounts?error=Invalid+LinkedIn+state');
      }

      if (!req.session.userId || req.session.isAnonymous) {
        return res.redirect('/accounts?error=Please+sign+in+before+connecting+LinkedIn');
      }

      if (req.session.linkedinConnectState !== state) {
        return res.redirect('/accounts?error=LinkedIn+connection+session+expired');
      }

      const tokenData = await getLinkedInAccessToken(code, 'user');

      const profileData = await getLinkedInUserProfile(tokenData.access_token);

      await storeLinkedInConnection(req.session.userId, profileData, tokenData);
      delete req.session.linkedinConnectState;
      await saveSession(req);

      res.redirect('/accounts?linkedInConnected=true');
    } catch (error) {
      console.error('LinkedIn OAuth callback error:', error);
      res.redirect('/accounts?error=Authentication+failed');
    }
  });

  // Get current user from session
  app.get('/api/auth/me', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ user: null });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ user: null });
      }

      return res.status(200).json({ user: serializeUser(user) });
    } catch (error) {
      console.error('Error getting current user:', error);
      return res.status(500).json({ message: 'Failed to get current user' });
    }
  });

  // User Transformation History
  app.get('/api/users/me/transformations', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;
      const status = req.query.status as string | undefined;

      const transformations = await storage.getUserTransformations(req.session.userId, { limit, offset, status });
      const total = await storage.getUserTransformationCount(req.session.userId, status);

      return res.status(200).json({
        transformations,
        pagination: { limit, offset, total }
      });
    } catch (error) {
      console.error('Error fetching transformation history:', error);
      return res.status(500).json({ message: 'Failed to fetch history' });
    }
  });

  // Delete a transformation
  app.delete('/api/transformations/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const transformationId = parseInt(req.params.id);
      if (isNaN(transformationId)) {
        return res.status(400).json({ message: 'Invalid transformation ID' });
      }

      // Verify ownership before deleting
      const deleted = await storage.deleteUserTransformation(transformationId, req.session.userId);
      if (!deleted) {
        return res.status(404).json({ message: 'Transformation not found or not owned by you' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting transformation:', error);
      return res.status(500).json({ message: 'Failed to delete transformation' });
    }
  });

  // Update transformation status (draft -> posted)
  app.patch('/api/transformations/:id/status', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      const transformationId = parseInt(req.params.id);
      if (isNaN(transformationId)) {
        return res.status(400).json({ message: 'Invalid transformation ID' });
      }

      const { status, platform } = req.body;
      if (!status || !['draft', 'posted'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status. Must be "draft" or "posted".' });
      }

      const updated = await storage.updateTransformationStatus(
        transformationId,
        req.session.userId,
        status,
        platform
      );

      if (!updated) {
        return res.status(404).json({ message: 'Transformation not found or not owned by you' });
      }

      return res.status(200).json({ success: true, transformation: updated });
    } catch (error) {
      console.error('Error updating transformation status:', error);
      return res.status(500).json({ message: 'Failed to update status' });
    }
  });

  // Google OAuth Routes

  // Check if Google OAuth is configured
  app.get('/api/auth/google/config-status', (req, res) => {
    res.json({ configured: isGoogleAuthConfigured() });
  });

  // Get Google auth URL
  app.get('/api/auth/google', (req, res) => {
    try {
      if (!isGoogleAuthConfigured()) {
        return res.status(400).json({
          error: 'Google OAuth is not configured.',
          missingCredentials: true
        });
      }

      const state = genState('g');
      req.session.googleLoginState = state;
      req.session.save((err) => {
        if (err) {
          console.error('Session save failed before Google redirect:', err);
          return res.status(500).json({ message: 'Failed to prepare auth' });
        }
        const authUrl = getGoogleAuthURL({ state });
        res.status(200).json({ authUrl });
      });
    } catch (error) {
      console.error('Error generating Google auth URL:', error);
      return res.status(500).json({ message: 'Failed to generate Google auth URL' });
    }
  });

  // Get Google OAuth URL with YouTube read-only scope (for bootstrapping
  // the user's tracked creators + liked videos into the recommender).
  app.get('/api/auth/google/youtube', (req, res) => {
    try {
      if (!isGoogleAuthConfigured()) {
        return res.status(400).json({
          error: 'Google OAuth is not configured.',
          missingCredentials: true,
        });
      }
      const state = genState('yt');
      req.session.googleLoginState = state;
      req.session.save((err) => {
        if (err) {
          console.error('Session save failed before YouTube redirect:', err);
          return res.status(500).json({ message: 'Failed to prepare auth' });
        }
        const authUrl = getGoogleAuthURL({ includeYouTube: true, state });
        res.status(200).json({ authUrl });
      });
    } catch (error) {
      console.error('Error generating Google/YouTube auth URL:', error);
      return res.status(500).json({ message: 'Failed to generate auth URL' });
    }
  });

  // Google OAuth callback
  app.get('/api/auth/google/callback', async (req, res) => {
    try {
      if (!isGoogleAuthConfigured()) {
        return res.redirect('/?error=Google+OAuth+not+configured');
      }

      const { code, state } = req.query;
      if (!code) {
        return res.redirect('/?error=Authorization+code+is+required');
      }

      // CSRF defence for the OAuth flow: the state we emitted at
      // /api/auth/google{,/youtube} must match the one Google bounced back.
      const expected = req.session.googleLoginState;
      if (!expected || typeof state !== 'string' || state !== expected) {
        console.warn('Google OAuth state mismatch', { expected: !!expected, received: !!state });
        return res.redirect('/?error=Invalid+OAuth+state');
      }
      delete req.session.googleLoginState;

      // Exchange code for access token
      const tokenData = await getGoogleAccessToken(code as string);

      // Get Google user info
      const userInfo = await getGoogleUserInfo(tokenData.access_token);

      // Detect whether the user granted the YouTube read-only scope
      const grantedScopes = (tokenData as any).scope as string | undefined;
      const hasYouTubeScope = grantedScopes?.includes('youtube.readonly') ?? false;

      const tokenExpiry = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000)
        : null;

      // Check if user exists with this email
      let user = await storage.getUserByEmail(userInfo.email);

      if (!user) {
        user = await storage.createUser({
          username: userInfo.email,
          password: '',
          email: userInfo.email,
          googleId: userInfo.id,
          name: userInfo.name,
          avatarUrl: userInfo.picture,
        });
      } else if (!user.googleId) {
        await storage.updateUser(user.id, {
          googleId: userInfo.id,
          avatarUrl: userInfo.picture || user.avatarUrl || undefined,
        });
      }

      // Persist the access/refresh tokens when the YouTube scope was granted so
      // we can refresh the feed later without re-prompting the user.
      if (hasYouTubeScope) {
        await db
          .update(usersTable)
          .set({
            googleAccessToken: tokenData.access_token,
            googleRefreshToken: tokenData.refresh_token ?? undefined,
            googleTokenExpiry: tokenExpiry,
            googleScopes: grantedScopes ?? null,
          })
          .where(eq(usersTable.id, user.id));
      }

      // Set session (with regeneration to prevent session fixation).
      await regenerateSession(req);
      req.session.userId = user.id;
      req.session.isAnonymous = false;
      await saveSession(req);

      // If they granted YouTube access, kick off import in the background so
      // the user lands in the app and /creators is already populated. We don't
      // await the ingest (can take ~1s per channel) to keep the callback fast.
      if (hasYouTubeScope) {
        (async () => {
          try {
            const result = await importYouTubeForUser(user!.id, tokenData.access_token);
            console.log(`[youtube-bootstrap] user ${user!.id}: ${JSON.stringify(result)}`);
            await ingestAllYouTubeForUser(user!.id, 10);
            await tagUntagged(40);
          } catch (err: any) {
            console.error('[youtube-bootstrap] failed:', err.message);
          }
        })();
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(generateOAuthCallbackHTML(serializeUser(user)));
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.setHeader('Content-Type', 'text/html');
      res.send(generateOAuthCallbackHTML(null, 'Google authentication failed'));
    }
  });

  // ============ LINKEDIN LOGIN (OAuth for authentication) ============

  // Get LinkedIn login URL
  app.get('/api/auth/linkedin/login', (req, res) => {
    try {
      if (!isLinkedInAuthConfigured()) {
        return res.status(400).json({
          error: 'LinkedIn OAuth is not configured.',
          missingCredentials: true
        });
      }

      const state = genState('login');
      req.session.linkedinLoginState = state;
      req.session.save((error) => {
        if (error) {
          console.error('Error saving LinkedIn login session:', error);
          return res.status(500).json({ message: 'Failed to generate LinkedIn login URL' });
        }

        const authUrl = getLinkedInLoginURL(state);
        return res.status(200).json({ authUrl });
      });
    } catch (error) {
      console.error('Error generating LinkedIn login URL:', error);
      return res.status(500).json({ message: 'Failed to generate LinkedIn login URL' });
    }
  });

  // ============ IMAGE GENERATION (Pro Only) ============

  // Generate social media image
  app.post('/api/generate/image', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is Pro
      const user = await storage.getUser(req.session.userId);
      if (!user || user.plan !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for image generation' });
      }

      const { content, platform, style } = req.body;

      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const imageService = await import('./services/image-generation');

      const result = await imageService.generateSocialImage(
        content,
        platform || 'instagram',
        style || 'creative'
      );

      return res.status(200).json({
        success: true,
        imageUrl: result.url,
        revisedPrompt: result.revisedPrompt,
      });
    } catch (error: any) {
      console.error('Image generation error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate image' });
    }
  });

  // Proxy image download (to bypass CORS)
  app.get('/api/image/proxy', async (req, res) => {
    try {
      const { url } = req.query;

      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'Image URL is required' });
      }

      // Only allow OpenAI/DALL-E URLs for security
      if (!url.includes('oaidalleapiprodscus.blob.core.windows.net') && !url.includes('openai.com')) {
        return res.status(403).json({ error: 'Invalid image source' });
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch image');
      }

      const buffer = await response.arrayBuffer();
      const contentType = response.headers.get('content-type') || 'image/png';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'attachment; filename="generated-image.png"');
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error('Image proxy error:', error);
      return res.status(500).json({ error: 'Failed to download image' });
    }
  });

  // Generate thumbnail
  app.post('/api/generate/thumbnail', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is Pro
      const user = await storage.getUser(req.session.userId);
      if (!user || user.plan !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for image generation' });
      }

      const { title, description } = req.body;

      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }

      const imageService = await import('./services/image-generation');

      const result = await imageService.generateThumbnail(title, description || '');

      return res.status(200).json({
        success: true,
        imageUrl: result.url,
        revisedPrompt: result.revisedPrompt,
      });
    } catch (error: any) {
      console.error('Thumbnail generation error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate thumbnail' });
    }
  });

  // Generate custom image with prompt
  app.post('/api/generate/custom-image', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is Pro
      const user = await storage.getUser(req.session.userId);
      if (!user || user.plan !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for image generation' });
      }

      const { prompt, size, style, quality } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const imageService = await import('./services/image-generation');

      const result = await imageService.generateImage({
        prompt,
        size: size || '1024x1024',
        style: style || 'vivid',
        quality: quality || 'hd',
      });

      return res.status(200).json({
        success: true,
        imageUrl: result.url,
        revisedPrompt: result.revisedPrompt,
      });
    } catch (error: any) {
      console.error('Custom image generation error:', error);
      return res.status(500).json({ error: error.message || 'Failed to generate image' });
    }
  });

  // ============ TRENDING CONTENT ROUTES ============

  // Get trending content
  app.get('/api/trending', async (req, res) => {
    try {
      const { source, category, limit = '30', offset = '0' } = req.query;

      const content = await trendingService.getTrendingContent({
        source: source as string,
        category: category as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      return res.status(200).json({ content });
    } catch (error) {
      console.error('Error fetching trending content:', error);
      return res.status(500).json({ message: 'Failed to fetch trending content' });
    }
  });

  // Get curated viral examples — prefers items from the caller's tracked accounts
  app.get('/api/trending/curated', async (req, res) => {
    try {
      const { platform, category, limit = '20' } = req.query;
      const userId = req.session.userId;

      const virals = await trendingService.getCuratedVirals({
        platform: platform as string,
        category: category as string,
        limit: parseInt(limit as string),
        userId,
      });

      return res.status(200).json({ virals });
    } catch (error) {
      console.error('Error fetching curated virals:', error);
      return res.status(500).json({ message: 'Failed to fetch curated content' });
    }
  });

  // Get trending sources status
  app.get('/api/trending/status', async (req, res) => {
    try {
      const stats = await trendingService.getTrendingStats();
      return res.status(200).json(stats);
    } catch (error) {
      console.error('Error fetching trending stats:', error);
      return res.status(500).json({ message: 'Failed to fetch trending status' });
    }
  });

  // Refresh trending content (trigger fetch from sources)
  app.post('/api/trending/refresh', expensiveApiLimiter, async (req, res) => {
    try {
      console.log('Manual trending refresh triggered');
      const results = await trendingService.refreshAllTrending();
      return res.status(200).json({ success: true, results });
    } catch (error) {
      console.error('Error refreshing trending content:', error);
      return res.status(500).json({ message: 'Failed to refresh trending content' });
    }
  });

  // Seed curated viral posts (LinkedIn, Twitter, Instagram examples)
  app.post('/api/trending/seed-curated', expensiveApiLimiter, async (req, res) => {
    try {
      const count = await trendingService.seedCuratedVirals();
      return res.status(200).json({ success: true, count });
    } catch (error) {
      console.error('Error seeding curated virals:', error);
      return res.status(500).json({ message: 'Failed to seed curated virals' });
    }
  });

  // ============ TRACKED ACCOUNTS (competitor handles per user) ============

  const VALID_PLATFORMS = ['linkedin', 'instagram', 'tiktok', 'youtube', 'twitter'] as const;

  function normalizeHandle(platform: string, raw: string): string {
    const trimmed = raw.trim();
    try {
      const url = new URL(trimmed);
      const path = url.pathname.replace(/\/$/, '');
      if (platform === 'youtube') {
        const chan = path.match(/\/channel\/([^/]+)/);
        if (chan) return chan[1];
        const handle = path.match(/\/@([^/]+)/);
        if (handle) return handle[1];
        const custom = path.match(/\/c\/([^/]+)/);
        if (custom) return custom[1];
        const user = path.match(/\/user\/([^/]+)/);
        if (user) return user[1];
      } else if (platform === 'linkedin') {
        const m = path.match(/\/in\/([^/]+)/) || path.match(/\/company\/([^/]+)/);
        if (m) return m[1];
      } else {
        const m = path.match(/\/@?([^/]+)/);
        if (m) return m[1];
      }
    } catch {
      // not a URL; fall through
    }
    return trimmed.replace(/^@/, '');
  }

  app.get('/api/tracked-accounts', async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const accounts = await db
        .select()
        .from(trackedAccounts)
        .where(eq(trackedAccounts.userId, userId))
        .orderBy(desc(trackedAccounts.createdAt));
      return res.json({ accounts });
    } catch (err: any) {
      console.error('GET /api/tracked-accounts:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/tracked-accounts', async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const { platform, handle, displayName, profileUrl } = req.body ?? {};

      if (!platform || !VALID_PLATFORMS.includes(platform)) {
        return res.status(400).json({
          message: `platform must be one of: ${VALID_PLATFORMS.join(', ')}`,
        });
      }
      if (!handle || typeof handle !== 'string' || !handle.trim()) {
        return res.status(400).json({ message: 'handle is required' });
      }

      const normalized = normalizeHandle(platform, handle);

      const [existing] = await db
        .select()
        .from(trackedAccounts)
        .where(and(
          eq(trackedAccounts.userId, userId),
          eq(trackedAccounts.platform, platform),
          eq(trackedAccounts.handle, normalized),
        ));

      if (existing) {
        return res.status(409).json({ message: 'already tracking this account', account: existing });
      }

      const [created] = await db
        .insert(trackedAccounts)
        .values({
          userId,
          platform,
          handle: normalized,
          displayName: displayName || null,
          profileUrl: profileUrl || null,
        })
        .returning();

      return res.status(201).json({ account: created });
    } catch (err: any) {
      console.error('POST /api/tracked-accounts:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.delete('/api/tracked-accounts/:id', async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

      const deleted = await db
        .delete(trackedAccounts)
        .where(and(eq(trackedAccounts.id, id), eq(trackedAccounts.userId, userId)))
        .returning();

      if (deleted.length === 0) return res.status(404).json({ message: 'not found' });
      return res.json({ success: true });
    } catch (err: any) {
      console.error('DELETE /api/tracked-accounts:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.post('/api/tracked-accounts/:id/refresh', expensiveApiLimiter, async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const id = parseInt(req.params.id, 10);
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid id' });

      const [account] = await db
        .select()
        .from(trackedAccounts)
        .where(and(eq(trackedAccounts.id, id), eq(trackedAccounts.userId, userId)));

      if (!account) return res.status(404).json({ message: 'not found' });

      const result = await ingestForAccount(id);
      return res.json(result);
    } catch (err: any) {
      console.error('POST /api/tracked-accounts/:id/refresh:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ============ USER CONTENT PREFERENCES ============

  app.get('/api/preferences', async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const [prefs] = await db
        .select()
        .from(userContentPreferences)
        .where(eq(userContentPreferences.userId, userId));
      return res.json({ preferences: prefs ?? null });
    } catch (err: any) {
      console.error('GET /api/preferences:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  app.put('/api/preferences', async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const { niche, targetAudience, contentGoal, topics, languages } = req.body ?? {};

      const [existing] = await db
        .select()
        .from(userContentPreferences)
        .where(eq(userContentPreferences.userId, userId));

      if (existing) {
        const [updated] = await db
          .update(userContentPreferences)
          .set({
            niche: niche ?? existing.niche,
            targetAudience: targetAudience ?? existing.targetAudience,
            contentGoal: contentGoal ?? existing.contentGoal,
            topics: topics ?? existing.topics,
            languages: languages ?? existing.languages,
            updatedAt: new Date(),
          })
          .where(eq(userContentPreferences.userId, userId))
          .returning();
        return res.json({ preferences: updated });
      }

      const [created] = await db
        .insert(userContentPreferences)
        .values({
          userId,
          niche: niche ?? null,
          targetAudience: targetAudience ?? null,
          contentGoal: contentGoal ?? null,
          topics: topics ?? [],
          languages: languages ?? ['en'],
        })
        .returning();
      return res.json({ preferences: created });
    } catch (err: any) {
      console.error('PUT /api/preferences:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ============ VIRAL INGEST (Phase 2 — browser extension target) ============

  app.post('/api/viral/ingest', async (req, res) => {
    // TODO Phase 2: extension-token auth middleware, batch upsert keyed on (platform, platformPostId)
    return res.status(501).json({
      message: 'browser extension ingest endpoint — implementation pending (Phase 2)',
    });
  });

  // ============ VIRAL INTERACTIONS (feedback signals for the ranker) ============

  const INTERACTION_WEIGHTS: Record<string, number> = {
    view: 1,
    use: 5,
    copy: 3,
    like: 4,
    hide: -10,
    imported_like: 3,
  };

  app.post('/api/viral/:id/interaction', async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const id = parseInt(req.params.id, 10);
      const { action } = req.body ?? {};
      if (!Number.isFinite(id)) return res.status(400).json({ message: 'invalid viral id' });
      if (!action || !(action in INTERACTION_WEIGHTS)) {
        return res.status(400).json({
          message: `action must be one of: ${Object.keys(INTERACTION_WEIGHTS).join(', ')}`,
        });
      }

      const [viral] = await db
        .select({ id: curatedVirals.id })
        .from(curatedVirals)
        .where(eq(curatedVirals.id, id))
        .limit(1);
      if (!viral) return res.status(404).json({ message: 'viral not found' });

      const [created] = await db
        .insert(viralInteractions)
        .values({
          userId,
          viralId: id,
          action,
          weight: INTERACTION_WEIGHTS[action],
        })
        .returning();

      return res.json({ interaction: created });
    } catch (err: any) {
      console.error('POST /api/viral/:id/interaction:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ============ YOUTUBE MANUAL IMPORT ============

  app.post('/api/integrations/youtube/import', expensiveApiLimiter, async (req, res) => {
    try {
      const userId = await ensureUserId(req);
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
      if (!user?.googleAccessToken) {
        return res.status(400).json({
          message: 'YouTube not connected. Use "Connect YouTube" first.',
          authUrl: '/api/auth/google/youtube',
        });
      }
      const result = await importYouTubeForUser(userId, user.googleAccessToken);
      await ingestAllYouTubeForUser(userId, 10);
      tagUntagged(40).catch(() => {});
      return res.json(result);
    } catch (err: any) {
      console.error('POST /api/integrations/youtube/import:', err);
      return res.status(500).json({ message: err.message });
    }
  });

  // ============ BILLING / PADDLE ROUTES ============

  const PADDLE_MONTHLY_PRICE_ID = process.env.PADDLE_PRO_MONTHLY_PRICE_ID || 'pri_01kpxjxy2dypqxt85ra4fre25w';
  const PADDLE_ANNUAL_PRICE_ID = process.env.PADDLE_PRO_ANNUAL_PRICE_ID || 'pri_01kpxjy05hbs20rebcqm36tmf0';
  const PADDLE_PRICE_IDS = new Set([PADDLE_MONTHLY_PRICE_ID, PADDLE_ANNUAL_PRICE_ID]);

  const getPaddleClientToken = () => {
    const token = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || process.env.PADDLE_CLIENT_TOKEN;
    if (!token) {
      throw new Error('Paddle client token not configured');
    }

    return token;
  };

  const paddleRequest = async <T = any>(path: string, options: { method?: string; body?: Record<string, any> } = {}): Promise<T> => {
    const apiKey = process.env.PADDLE_API_KEY;
    if (!apiKey) {
      throw new Error('Paddle API key not configured');
    }

    const response = await fetch(`https://api.paddle.com${path}`, {
      method: options.method || (options.body ? 'POST' : 'GET'),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const text = await response.text();
    let payload: any = null;

    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { raw: text };
    }

    if (!response.ok) {
      const errorMessage =
        payload?.error?.detail ||
        payload?.error?.message ||
        payload?.error?.code ||
        payload?.message ||
        `Paddle request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    return payload?.data as T;
  };

  const verifyPaddleSignature = (rawBody: Buffer, signatureHeader: string, secret: string): boolean => {
    const parts = signatureHeader.split(';').map((part) => part.trim());
    const timestamp = parts.find((part) => part.startsWith('ts='))?.slice(3);
    const signatures = parts
      .filter((part) => part.startsWith('h1='))
      .map((part) => part.slice(3))
      .filter(Boolean);

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    const timestampValue = Number(timestamp);
    if (!Number.isFinite(timestampValue) || Math.abs(Math.floor(Date.now() / 1000) - timestampValue) > 300) {
      return false;
    }

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}:${rawBody.toString('utf8')}`, 'utf8')
      .digest('hex');

    return signatures.some((signature) => {
      if (signature.length !== expected.length) {
        return false;
      }

      try {
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
      } catch {
        return false;
      }
    });
  };

  const updateUserBillingState = async ({
    userId,
    customerId,
    subscriptionId,
    subscriptionStatus,
    plan,
    subscriptionEndDate,
  }: {
    userId?: number;
    customerId?: string | null;
    subscriptionId?: string | null;
    subscriptionStatus?: string | null;
    plan?: 'free' | 'pro';
    subscriptionEndDate?: Date | null;
  }) => {
    let user = userId ? await storage.getUser(userId) : undefined;

    if (!user && subscriptionId) {
      user = await storage.getUserByPaddleSubscriptionId(subscriptionId);
    }

    if (!user && customerId) {
      user = await storage.getUserByPaddleCustomerId(customerId);
    }

    if (!user) {
      return false;
    }

    const updates: Record<string, any> = {};
    if (customerId) updates.paddleCustomerId = customerId;
    if (subscriptionId) updates.paddleSubscriptionId = subscriptionId;
    if (subscriptionStatus !== undefined) updates.subscriptionStatus = subscriptionStatus || null;
    if (plan) updates.plan = plan;
    if (subscriptionEndDate !== undefined) updates.subscriptionEndDate = subscriptionEndDate;

    await storage.updateUser(user.id, updates);
    return true;
  };

  // Create Paddle checkout transaction
  app.post('/api/billing/checkout', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const { priceId } = req.body;
      if (typeof priceId !== 'string' || !PADDLE_PRICE_IDS.has(priceId)) {
        return res.status(400).json({ error: 'Invalid price ID' });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const transaction = await paddleRequest<{ id: string }>('/transactions', {
        body: {
          items: [{ price_id: priceId, quantity: 1 }],
          collection_mode: 'automatic',
          custom_data: {
            userId: String(user.id),
            app: 'content-reworker',
            plan: 'pro',
          },
        },
      });

      return res.status(200).json({
        transactionId: transaction.id,
        clientToken: getPaddleClientToken(),
      });
    } catch (error) {
      console.error('[Paddle] Checkout error:', error);
      return res.status(500).json({ error: 'Failed to create checkout transaction' });
    }
  });

  // Paddle webhook (for subscription events)
  // Note: This route uses express.raw() middleware and JSON parsing is skipped in index.ts
  app.post('/api/billing/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Paddle Webhook] PADDLE_WEBHOOK_SECRET not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    const signatureHeader = req.headers['paddle-signature'];
    if (typeof signatureHeader !== 'string') {
      return res.status(400).json({ error: 'Missing Paddle-Signature header' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
    if (!verifyPaddleSignature(rawBody, signatureHeader, webhookSecret)) {
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    try {
      const event = JSON.parse(rawBody.toString('utf8')) as {
        event_id?: string;
        event_type: string;
        data: any;
      };

      const data = event.data || {};
      const customUserId = Number(data?.custom_data?.userId);
      const resolvedUserId = Number.isInteger(customUserId) && customUserId > 0 ? customUserId : undefined;

      switch (event.event_type) {
        case 'transaction.completed': {
          await updateUserBillingState({
            userId: resolvedUserId,
            customerId: data.customer_id,
            subscriptionId: data.subscription_id,
            subscriptionStatus: 'active',
            plan: 'pro',
          });
          break;
        }
        case 'subscription.created':
        case 'subscription.activated':
        case 'subscription.trialing':
        case 'subscription.resumed':
        case 'subscription.updated': {
          const status = typeof data.status === 'string' ? data.status : 'active';
          const plan = status === 'canceled' || status === 'paused' ? 'free' : 'pro';
          const endDate = data.current_billing_period?.ends_at
            ? new Date(data.current_billing_period.ends_at)
            : undefined;

          await updateUserBillingState({
            userId: resolvedUserId,
            customerId: data.customer_id,
            subscriptionId: data.id,
            subscriptionStatus: status,
            plan,
            subscriptionEndDate: endDate,
          });
          break;
        }
        case 'subscription.past_due': {
          await updateUserBillingState({
            userId: resolvedUserId,
            customerId: data.customer_id,
            subscriptionId: data.id,
            subscriptionStatus: 'past_due',
            plan: 'pro',
          });
          break;
        }
        case 'subscription.paused':
        case 'subscription.canceled': {
          const endDate = data.current_billing_period?.ends_at
            ? new Date(data.current_billing_period.ends_at)
            : undefined;

          await updateUserBillingState({
            userId: resolvedUserId,
            customerId: data.customer_id,
            subscriptionId: data.id,
            subscriptionStatus: data.status || event.event_type.replace('subscription.', ''),
            plan: 'free',
            subscriptionEndDate: endDate,
          });
          break;
        }
        default:
          console.log(`[Paddle Webhook] Ignoring unsupported event type: ${event.event_type}`);
      }

      return res.status(200).json({ received: true });
    } catch (error: any) {
      console.error('[Paddle Webhook] Error:', error.message);
      return res.status(400).json({ error: 'Webhook processing failed', message: error.message });
    }
  });

  // Get subscription status
  app.get('/api/billing/status', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json({
        plan: user.plan || 'free',
        subscriptionStatus: user.subscriptionStatus,
        subscriptionEndDate: user.subscriptionEndDate,
      });
    } catch (error) {
      console.error('Status error:', error);
      return res.status(500).json({ error: 'Failed to get subscription status' });
    }
  });

  // Get billing portal URL
  app.post('/api/billing/portal', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await storage.getUser(req.session.userId);
      if (!user?.paddleCustomerId) {
        return res.status(400).json({ error: 'No subscription found' });
      }

      const portalSession = await paddleRequest<{
        urls?: {
          general?: {
            overview?: string;
          };
        };
      }>(`/customers/${user.paddleCustomerId}/portal-sessions`, {
        body: user.paddleSubscriptionId
          ? { subscription_ids: [user.paddleSubscriptionId] }
          : {},
      });

      const url = portalSession.urls?.general?.overview;
      if (!url) {
        return res.status(500).json({ error: 'Failed to create billing portal session' });
      }

      return res.status(200).json({ url });
    } catch (error) {
      console.error('Portal error:', error);
      return res.status(500).json({ error: 'Failed to create portal session' });
    }
  });

  // ============ SCHEDULED POSTS (Pro Feature) ============

  // Get user's scheduled posts
  app.get('/api/scheduled-posts', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const posts = await storage.getUserScheduledPosts(req.session.userId);
      return res.status(200).json({ posts });
    } catch (error) {
      console.error('Error fetching scheduled posts:', error);
      return res.status(500).json({ error: 'Failed to fetch scheduled posts' });
    }
  });

  // Create a scheduled post
  app.post('/api/scheduled-posts', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Check if user is Pro
      const user = await storage.getUser(req.session.userId);
      if (!user || user.plan !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for scheduling posts' });
      }

      const { content, platform, scheduledAt } = req.body;

      if (!content || !scheduledAt) {
        return res.status(400).json({ error: 'Content and scheduledAt are required' });
      }

      const normalizedPlatform = normalizeScheduledPlatform(platform);
      if (!normalizedPlatform) {
        return res.status(400).json({ error: 'Scheduled posts currently only support LinkedIn' });
      }

      // Validate scheduledAt is in the future
      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }

      const post = await storage.createScheduledPost({
        userId: req.session.userId,
        content,
        platform: normalizedPlatform,
        scheduledAt: scheduledDate,
        status: 'pending',
      });

      return res.status(201).json({ post });
    } catch (error) {
      console.error('Error creating scheduled post:', error);
      return res.status(500).json({ error: 'Failed to create scheduled post' });
    }
  });

  // Update a scheduled post
  app.put('/api/scheduled-posts/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ error: 'Invalid post ID' });
      }

      // Verify ownership
      const existingPost = await storage.getScheduledPost(postId);
      if (!existingPost || existingPost.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Scheduled post not found' });
      }

      // Can only edit pending posts
      if (existingPost.status !== 'pending') {
        return res.status(400).json({ error: 'Can only edit pending posts' });
      }

      const { content, platform, scheduledAt } = req.body;
      const updates: any = {};

      if (content) updates.content = content;
      if (platform !== undefined) {
        const normalizedPlatform = normalizeScheduledPlatform(platform);
        if (!normalizedPlatform) {
          return res.status(400).json({ error: 'Scheduled posts currently only support LinkedIn' });
        }
        updates.platform = normalizedPlatform;
      }
      if (scheduledAt) {
        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
          return res.status(400).json({ error: 'Scheduled time must be in the future' });
        }
        updates.scheduledAt = scheduledDate;
      }

      const post = await storage.updateScheduledPost(postId, updates);
      return res.status(200).json({ post });
    } catch (error) {
      console.error('Error updating scheduled post:', error);
      return res.status(500).json({ error: 'Failed to update scheduled post' });
    }
  });

  // Delete a scheduled post
  app.delete('/api/scheduled-posts/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const postId = parseInt(req.params.id);
      if (isNaN(postId)) {
        return res.status(400).json({ error: 'Invalid post ID' });
      }

      const deleted = await storage.deleteScheduledPost(postId, req.session.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Scheduled post not found' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting scheduled post:', error);
      return res.status(500).json({ error: 'Failed to delete scheduled post' });
    }
  });

  // ============ CONTENT PIPELINE ROUTES ============

  // Get user's pipelines
  app.get('/api/pipelines', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelines = await storage.getUserPipelines(req.session.userId);
      return res.status(200).json({ pipelines });
    } catch (error) {
      console.error('Error fetching pipelines:', error);
      return res.status(500).json({ error: 'Failed to fetch pipelines' });
    }
  });

  // Get single pipeline
  app.get('/api/pipelines/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelineId = parseInt(req.params.id);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ error: 'Invalid pipeline ID' });
      }

      const pipeline = await storage.getPipeline(pipelineId);
      if (!pipeline || pipeline.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      return res.status(200).json({ pipeline });
    } catch (error) {
      console.error('Error fetching pipeline:', error);
      return res.status(500).json({ error: 'Failed to fetch pipeline' });
    }
  });

  // Create pipeline
  app.post('/api/pipelines', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Pro only feature
      const user = await storage.getUser(req.session.userId);
      if (!user || user.plan !== 'pro') {
        return res.status(403).json({ error: 'Pro subscription required for content pipelines' });
      }

      const { name, description, topics, tone, platforms, frequency, cronExpression,
              timezone, draftsPerRun, useHashtags, useEmojis, aiProvider,
              autoGenerateMedia, preferredMediaType } = req.body;

      if (!name || !topics || !topics.length || !tone || !platforms || !platforms.length || !frequency) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const normalizedPlatforms = normalizePipelinePlatforms(platforms);
      if (!normalizedPlatforms) {
        return res.status(400).json({ error: 'Content pipelines currently support LinkedIn only' });
      }

      // Calculate initial nextRunAt
      const now = new Date();
      let nextRunAt = new Date(now);
      nextRunAt.setDate(nextRunAt.getDate() + 1);
      nextRunAt.setHours(9, 0, 0, 0);

      const pipeline = await storage.createPipeline({
        userId: req.session.userId,
        name,
        description,
        topics,
        tone,
        platforms: normalizedPlatforms,
        frequency,
        cronExpression,
        timezone: timezone || 'UTC',
        nextRunAt,
        draftsPerRun: draftsPerRun || 1,
        useHashtags: useHashtags ?? true,
        useEmojis: useEmojis ?? true,
        aiProvider: aiProvider || 'Gemini',
        autoGenerateMedia: autoGenerateMedia ?? false,
        preferredMediaType,
        status: 'active',
      });

      return res.status(201).json({ pipeline });
    } catch (error) {
      console.error('Error creating pipeline:', error);
      return res.status(500).json({ error: 'Failed to create pipeline' });
    }
  });

  // Update pipeline
  app.put('/api/pipelines/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelineId = parseInt(req.params.id);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ error: 'Invalid pipeline ID' });
      }

      const existing = await storage.getPipeline(pipelineId);
      if (!existing || existing.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      const updates = { ...req.body };
      if (updates.platforms !== undefined) {
        const normalizedPlatforms = normalizePipelinePlatforms(updates.platforms);
        if (!normalizedPlatforms) {
          return res.status(400).json({ error: 'Content pipelines currently support LinkedIn only' });
        }
        updates.platforms = normalizedPlatforms;
      }

      const pipeline = await storage.updatePipeline(pipelineId, updates);
      return res.status(200).json({ pipeline });
    } catch (error) {
      console.error('Error updating pipeline:', error);
      return res.status(500).json({ error: 'Failed to update pipeline' });
    }
  });

  // Delete pipeline (soft delete)
  app.delete('/api/pipelines/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelineId = parseInt(req.params.id);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ error: 'Invalid pipeline ID' });
      }

      const deleted = await storage.deletePipeline(pipelineId, req.session.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting pipeline:', error);
      return res.status(500).json({ error: 'Failed to delete pipeline' });
    }
  });

  // Manually trigger pipeline generation
  app.post('/api/pipelines/:id/trigger', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelineId = parseInt(req.params.id);
      if (isNaN(pipelineId)) {
        return res.status(400).json({ error: 'Invalid pipeline ID' });
      }

      const pipeline = await storage.getPipeline(pipelineId);
      if (!pipeline || pipeline.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      // Import and trigger
      const { manuallyTriggerPipeline } = await import('./services/pipeline-scheduler');
      const draftsGenerated = await manuallyTriggerPipeline(pipelineId);

      return res.status(200).json({ success: true, draftsGenerated });
    } catch (error) {
      console.error('Error triggering pipeline:', error);
      return res.status(500).json({ error: 'Failed to trigger pipeline' });
    }
  });

  // Pause pipeline
  app.post('/api/pipelines/:id/pause', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelineId = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(pipelineId);
      if (!pipeline || pipeline.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      const updated = await storage.updatePipeline(pipelineId, { status: 'paused' });
      return res.status(200).json({ pipeline: updated });
    } catch (error) {
      console.error('Error pausing pipeline:', error);
      return res.status(500).json({ error: 'Failed to pause pipeline' });
    }
  });

  // Resume pipeline
  app.post('/api/pipelines/:id/resume', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const pipelineId = parseInt(req.params.id);
      const pipeline = await storage.getPipeline(pipelineId);
      if (!pipeline || pipeline.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Pipeline not found' });
      }

      const updated = await storage.updatePipeline(pipelineId, { status: 'active' });
      return res.status(200).json({ pipeline: updated });
    } catch (error) {
      console.error('Error resuming pipeline:', error);
      return res.status(500).json({ error: 'Failed to resume pipeline' });
    }
  });

  // ============ DRAFT MANAGEMENT ROUTES ============

  // Get draft stats
  app.get('/api/drafts/stats', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const stats = await storage.getDraftStats(req.session.userId);
      return res.status(200).json({ stats });
    } catch (error) {
      console.error('Error fetching draft stats:', error);
      return res.status(500).json({ error: 'Failed to fetch draft stats' });
    }
  });

  // Get user's drafts (with optional status filter)
  app.get('/api/drafts', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const status = req.query.status as string | undefined;
      const drafts = await storage.getUserDrafts(
        req.session.userId,
        status as any
      );

      return res.status(200).json({ drafts });
    } catch (error) {
      console.error('Error fetching drafts:', error);
      return res.status(500).json({ error: 'Failed to fetch drafts' });
    }
  });

  // Get pending review drafts
  app.get('/api/drafts/pending', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const drafts = await storage.getPendingReviewDrafts(req.session.userId);
      return res.status(200).json({ drafts });
    } catch (error) {
      console.error('Error fetching pending drafts:', error);
      return res.status(500).json({ error: 'Failed to fetch pending drafts' });
    }
  });

  // Get single draft
  app.get('/api/drafts/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: 'Invalid draft ID' });
      }

      const draft = await storage.getDraft(draftId);
      if (!draft || draft.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      return res.status(200).json({ draft });
    } catch (error) {
      console.error('Error fetching draft:', error);
      return res.status(500).json({ error: 'Failed to fetch draft' });
    }
  });

  // Update draft (edit content)
  app.put('/api/drafts/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: 'Invalid draft ID' });
      }

      const existing = await storage.getDraft(draftId);
      if (!existing || existing.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      // Can only edit pending_review or approved drafts
      if (existing.status !== 'pending_review' && existing.status !== 'approved') {
        return res.status(400).json({ error: 'Cannot edit draft in current status' });
      }

      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }

      const draft = await storage.updateDraft(draftId, { content });
      return res.status(200).json({ draft });
    } catch (error) {
      console.error('Error updating draft:', error);
      return res.status(500).json({ error: 'Failed to update draft' });
    }
  });

  // Approve draft
  app.post('/api/drafts/:id/approve', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: 'Invalid draft ID' });
      }

      const existing = await storage.getDraft(draftId);
      if (!existing || existing.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      if (existing.status !== 'pending_review') {
        return res.status(400).json({ error: 'Can only approve pending_review drafts' });
      }

      const draft = await storage.updateDraft(draftId, {
        status: 'approved',
        reviewedAt: new Date(),
      });

      return res.status(200).json({ draft });
    } catch (error) {
      console.error('Error approving draft:', error);
      return res.status(500).json({ error: 'Failed to approve draft' });
    }
  });

  // Reject draft
  app.post('/api/drafts/:id/reject', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: 'Invalid draft ID' });
      }

      const existing = await storage.getDraft(draftId);
      if (!existing || existing.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      if (existing.status !== 'pending_review') {
        return res.status(400).json({ error: 'Can only reject pending_review drafts' });
      }

      const { reason } = req.body;
      const draft = await storage.updateDraft(draftId, {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewNotes: reason || null,
      });

      return res.status(200).json({ draft });
    } catch (error) {
      console.error('Error rejecting draft:', error);
      return res.status(500).json({ error: 'Failed to reject draft' });
    }
  });

  // Approve and schedule draft
  app.post('/api/drafts/:id/schedule', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: 'Invalid draft ID' });
      }

      const existing = await storage.getDraft(draftId);
      if (!existing || existing.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      if (existing.status !== 'pending_review' && existing.status !== 'approved') {
        return res.status(400).json({ error: 'Can only schedule pending or approved drafts' });
      }

      const { scheduledAt } = req.body;
      if (!scheduledAt) {
        return res.status(400).json({ error: 'scheduledAt is required' });
      }

      const scheduledDate = new Date(scheduledAt);
      if (scheduledDate <= new Date()) {
        return res.status(400).json({ error: 'Scheduled time must be in the future' });
      }

      const normalizedPlatform = normalizeScheduledPlatform(existing.platform);
      if (!normalizedPlatform) {
        return res.status(400).json({ error: 'Only LinkedIn drafts can be scheduled right now' });
      }

      // Create scheduled post
      const scheduledPost = await storage.createScheduledPost({
        userId: req.session.userId,
        content: existing.content,
        platform: normalizedPlatform,
        scheduledAt: scheduledDate,
        status: 'pending',
        source: 'pipeline',
        pipelineDraftId: draftId,
        mediaId: existing.mediaId || undefined,
      });

      // Update draft status
      const draft = await storage.updateDraft(draftId, {
        status: 'scheduled',
        reviewedAt: new Date(),
        scheduledPostId: scheduledPost.id,
      });

      return res.status(200).json({ draft, scheduledPost });
    } catch (error) {
      console.error('Error scheduling draft:', error);
      return res.status(500).json({ error: 'Failed to schedule draft' });
    }
  });

  // Delete draft
  app.delete('/api/drafts/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const draftId = parseInt(req.params.id);
      if (isNaN(draftId)) {
        return res.status(400).json({ error: 'Invalid draft ID' });
      }

      const deleted = await storage.deleteDraft(draftId, req.session.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Draft not found' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting draft:', error);
      return res.status(500).json({ error: 'Failed to delete draft' });
    }
  });

  // ============ GENERATED MEDIA ROUTES ============

  // Get user's media library
  app.get('/api/media', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const type = req.query.type as string | undefined;
      const media = await storage.getUserMedia(req.session.userId, type);
      return res.status(200).json({ media });
    } catch (error) {
      console.error('Error fetching media:', error);
      return res.status(500).json({ error: 'Failed to fetch media' });
    }
  });

  // Get single media item
  app.get('/api/media/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const mediaId = parseInt(req.params.id);
      if (isNaN(mediaId)) {
        return res.status(400).json({ error: 'Invalid media ID' });
      }

      const media = await storage.getMedia(mediaId);
      if (!media || media.userId !== req.session.userId) {
        return res.status(404).json({ error: 'Media not found' });
      }

      return res.status(200).json({ media });
    } catch (error) {
      console.error('Error fetching media:', error);
      return res.status(500).json({ error: 'Failed to fetch media' });
    }
  });

  // Delete media
  app.delete('/api/media/:id', async (req, res) => {
    try {
      if (!req.session.userId) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const mediaId = parseInt(req.params.id);
      if (isNaN(mediaId)) {
        return res.status(400).json({ error: 'Invalid media ID' });
      }

      const deleted = await storage.deleteMedia(mediaId, req.session.userId);
      if (!deleted) {
        return res.status(404).json({ error: 'Media not found' });
      }

      return res.status(200).json({ success: true });
    } catch (error) {
      console.error('Error deleting media:', error);
      return res.status(500).json({ error: 'Failed to delete media' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
