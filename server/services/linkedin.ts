import axios from 'axios';
import { storage } from '../storage';

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

interface LinkedInUserProfile {
  id: string;
  email?: string;
  localizedFirstName: string;
  localizedLastName: string;
  profilePicture?: {
    displayImage: string;
  };
}

interface LinkedInShareRequest {
  owner: string;
  text: {
    text: string;
  };
  distribution: {
    linkedInDistributionTarget: {
      visibility: string;
    };
  };
}

// LinkedIn API Configuration
const LINKEDIN_CLIENT_ID = process.env.LINKEDIN_CLIENT_ID;
const LINKEDIN_CLIENT_SECRET = process.env.LINKEDIN_CLIENT_SECRET;
const BASE_URL = process.env.BASE_URL || 'https://aicontentrepurposer.com';
const LINKEDIN_REDIRECT_URI = process.env.LINKEDIN_REDIRECT_URI || `${BASE_URL}/api/auth/linkedin/callback`;
const LINKEDIN_USER_REDIRECT_URI = process.env.LINKEDIN_USER_REDIRECT_URI || `${BASE_URL}/api/auth/linkedin/user/callback`;
// LinkedIn OAuth scopes - using OpenID Connect
// openid + profile + email for user info, w_member_social for posting
const LINKEDIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social'
].join(' ');

// Login scopes - includes posting permission so users can post right after login
const LINKEDIN_LOGIN_SCOPES = [
  'openid',
  'profile',
  'email',
  'w_member_social'  // Enable posting on login
].join(' ');

// LinkedIn requires URLs to privacy policy and terms of service
export const PRIVACY_POLICY_URL = process.env.PRIVACY_POLICY_URL || `${BASE_URL}/privacy-policy`;
export const TERMS_OF_SERVICE_URL = process.env.TERMS_OF_SERVICE_URL || `${BASE_URL}/terms-of-service`;

export type LinkedInRedirectType = 'connect' | 'user' | 'login';

function getLinkedInRedirectUri(redirectType: LinkedInRedirectType = 'connect'): string {
  if (redirectType === 'user') {
    return LINKEDIN_USER_REDIRECT_URI;
  }

  return LINKEDIN_REDIRECT_URI;
}

// Generate LinkedIn OAuth URL for connecting account (with posting permission)
export function getLinkedInAuthURL(state?: string, redirectType: 'connect' | 'user' = 'user'): string {
  const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID as string,
    redirect_uri: getLinkedInRedirectUri(redirectType),
    scope: LINKEDIN_SCOPES,
    state: state || Math.random().toString(36).substring(2, 15),
  });

  // LinkedIn requires privacy policy and terms of service URLs for API usage
  if (PRIVACY_POLICY_URL) {
    params.append('privacy_policy_url', PRIVACY_POLICY_URL);
  }
  if (TERMS_OF_SERVICE_URL) {
    params.append('terms_of_service_url', TERMS_OF_SERVICE_URL);
  }

  return `${baseUrl}?${params.toString()}`;
}

// Generate LinkedIn OAuth URL for login (uses main callback with login state)
export function getLinkedInLoginURL(state?: string): string {
  const baseUrl = 'https://www.linkedin.com/oauth/v2/authorization';
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LINKEDIN_CLIENT_ID as string,
    redirect_uri: getLinkedInRedirectUri('login'),
    scope: LINKEDIN_LOGIN_SCOPES,
    state: state || ('login_' + Math.random().toString(36).substring(2, 15)),
  });

  return `${baseUrl}?${params.toString()}`;
}

// Check if LinkedIn OAuth is configured
export function isLinkedInAuthConfigured(): boolean {
  return !!(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET);
}

// Exchange authorization code for access token
export async function getLinkedInAccessToken(code: string, redirectType: LinkedInRedirectType = 'connect'): Promise<LinkedInTokenResponse> {
  try {
    const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
      params: {
        grant_type: 'authorization_code',
        code,
        client_id: LINKEDIN_CLIENT_ID,
        client_secret: LINKEDIN_CLIENT_SECRET,
        redirect_uri: getLinkedInRedirectUri(redirectType),
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    return response.data;
  } catch (error) {
    console.error('Error getting LinkedIn access token:', error);
    throw new Error('Failed to get LinkedIn access token');
  }
}

// Get LinkedIn user profile using OpenID Connect userinfo endpoint
export async function getLinkedInUserProfile(accessToken: string): Promise<LinkedInUserProfile> {
  try {
    const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Map OpenID Connect response to our profile format
    const data = response.data;
    return {
      id: data.sub, // OpenID Connect uses 'sub' for user ID
      email: data.email, // Email from OpenID Connect
      localizedFirstName: data.given_name || data.name?.split(' ')[0] || 'User',
      localizedLastName: data.family_name || data.name?.split(' ').slice(1).join(' ') || '',
      profilePicture: data.picture ? { displayImage: data.picture } : undefined,
    };
  } catch (error: any) {
    console.error('Error getting LinkedIn user profile:', error.response?.data || error.message);
    throw new Error('Failed to get LinkedIn user profile');
  }
}

// Store LinkedIn connection in database
export async function storeLinkedInConnection(userId: number, profileData: LinkedInUserProfile, tokenData: LinkedInTokenResponse): Promise<void> {
  try {
    // Check if a connection already exists
    const existingConnection = await storage.getSocialConnectionByUserAndProvider(userId, 'linkedin');

    const connectionData = {
      userId,
      provider: 'linkedin',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || null,
      tokenExpiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      profileData: {
        id: profileData.id,
        firstName: profileData.localizedFirstName,
        lastName: profileData.localizedLastName,
      },
    };

    if (existingConnection) {
      // Update existing connection
      await storage.updateSocialConnection(existingConnection.id, connectionData);
    } else {
      // Create new connection
      await storage.createSocialConnection(connectionData);
    }
  } catch (error) {
    console.error('Error storing LinkedIn connection:', error);
    throw new Error('Failed to store LinkedIn connection');
  }
}

// Post content to LinkedIn
export async function postToLinkedIn(userId: number, content: string): Promise<{ success: boolean; shareUrn?: string; error?: string }> {
  try {
    // Get user's LinkedIn connection
    const connection = await storage.getSocialConnectionByUserAndProvider(userId, 'linkedin');
    
    if (!connection) {
      return { 
        success: false, 
        error: 'No LinkedIn connection found for this user' 
      };
    }

    // Check if token is expired
    if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt.toString()) < new Date()) {
      return { 
        success: false, 
        error: 'LinkedIn token has expired. Please reconnect your account.' 
      };
    }

    // Get the profile data with LinkedIn user ID
    const profileData = connection.profileData ? 
      (typeof connection.profileData === 'string' ? 
        JSON.parse(connection.profileData) : 
        connection.profileData as any) : 
      {};

    // Create a text share on LinkedIn
    const shareRequest: LinkedInShareRequest = {
      owner: `urn:li:person:${profileData.id}`,
      text: {
        text: content
      },
      distribution: {
        linkedInDistributionTarget: {
          visibility: "PUBLIC"
        }
      }
    };

    const response = await axios.post(
      'https://api.linkedin.com/v2/shares',
      shareRequest,
      {
        headers: {
          'Authorization': `Bearer ${connection.accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0'
        }
      }
    );

    return {
      success: true,
      shareUrn: response.data.id
    };
  } catch (error: any) {
    console.error('Error posting to LinkedIn:', error);
    return { 
      success: false, 
      error: error.response?.data?.message || 'Failed to post to LinkedIn' 
    };
  }
}
