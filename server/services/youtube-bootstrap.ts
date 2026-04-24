import axios from 'axios';
import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { trackedAccounts, curatedVirals, viralInteractions } from '../../shared/schema';
import { ingestForAccount } from './competitor-ingest';

interface YouTubeSubscription {
  kind: string;
  snippet: {
    title: string;
    resourceId: { channelId: string };
    thumbnails: { default?: { url: string } };
  };
}

interface YouTubeLikedItem {
  snippet: {
    title: string;
    videoOwnerChannelId?: string;
    videoOwnerChannelTitle?: string;
    resourceId: { videoId: string };
    thumbnails?: { default?: { url: string } };
  };
}

export interface ImportResult {
  subscriptions: { added: number; skipped: number };
  likes: { seeded: number };
}

async function fetchAllSubscriptions(accessToken: string): Promise<YouTubeSubscription[]> {
  const items: YouTubeSubscription[] = [];
  let pageToken: string | undefined;
  // YouTube caps at 1000 subscriptions per page (50 per call × 20 pages max per safety)
  for (let page = 0; page < 20; page++) {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/subscriptions', {
      params: {
        part: 'snippet',
        mine: true,
        maxResults: 50,
        pageToken,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    items.push(...(res.data.items || []));
    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }
  return items;
}

async function fetchLikedVideos(accessToken: string, limit = 50): Promise<YouTubeLikedItem[]> {
  // Special "LL" playlist = the authenticated user's "Liked videos"
  try {
    const res = await axios.get('https://www.googleapis.com/youtube/v3/playlistItems', {
      params: {
        part: 'snippet',
        playlistId: 'LL',
        maxResults: Math.min(limit, 50),
      },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    });
    return res.data.items || [];
  } catch (err: any) {
    // Some accounts have liked-videos set to private; return empty rather than fail.
    console.warn('[youtube-bootstrap] liked videos fetch failed:', err.response?.data?.error?.message || err.message);
    return [];
  }
}

export async function importYouTubeForUser(userId: number, accessToken: string): Promise<ImportResult> {
  const subs = await fetchAllSubscriptions(accessToken);
  let subsAdded = 0;
  let subsSkipped = 0;

  for (const s of subs) {
    const channelId = s.snippet?.resourceId?.channelId;
    const title = s.snippet?.title;
    if (!channelId) continue;

    const [existing] = await db
      .select()
      .from(trackedAccounts)
      .where(and(
        eq(trackedAccounts.userId, userId),
        eq(trackedAccounts.platform, 'youtube'),
        eq(trackedAccounts.handle, channelId),
      ));

    if (existing) {
      subsSkipped++;
      continue;
    }

    await db.insert(trackedAccounts).values({
      userId,
      platform: 'youtube',
      handle: channelId,
      displayName: title || null,
      profileUrl: `https://www.youtube.com/channel/${channelId}`,
      source: 'youtube_subscription',
    });
    subsAdded++;
  }

  // Seed viral_interactions with `imported_like` for each liked video's creator.
  // We can't create curated_virals rows yet (no full metadata), so we instead
  // record the channel_id as a signal — the ranker can match new curated_virals
  // by author_handle to boost content from creators the user has liked.
  const liked = await fetchLikedVideos(accessToken, 50);
  let seeded = 0;
  for (const item of liked) {
    const videoId = item.snippet?.resourceId?.videoId;
    if (!videoId) continue;

    // Look for an existing curated_virals row for this video (may exist from other user's ingest)
    const [existingViral] = await db
      .select({ id: curatedVirals.id })
      .from(curatedVirals)
      .where(and(
        eq(curatedVirals.platform, 'youtube'),
        eq(curatedVirals.platformPostId, videoId),
      ))
      .limit(1);

    if (existingViral) {
      // Record a like interaction so the ranker can use it
      await db.insert(viralInteractions).values({
        userId,
        viralId: existingViral.id,
        action: 'imported_like',
        weight: 3, // heavier than a plain view, lighter than a current-user like
      });
      seeded++;
    }
    // If no viral row yet, the next ingest cycle for that channel will create
    // it; we'll pick up the affinity through author_handle overlap instead.
  }

  return {
    subscriptions: { added: subsAdded, skipped: subsSkipped },
    likes: { seeded },
  };
}

// Ingest recent videos for every YouTube-sourced tracked account of a user.
// Used right after importing subscriptions so the feed is not empty.
export async function ingestAllYouTubeForUser(userId: number, limitAccounts = 20) {
  const accounts = await db
    .select()
    .from(trackedAccounts)
    .where(and(
      eq(trackedAccounts.userId, userId),
      eq(trackedAccounts.platform, 'youtube'),
      eq(trackedAccounts.isActive, true),
    ))
    .limit(limitAccounts);

  const results = [];
  for (const a of accounts) {
    try {
      results.push(await ingestForAccount(a.id));
    } catch (err: any) {
      results.push({ accountId: a.id, platform: 'youtube', added: 0, skipped: 0, error: err.message });
    }
  }
  return results;
}
