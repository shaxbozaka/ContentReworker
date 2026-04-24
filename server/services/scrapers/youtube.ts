import axios from 'axios';

export interface FetchedVideo {
  platform: 'youtube';
  platformPostId: string;
  authorName: string;
  authorHandle: string;
  content: string;
  hook: string;
  mediaType: 'video';
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
  views: number;
  likes: number;
  comments: number;
  sourceUrl: string;
  publishedAt: Date;
  category: string;
}

function parseIso8601Duration(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  const h = parseInt(m[1] || '0', 10);
  const min = parseInt(m[2] || '0', 10);
  const s = parseInt(m[3] || '0', 10);
  return h * 3600 + min * 60 + s;
}

export async function resolveYouTubeChannelId(handleOrId: string, apiKey: string): Promise<string | null> {
  const trimmed = handleOrId.trim().replace(/^@/, '');
  if (/^UC[A-Za-z0-9_-]{22}$/.test(trimmed)) return trimmed;

  try {
    const byHandle = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { key: apiKey, part: 'id', forHandle: `@${trimmed}` },
      timeout: 10000,
    });
    const id = byHandle.data.items?.[0]?.id;
    if (id) return id;
  } catch {}

  try {
    const byUsername = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      params: { key: apiKey, part: 'id', forUsername: trimmed },
      timeout: 10000,
    });
    const id = byUsername.data.items?.[0]?.id;
    if (id) return id;
  } catch {}

  return null;
}

export async function fetchChannelRecentVideos(handleOrId: string, limit = 15): Promise<FetchedVideo[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new Error('YOUTUBE_API_KEY not configured');

  const channelId = await resolveYouTubeChannelId(handleOrId, apiKey);
  if (!channelId) throw new Error(`could not resolve channel "${handleOrId}"`);

  const search = await axios.get('https://www.googleapis.com/youtube/v3/search', {
    params: {
      key: apiKey,
      part: 'snippet',
      channelId,
      type: 'video',
      order: 'date',
      maxResults: Math.min(limit, 50),
    },
    timeout: 10000,
  });

  const ids = (search.data.items || [])
    .map((i: any) => i.id?.videoId)
    .filter(Boolean) as string[];
  if (ids.length === 0) return [];

  const videos = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
    params: { key: apiKey, part: 'snippet,statistics,contentDetails', id: ids.join(',') },
    timeout: 10000,
  });

  return (videos.data.items || []).map((v: any): FetchedVideo => {
    const s = v.snippet;
    const stats = v.statistics || {};
    const duration = parseIso8601Duration(v.contentDetails?.duration || 'PT0S');
    return {
      platform: 'youtube',
      platformPostId: v.id,
      authorName: s.channelTitle,
      authorHandle: s.channelId,
      content: `${s.title}\n\n${(s.description || '').substring(0, 500)}`,
      hook: s.title,
      mediaType: 'video',
      videoUrl: `https://www.youtube.com/embed/${v.id}`,
      thumbnailUrl:
        s.thumbnails?.maxres?.url ||
        s.thumbnails?.high?.url ||
        s.thumbnails?.medium?.url ||
        s.thumbnails?.default?.url ||
        '',
      duration,
      views: parseInt(stats.viewCount || '0', 10),
      likes: parseInt(stats.likeCount || '0', 10),
      comments: parseInt(stats.commentCount || '0', 10),
      sourceUrl: `https://www.youtube.com/watch?v=${v.id}`,
      publishedAt: new Date(s.publishedAt),
      category: 'general',
    };
  });
}
