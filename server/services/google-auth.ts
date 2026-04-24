import axios from 'axios';

interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  id_token: string;
  refresh_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
}

// Google OAuth Configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://aicontentrepurposer.com';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${BASE_URL}/api/auth/google/callback`;

// Google OAuth scopes
const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile'
].join(' ');

// Generate Google OAuth URL
export function getGoogleAuthURL(): string {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('GOOGLE_CLIENT_ID is not configured');
  }

  const baseUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    scope: GOOGLE_SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    state: Math.random().toString(36).substring(2, 15),
  });

  return `${baseUrl}?${params.toString()}`;
}

// Exchange authorization code for access token
export async function getGoogleAccessToken(code: string): Promise<GoogleTokenResponse> {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    });

    return response.data;
  } catch (error: any) {
    console.error('Error getting Google access token:', error.response?.data || error.message);
    throw new Error('Failed to get Google access token');
  }
}

// Get Google user profile
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  try {
    const response = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error('Error getting Google user info:', error.response?.data || error.message);
    throw new Error('Failed to get Google user info');
  }
}

// Check if Google OAuth is configured
export function isGoogleAuthConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
