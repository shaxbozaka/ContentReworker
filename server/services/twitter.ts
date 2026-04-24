/**
 * Twitter/X OAuth 2.0 Integration Service
 *
 * To enable Twitter integration:
 * 1. Create a Twitter Developer account at https://developer.twitter.com
 * 2. Create a new App with OAuth 2.0 enabled
 * 3. Set callback URL to: https://aicontentrepurposer.com/api/auth/twitter/callback
 * 4. Add these env vars:
 *    - TWITTER_CLIENT_ID
 *    - TWITTER_CLIENT_SECRET
 *    - TWITTER_REDIRECT_URI
 */

import crypto from 'crypto';

// Twitter OAuth 2.0 endpoints
const TWITTER_AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TWITTER_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const TWITTER_API_URL = 'https://api.twitter.com/2';

// PKCE helper functions
function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Store PKCE verifiers temporarily (in production, use Redis or DB)
const pkceStore = new Map<string, { verifier: string; state: string; userId: number }>();

export function isTwitterConfigured(): boolean {
  return !!(
    process.env.TWITTER_CLIENT_ID &&
    process.env.TWITTER_CLIENT_SECRET &&
    process.env.TWITTER_REDIRECT_URI
  );
}

export function getTwitterAuthUrl(userId: number): string {
  if (!isTwitterConfigured()) {
    throw new Error('Twitter API credentials not configured');
  }

  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);

  // Store PKCE data
  pkceStore.set(state, { verifier: codeVerifier, state, userId });

  // Clean up old entries after 10 minutes
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.TWITTER_CLIENT_ID!,
    redirect_uri: process.env.TWITTER_REDIRECT_URI!,
    scope: 'tweet.read tweet.write users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `${TWITTER_AUTH_URL}?${params.toString()}`;
}

export async function handleTwitterCallback(
  code: string,
  state: string
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: number;
  twitterUserId: string;
  twitterUsername: string;
}> {
  const pkceData = pkceStore.get(state);
  if (!pkceData) {
    throw new Error('Invalid state parameter - possible CSRF attack');
  }

  pkceStore.delete(state);

  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;
  const redirectUri = process.env.TWITTER_REDIRECT_URI!;

  // Exchange code for tokens
  const tokenResponse = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: pkceData.verifier,
    }),
  });

  if (!tokenResponse.ok) {
    const error = await tokenResponse.text();
    console.error('Twitter token exchange failed:', error);
    throw new Error('Failed to exchange authorization code for tokens');
  }

  const tokens = await tokenResponse.json();

  // Get user info
  const userResponse = await fetch(`${TWITTER_API_URL}/users/me`, {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get Twitter user info');
  }

  const userData = await userResponse.json();

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresIn: tokens.expires_in,
    userId: pkceData.userId,
    twitterUserId: userData.data.id,
    twitterUsername: userData.data.username,
  };
}

export async function refreshTwitterToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.TWITTER_CLIENT_ID!;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET!;

  const response = await fetch(TWITTER_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to refresh Twitter token');
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function postTweet(
  accessToken: string,
  text: string
): Promise<{ id: string; text: string }> {
  const response = await fetch(`${TWITTER_API_URL}/tweets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error('Twitter post failed:', error);
    throw new Error(error.detail || 'Failed to post tweet');
  }

  const data = await response.json();
  return data.data;
}

export async function postThread(
  accessToken: string,
  tweets: string[]
): Promise<{ ids: string[] }> {
  const ids: string[] = [];
  let replyToId: string | null = null;

  for (const text of tweets) {
    const body: any = { text };
    if (replyToId) {
      body.reply = { in_reply_to_tweet_id: replyToId };
    }

    const response = await fetch(`${TWITTER_API_URL}/tweets`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Twitter thread post failed:', error);
      throw new Error(`Failed to post tweet ${ids.length + 1} in thread`);
    }

    const data = await response.json();
    ids.push(data.data.id);
    replyToId = data.data.id;
  }

  return { ids };
}

export async function getTwitterUserInfo(accessToken: string): Promise<{
  id: string;
  name: string;
  username: string;
  profileImageUrl?: string;
}> {
  const response = await fetch(`${TWITTER_API_URL}/users/me?user.fields=profile_image_url`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to get Twitter user info');
  }

  const data = await response.json();
  return {
    id: data.data.id,
    name: data.data.name,
    username: data.data.username,
    profileImageUrl: data.data.profile_image_url,
  };
}
