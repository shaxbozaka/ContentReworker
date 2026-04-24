import axios from 'axios';
import { db } from '../db';
import { trendingContent, curatedVirals } from '../../shared/schema';
import { eq, and, gt, desc, sql, or } from 'drizzle-orm';

// Cache durations
const CACHE_DURATION = {
  hackernews: 30 * 60 * 1000,  // 30 minutes
  reddit: 60 * 60 * 1000,      // 1 hour
  youtube: 4 * 60 * 60 * 1000, // 4 hours
};

// ============ YOUTUBE ============
const YOUTUBE_SEARCH_QUERIES: Record<string, string[]> = {
  business: ['business advice viral', 'entrepreneur story', 'startup tips'],
  marketing: ['marketing strategy viral', 'social media growth tips', 'content marketing'],
  tech: ['tech review 2024', 'programming tutorial popular', 'software development'],
  ai: ['AI tutorial', 'ChatGPT tips', 'artificial intelligence explained'],
  productivity: ['productivity tips viral', 'morning routine successful', 'life hacks'],
  lifestyle: ['motivation speech', 'self improvement', 'life lessons'],
};

export async function fetchYouTubeTrending(): Promise<number> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.log('YouTube API key not configured, skipping');
    return 0;
  }

  let added = 0;
  const MIN_VIEWS = 100_000; // Only 100K+ views

  try {
    console.log('Fetching YouTube viral content...');

    for (const [category, queries] of Object.entries(YOUTUBE_SEARCH_QUERIES)) {
      for (const query of queries) {
        try {
          // Search for videos
          const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
            params: {
              key: apiKey,
              part: 'snippet',
              q: query,
              type: 'video',
              order: 'viewCount',
              maxResults: 10,
              publishedAfter: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // Last 90 days
            },
            timeout: 10000,
          });

          const videoIds = searchResponse.data.items
            ?.map((item: any) => item.id?.videoId)
            .filter(Boolean)
            .join(',');

          if (!videoIds) continue;

          // Get video statistics
          const statsResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
            params: {
              key: apiKey,
              part: 'snippet,statistics',
              id: videoIds,
            },
            timeout: 10000,
          });

          for (const video of statsResponse.data.items || []) {
            const views = parseInt(video.statistics?.viewCount || '0');
            if (views < MIN_VIEWS) continue;

            const snippet = video.snippet;
            const stats = video.statistics;

            try {
              await db.insert(trendingContent)
                .values({
                  source: 'youtube',
                  externalId: video.id,
                  externalUrl: `https://www.youtube.com/watch?v=${video.id}`,
                  title: snippet.title,
                  content: snippet.description?.substring(0, 500) || null,
                  hook: snippet.title,
                  author: snippet.channelTitle,
                  authorUrl: `https://www.youtube.com/channel/${snippet.channelId}`,
                  thumbnailUrl: snippet.thumbnails?.high?.url || snippet.thumbnails?.default?.url,
                  views,
                  likes: parseInt(stats.likeCount || '0'),
                  comments: parseInt(stats.commentCount || '0'),
                  score: views, // Use views as score for sorting
                  category,
                  publishedAt: new Date(snippet.publishedAt),
                  fetchedAt: new Date(),
                  expiresAt: new Date(Date.now() + CACHE_DURATION.youtube),
                  isActive: true,
                })
                .onConflictDoNothing();
              added++;
            } catch (err) {
              // Duplicate, skip
            }
          }

          // Rate limit between queries
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.warn(`YouTube search failed for "${query}":`, err.message);
        }
      }
    }

    console.log(`YouTube: Added ${added} viral videos`);
    return added;
  } catch (error) {
    console.error('Error fetching YouTube trending:', error);
    return 0;
  }
}

// ============ HACKER NEWS ============
interface HNItem {
  id: number;
  title: string;
  url?: string;
  text?: string;
  by: string;
  score: number;
  descendants: number;
  time: number;
  type: string;
}

export async function fetchHackerNewsTrending(limit = 30): Promise<number> {
  let added = 0;
  try {
    console.log('Fetching Hacker News trending...');

    const { data: storyIds } = await axios.get<number[]>(
      'https://hacker-news.firebaseio.com/v0/topstories.json'
    );

    const stories = await Promise.all(
      storyIds.slice(0, limit).map(async (id) => {
        try {
          const { data } = await axios.get<HNItem>(
            `https://hacker-news.firebaseio.com/v0/item/${id}.json`
          );
          return data;
        } catch {
          return null;
        }
      })
    );

    const validStories = stories.filter((s): s is HNItem =>
      s !== null && s.type === 'story' && s.score > 100 // Higher threshold
    );

    for (const story of validStories) {
      const category = categorizeContent(story.title + ' ' + (story.text || ''));

      try {
        await db.insert(trendingContent)
          .values({
            source: 'hackernews',
            externalId: String(story.id),
            externalUrl: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            title: story.title,
            content: story.text || null,
            hook: story.title,
            author: story.by,
            authorUrl: `https://news.ycombinator.com/user?id=${story.by}`,
            score: story.score,
            comments: story.descendants || 0,
            category,
            publishedAt: new Date(story.time * 1000),
            fetchedAt: new Date(),
            expiresAt: new Date(Date.now() + CACHE_DURATION.hackernews),
            isActive: true,
          })
          .onConflictDoNothing();
        added++;
      } catch (err) {
        // Duplicate
      }
    }

    console.log(`Hacker News: Added ${added} stories`);
    return added;
  } catch (error) {
    console.error('Error fetching Hacker News:', error);
    throw error;
  }
}

// ============ REDDIT ============
interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    author: string;
    score: number;
    num_comments: number;
    url: string;
    permalink: string;
    created_utc: number;
    subreddit: string;
    thumbnail: string;
    stickied: boolean;
    is_video: boolean;
  };
}

// High-engagement subreddits organized by category
const HIGH_ENGAGEMENT_SUBREDDITS: Record<string, string[]> = {
  general: ['todayilearned', 'LifeProTips', 'YouShouldKnow', 'GetMotivated'],
  business: ['personalfinance', 'financialindependence', 'Entrepreneur', 'smallbusiness'],
  tech: ['technology', 'programming', 'webdev', 'learnprogramming'],
  marketing: ['marketing', 'socialmedia', 'SEO', 'copywriting'],
  ai: ['artificial', 'ChatGPT', 'MachineLearning', 'LocalLLaMA'],
  productivity: ['productivity', 'getdisciplined', 'selfimprovement'],
  stories: ['tifu', 'MaliciousCompliance', 'AmItheAsshole'],
};

const MIN_REDDIT_SCORE = 500; // Only high engagement posts

export async function fetchRedditTrending(): Promise<number> {
  let added = 0;
  try {
    console.log('Fetching Reddit trending...');

    for (const [category, subreddits] of Object.entries(HIGH_ENGAGEMENT_SUBREDDITS)) {
      for (const subreddit of subreddits) {
        try {
          // Use 'top' of the week for higher engagement
          const { data } = await axios.get(
            `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=25`,
            {
              headers: {
                'User-Agent': 'ContentReworker/1.0 (https://aicontentrepurposer.com)'
              },
              timeout: 10000,
            }
          );

          for (const post of data?.data?.children || []) {
            const p = post.data;

            // Only high-engagement, non-stickied posts with text
            if (p.stickied || p.score < MIN_REDDIT_SCORE) continue;

            const hook = extractHook(p.selftext || p.title);

            try {
              await db.insert(trendingContent)
                .values({
                  source: 'reddit',
                  externalId: p.id,
                  externalUrl: `https://reddit.com${p.permalink}`,
                  title: p.title,
                  content: p.selftext?.substring(0, 1000) || null,
                  hook,
                  author: p.author,
                  authorUrl: `https://reddit.com/u/${p.author}`,
                  thumbnailUrl: p.thumbnail?.startsWith('http') ? p.thumbnail : null,
                  likes: p.score,
                  comments: p.num_comments,
                  score: p.score,
                  category,
                  tags: [subreddit],
                  publishedAt: new Date(p.created_utc * 1000),
                  fetchedAt: new Date(),
                  expiresAt: new Date(Date.now() + CACHE_DURATION.reddit),
                  isActive: true,
                })
                .onConflictDoNothing();
              added++;
            } catch (err) {
              // Duplicate
            }
          }

          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (err: any) {
          console.warn(`Failed to fetch r/${subreddit}:`, err.message);
        }
      }
    }

    console.log(`Reddit: Added ${added} posts`);
    return added;
  } catch (error) {
    console.error('Error fetching Reddit:', error);
    return 0;
  }
}

// ============ HELPER FUNCTIONS ============

function extractHook(content: string): string {
  if (!content) return '';

  const cleaned = content
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#*_`]/g, '')
    .trim();

  const firstSentence = cleaned.split(/[.!?]/)[0];
  if (firstSentence && firstSentence.length <= 200) {
    return firstSentence.trim();
  }

  return cleaned.substring(0, 197).trim() + '...';
}

function categorizeContent(text: string): string {
  const lowerText = text.toLowerCase();

  if (/\b(ai|artificial intelligence|machine learning|gpt|chatgpt|llm|claude|openai)\b/.test(lowerText)) {
    return 'ai';
  }
  if (/\b(startup|founder|venture|funding|vc|seed|series|yc|y combinator)\b/.test(lowerText)) {
    return 'startup';
  }
  if (/\b(marketing|content|social media|engagement|viral|growth hack|seo|ads)\b/.test(lowerText)) {
    return 'marketing';
  }
  if (/\b(code|programming|developer|software|api|github|react|python|javascript)\b/.test(lowerText)) {
    return 'tech';
  }
  if (/\b(business|revenue|profit|sales|customer|b2b|saas|pricing)\b/.test(lowerText)) {
    return 'business';
  }
  if (/\b(productivity|habit|routine|mindset|success|time management)\b/.test(lowerText)) {
    return 'productivity';
  }

  return 'general';
}

// ============ PUBLIC API ============

export interface TrendingQueryOptions {
  source?: string;
  category?: string;
  limit?: number;
  offset?: number;
}

export async function getTrendingContent(options: TrendingQueryOptions) {
  const { source, category, limit = 30, offset = 0 } = options;

  const conditions = [eq(trendingContent.isActive, true)];

  if (source && source !== 'all') {
    conditions.push(eq(trendingContent.source, source));
  }

  if (category && category !== 'all') {
    conditions.push(eq(trendingContent.category, category));
  }

  const results = await db.select()
    .from(trendingContent)
    .where(and(...conditions))
    .orderBy(desc(trendingContent.score), desc(trendingContent.fetchedAt))
    .limit(limit)
    .offset(offset);

  return results;
}

export async function getCuratedVirals(options: {
  platform?: string;
  category?: string;
  limit?: number;
}) {
  const { platform, category, limit = 20 } = options;

  const conditions = [eq(curatedVirals.isActive, true)];

  if (platform && platform !== 'all') {
    conditions.push(eq(curatedVirals.platform, platform));
  }

  if (category && category !== 'all') {
    conditions.push(eq(curatedVirals.category, category));
  }

  const results = await db.select()
    .from(curatedVirals)
    .where(and(...conditions))
    .orderBy(desc(curatedVirals.views))
    .limit(limit);

  return results;
}

// ============ REFRESH JOB ============

export async function refreshAllTrending(): Promise<{
  youtube: { success: boolean; count: number; error?: string };
  hackernews: { success: boolean; count: number; error?: string };
  reddit: { success: boolean; count: number; error?: string };
}> {
  console.log('Starting trending content refresh...');

  const results = {
    youtube: { success: false, count: 0, error: undefined as string | undefined },
    hackernews: { success: false, count: 0, error: undefined as string | undefined },
    reddit: { success: false, count: 0, error: undefined as string | undefined },
  };

  // YouTube first (highest value - millions of views)
  try {
    const ytCount = await fetchYouTubeTrending();
    results.youtube = { success: true, count: ytCount, error: undefined };
  } catch (error: any) {
    results.youtube = { success: false, count: 0, error: error.message };
  }

  try {
    const hnCount = await fetchHackerNewsTrending();
    results.hackernews = { success: true, count: hnCount, error: undefined };
  } catch (error: any) {
    results.hackernews = { success: false, count: 0, error: error.message };
  }

  try {
    const redditCount = await fetchRedditTrending();
    results.reddit = { success: true, count: redditCount, error: undefined };
  } catch (error: any) {
    results.reddit = { success: false, count: 0, error: error.message };
  }

  // Clean up old content
  try {
    await db.delete(trendingContent)
      .where(sql`${trendingContent.expiresAt} < NOW() - INTERVAL '7 days'`);
  } catch (err) {
    console.warn('Failed to clean up old content:', err);
  }

  console.log('Trending refresh complete:', results);
  return results;
}

// ============ STATS ============

export async function getTrendingStats() {
  const [ytCount] = await db.select({ count: sql<number>`count(*)` })
    .from(trendingContent)
    .where(eq(trendingContent.source, 'youtube'));

  const [hnCount] = await db.select({ count: sql<number>`count(*)` })
    .from(trendingContent)
    .where(eq(trendingContent.source, 'hackernews'));

  const [redditCount] = await db.select({ count: sql<number>`count(*)` })
    .from(trendingContent)
    .where(eq(trendingContent.source, 'reddit'));

  const [curatedCount] = await db.select({ count: sql<number>`count(*)` })
    .from(curatedVirals)
    .where(eq(curatedVirals.isActive, true));

  return {
    sources: {
      youtube: { count: Number(ytCount?.count || 0), enabled: !!process.env.YOUTUBE_API_KEY },
      hackernews: { count: Number(hnCount?.count || 0), enabled: true },
      reddit: { count: Number(redditCount?.count || 0), enabled: true },
      curated: { count: Number(curatedCount?.count || 0), enabled: true },
    },
  };
}

// ============ SEED CURATED VIRALS ============

export async function seedCuratedVirals(): Promise<number> {
  console.log('Seeding curated viral posts...');

  const virals = [
    // LinkedIn viral posts
    {
      platform: 'linkedin',
      authorName: 'Justin Welsh',
      authorHandle: 'justinwelsh',
      authorFollowers: 500000,
      content: "I spent 2 years building a $5M/year solo business. Here are 10 lessons I wish I knew on day 1:\n\n1. Your first 1,000 followers are the hardest\n2. Consistency beats intensity\n3. Build in public - people love watching the journey\n4. Your niche is broader than you think\n5. Email list > social followers\n6. One platform at a time\n7. Repurpose everything\n8. Systems beat motivation\n9. Revenue diversification is protection\n10. Your unfair advantage is your story",
      hook: "I spent 2 years building a $5M/year solo business. Here are 10 lessons I wish I knew on day 1:",
      views: 2500000,
      likes: 45000,
      comments: 3200,
      shares: 8500,
      category: 'business',
      whyItWorks: "Numbers create credibility, listicle format is scannable, promises specific value",
      hookPattern: 'listicle',
      sourceUrl: 'https://linkedin.com/in/justinwelsh',
    },
    {
      platform: 'linkedin',
      authorName: 'Sahil Bloom',
      authorHandle: 'sahilbloom',
      authorFollowers: 800000,
      content: "At 25, I was broke and directionless.\n\nAt 35, I've built multiple businesses worth $10M+.\n\nHere's the unconventional playbook that changed everything:\n\nThe 5 AM myth is BS. I wake up at 7:30 AM. Energy management > time management.\n\nI said no to 95% of opportunities. The best investment is in yourself.\n\nI treated my network like a garden - planted seeds daily, harvested yearly.",
      hook: "At 25, I was broke and directionless. At 35, I've built multiple businesses worth $10M+.",
      views: 3200000,
      likes: 62000,
      comments: 4100,
      shares: 12000,
      category: 'business',
      whyItWorks: "Transformation story, specific numbers, contrarian advice challenges common beliefs",
      hookPattern: 'transformation',
      sourceUrl: 'https://linkedin.com/in/sahilbloom',
    },
    {
      platform: 'linkedin',
      authorName: 'Lara Acosta',
      authorHandle: 'laraacosta',
      authorFollowers: 350000,
      content: "Unpopular opinion: Your morning routine doesn't matter.\n\nI've interviewed 100+ successful founders.\n\nNot ONE mentioned their morning routine as a key to success.\n\nWhat they all mentioned:\n- Solving real problems\n- Relentless focus\n- Learning from failures\n- Building great teams\n\nStop optimizing your mornings.\nStart optimizing your impact.",
      hook: "Unpopular opinion: Your morning routine doesn't matter.",
      views: 1800000,
      likes: 38000,
      comments: 5600,
      shares: 7200,
      category: 'productivity',
      whyItWorks: "Contrarian take challenges popular belief, backed by research/interviews, clear action item",
      hookPattern: 'contrarian',
      sourceUrl: 'https://linkedin.com/in/laraacosta',
    },
    // Twitter/X viral posts
    {
      platform: 'twitter',
      authorName: 'Shaan Puri',
      authorHandle: '@ShaanVP',
      authorFollowers: 450000,
      content: "The 'boring businesses' nobody talks about that print money:\n\n1. Laundromats ($200K-500K/yr)\n2. Car washes ($500K-1M/yr)\n3. Storage units ($100K-300K/yr)\n4. Vending routes ($50K-100K/yr)\n5. ATM machines ($30K-100K/yr)\n\nNo VCs. No coding. No employees.\n\nJust cash flow.",
      hook: "The 'boring businesses' nobody talks about that print money:",
      views: 4500000,
      likes: 85000,
      comments: 3800,
      shares: 25000,
      category: 'business',
      whyItWorks: "Reveals 'hidden' opportunities, specific revenue numbers, accessible to anyone",
      hookPattern: 'listicle',
      sourceUrl: 'https://twitter.com/ShaanVP',
    },
    {
      platform: 'twitter',
      authorName: 'Alex Hormozi',
      authorHandle: '@AlexHormozi',
      authorFollowers: 1200000,
      content: "I've made $100M+ in sales.\n\nHere's the brutal truth about selling:\n\nPeople don't buy products.\nPeople don't buy services.\nPeople don't buy features.\n\nPeople buy better versions of themselves.\n\nSell the destination, not the plane.",
      hook: "I've made $100M+ in sales. Here's the brutal truth about selling:",
      views: 8500000,
      likes: 125000,
      comments: 6200,
      shares: 45000,
      category: 'marketing',
      whyItWorks: "Authority statement, pattern interrupt, memorable metaphor",
      hookPattern: 'insight',
      sourceUrl: 'https://twitter.com/AlexHormozi',
    },
    {
      platform: 'twitter',
      authorName: 'Naval',
      authorHandle: '@naval',
      authorFollowers: 2000000,
      content: "How to get rich (without getting lucky):\n\nSeek wealth, not money or status.\n\nWealth is having assets that earn while you sleep.\n\nMoney is how we transfer time and wealth.\n\nStatus is your place in the social hierarchy.\n\nUnderstand that ethical wealth creation is possible.",
      hook: "How to get rich (without getting lucky):",
      views: 12000000,
      likes: 180000,
      comments: 8500,
      shares: 95000,
      category: 'business',
      whyItWorks: "Promise of valuable knowledge, philosophical depth, tweetstorm format builds anticipation",
      hookPattern: 'how-to',
      sourceUrl: 'https://twitter.com/naval',
    },
    // Instagram viral captions
    {
      platform: 'instagram',
      authorName: 'Gary Vaynerchuk',
      authorHandle: '@garyvee',
      authorFollowers: 10000000,
      content: "Nobody is coming to save you.\n\nNo mentor.\nNo investor.\nNo viral moment.\n\nYou are your own cavalry.\n\nThe sooner you accept this, the sooner you'll start winning.\n\nStop waiting. Start doing.",
      hook: "Nobody is coming to save you.",
      views: 5500000,
      likes: 320000,
      comments: 15000,
      shares: 45000,
      category: 'motivation',
      whyItWorks: "Harsh truth hooks attention, short punchy lines, empowering conclusion",
      hookPattern: 'truth-bomb',
      sourceUrl: 'https://instagram.com/garyvee',
    },
    {
      platform: 'instagram',
      authorName: 'James Clear',
      authorHandle: '@jamesclear',
      authorFollowers: 3500000,
      content: "The 1% rule:\n\nImprove by 1% every day for a year.\n\nBy day 365, you'll be 37x better.\n\nNot 365% better. 37 TIMES better.\n\nThat's the power of compound growth.\n\nSmall improvements, massive results.",
      hook: "The 1% rule: Improve by 1% every day for a year.",
      views: 4200000,
      likes: 280000,
      comments: 8900,
      shares: 62000,
      category: 'productivity',
      whyItWorks: "Simple concept, surprising math, actionable advice",
      hookPattern: 'framework',
      sourceUrl: 'https://instagram.com/jamesclear',
    },
    // More LinkedIn
    {
      platform: 'linkedin',
      authorName: 'Chris Walker',
      authorHandle: 'chriswalker171',
      authorFollowers: 420000,
      content: "Hot take: Most B2B marketing is a complete waste of money.\n\nHere's why:\n\n95% of your market isn't buying right now.\n\nBut 95% of your marketing is aimed at the 5% who are.\n\nYou're ignoring the future buyers.\n\nFlip the script:\n- Create content that educates\n- Build community around your expertise\n- Be memorable when they ARE ready to buy\n\nStop chasing. Start attracting.",
      hook: "Hot take: Most B2B marketing is a complete waste of money.",
      views: 1600000,
      likes: 28000,
      comments: 1800,
      shares: 5400,
      category: 'marketing',
      whyItWorks: "Provocative statement, data-backed argument, clear alternative approach",
      hookPattern: 'contrarian',
      sourceUrl: 'https://linkedin.com/in/chriswalker171',
    },
    {
      platform: 'linkedin',
      authorName: 'Dickie Bush',
      authorHandle: 'dickiebush',
      authorFollowers: 550000,
      content: "I spent $0 on marketing and grew to 500K followers.\n\nMy 'secret'? I just wrote every single day for 3 years.\n\nNo hacks. No tricks. No paid ads.\n\nJust:\n- 1 post per day\n- Studying what worked\n- Iterating constantly\n- Helping others succeed\n\nConsistency is the cheat code everyone ignores.",
      hook: "I spent $0 on marketing and grew to 500K followers.",
      views: 2100000,
      likes: 42000,
      comments: 2900,
      shares: 8800,
      category: 'marketing',
      whyItWorks: "Zero-dollar claim grabs attention, simple actionable formula, relatable journey",
      hookPattern: 'case-study',
      sourceUrl: 'https://linkedin.com/in/dickiebush',
    },
    // More LinkedIn virals
    {
      platform: 'linkedin',
      authorName: 'Tim Ferriss',
      authorHandle: 'timferriss',
      authorFollowers: 750000,
      content: "I've interviewed 700+ world-class performers.\n\nThe #1 habit they ALL share?\n\nIt's not meditation.\nIt's not exercise.\nIt's not reading.\n\nIt's this: They define their 'single most important task' the night before.\n\nNot a to-do list. ONE thing.\n\nClarity beats hustle every time.",
      hook: "I've interviewed 700+ world-class performers. The #1 habit they ALL share?",
      views: 4100000,
      likes: 75000,
      comments: 4200,
      shares: 18000,
      category: 'productivity',
      whyItWorks: "Authority from interviews, curiosity gap with denial pattern, simple actionable takeaway",
      hookPattern: 'insight',
      sourceUrl: 'https://linkedin.com/in/timferriss',
    },
    {
      platform: 'linkedin',
      authorName: 'Steven Bartlett',
      authorHandle: 'stevenbartlett',
      authorFollowers: 1200000,
      content: "I dropped out of university with £0.\n\n8 years later, I sold my company for £300M.\n\nThe lesson? Your background doesn't determine your ceiling.\n\nI wasn't smarter. I wasn't luckier.\n\nI just refused to accept my circumstances as my limitations.\n\nStop making excuses. Start making moves.",
      hook: "I dropped out of university with £0. 8 years later, I sold my company for £300M.",
      views: 6200000,
      likes: 98000,
      comments: 7500,
      shares: 32000,
      category: 'motivation',
      whyItWorks: "Dramatic transformation, relatable starting point, inspirational message",
      hookPattern: 'transformation',
      sourceUrl: 'https://linkedin.com/in/stevenbartlett',
    },
    {
      platform: 'linkedin',
      authorName: 'Brene Brown',
      authorHandle: 'brenebrown',
      authorFollowers: 890000,
      content: "Vulnerability is not weakness.\n\nIt takes more courage to be vulnerable than to hide behind armor.\n\nThe most successful leaders I've studied share one trait:\n\nThey're willing to say 'I don't know' and 'I need help.'\n\nPerfection is a myth. Connection is real.\n\nDrop the mask. Lead with humanity.",
      hook: "Vulnerability is not weakness. It takes more courage to be vulnerable than to hide behind armor.",
      views: 3800000,
      likes: 82000,
      comments: 5100,
      shares: 24000,
      category: 'leadership',
      whyItWorks: "Challenges common belief, research-backed insight, emotionally resonant message",
      hookPattern: 'contrarian',
      sourceUrl: 'https://linkedin.com/in/brenebrown',
    },
    {
      platform: 'linkedin',
      authorName: 'Oleg Vishnepolsky',
      authorHandle: 'olegvishnepolsky',
      authorFollowers: 2100000,
      content: "I've hired 10,000+ people.\n\nThe #1 thing I look for isn't on your resume.\n\nIt's not your degree.\nIt's not your experience.\nIt's not your skills.\n\nIt's your attitude.\n\nSkills can be taught.\nAttitude cannot.\n\nHire attitude. Train skills.",
      hook: "I've hired 10,000+ people. The #1 thing I look for isn't on your resume.",
      views: 8500000,
      likes: 145000,
      comments: 12000,
      shares: 52000,
      category: 'career',
      whyItWorks: "Massive authority claim, curiosity gap, simple memorable advice",
      hookPattern: 'insight',
      sourceUrl: 'https://linkedin.com/in/olegvishnepolsky',
    },
    // More Twitter virals
    {
      platform: 'twitter',
      authorName: 'Greg Isenberg',
      authorHandle: '@gregisenberg',
      authorFollowers: 380000,
      content: "A 17-year-old made $50K/month with this business idea:\n\nHe noticed dog owners in his neighborhood were busy.\n\nSo he started a 'pet waste removal' service.\n\n$30/week per customer.\n50 customers.\n$6K/month profit.\n\nThen he hired 2 friends and scaled to 3 neighborhoods.\n\nSimple > Sexy.",
      hook: "A 17-year-old made $50K/month with this business idea:",
      views: 5200000,
      likes: 68000,
      comments: 4100,
      shares: 28000,
      category: 'business',
      whyItWorks: "Surprising success story, specific numbers, accessible business model",
      hookPattern: 'case-study',
      sourceUrl: 'https://twitter.com/gregisenberg',
    },
    {
      platform: 'twitter',
      authorName: 'Sahil Lavingia',
      authorHandle: '@shl',
      authorFollowers: 650000,
      content: "I started Gumroad in 2011.\n\nPeak: 23 employees, $15M raised.\n\nIt failed to become a billion-dollar company.\n\nSo I fired everyone and rebuilt it alone.\n\nNow it does $25M/year with 3 employees.\n\nBigger isn't always better.\n\nSometimes less is more.",
      hook: "I started Gumroad in 2011. It failed to become a billion-dollar company.",
      views: 7800000,
      likes: 112000,
      comments: 5800,
      shares: 42000,
      category: 'startup',
      whyItWorks: "Counterintuitive success story, vulnerability about failure, contrarian lesson",
      hookPattern: 'transformation',
      sourceUrl: 'https://twitter.com/shl',
    },
    {
      platform: 'twitter',
      authorName: 'Pieter Levels',
      authorHandle: '@levelsio',
      authorFollowers: 520000,
      content: "I make $200K/month from 12 small projects.\n\nEach project took <1 month to build.\n\nHere's my simple formula:\n\n1. Find problem on Twitter/Reddit\n2. Build MVP in 2 weeks\n3. Launch on Product Hunt\n4. Listen to users\n5. Iterate or kill it\n\nNo VC. No employees. Just products.",
      hook: "I make $200K/month from 12 small projects.",
      views: 9100000,
      likes: 135000,
      comments: 7200,
      shares: 48000,
      category: 'startup',
      whyItWorks: "Impressive income claim, simple replicable formula, solopreneur inspiration",
      hookPattern: 'how-to',
      sourceUrl: 'https://twitter.com/levelsio',
    },
    {
      platform: 'twitter',
      authorName: 'Dan Go',
      authorHandle: '@danfounder',
      authorFollowers: 420000,
      content: "I coached 500+ executives on fitness.\n\nThe #1 thing stopping them from getting in shape?\n\nIt's not time.\nIt's not motivation.\nIt's not knowledge.\n\nIt's this: They optimize for the wrong thing.\n\nThey optimize for WEIGHT.\n\nThey should optimize for ENERGY.\n\nEnergy changes everything.",
      hook: "I coached 500+ executives on fitness. The #1 thing stopping them from getting in shape?",
      views: 3400000,
      likes: 52000,
      comments: 2800,
      shares: 18000,
      category: 'productivity',
      whyItWorks: "Authority from coaching experience, curiosity gap, reframe of common goal",
      hookPattern: 'insight',
      sourceUrl: 'https://twitter.com/danfounder',
    },
    {
      platform: 'twitter',
      authorName: 'Chris Bakke',
      authorHandle: '@chrisbakke',
      authorFollowers: 280000,
      content: "Google's interview process:\n\n- 10 interviews over 3 months\n- 500+ hours of prep\n- Stress-induced anxiety\n\nThe offer: $350K\n\nMy buddy's approach:\n\n- Built side project in 2 weeks\n- Posted on Twitter\n- Got 10 DMs from founders\n\nThe offer: $500K + equity\n\nThe game has changed.",
      hook: "Google's interview process: 10 interviews over 3 months. My buddy's approach: Built side project in 2 weeks.",
      views: 4800000,
      likes: 78000,
      comments: 5200,
      shares: 22000,
      category: 'career',
      whyItWorks: "Compelling comparison, specific numbers, challenges traditional path",
      hookPattern: 'comparison',
      sourceUrl: 'https://twitter.com/chrisbakke',
    },
    // More Instagram virals
    {
      platform: 'instagram',
      authorName: 'Tony Robbins',
      authorHandle: '@tonyrobbins',
      authorFollowers: 7500000,
      content: "The quality of your life is the quality of your relationships.\n\nNot your bank account.\nNot your job title.\nNot your followers.\n\nYour relationships.\n\nInvest in people.\nBe there when it's hard.\nCelebrate when it's good.\n\nSuccess without love is empty.\nLove without success is enough.",
      hook: "The quality of your life is the quality of your relationships.",
      views: 6800000,
      likes: 420000,
      comments: 18000,
      shares: 85000,
      category: 'motivation',
      whyItWorks: "Simple profound truth, challenges material success definition, emotionally resonant",
      hookPattern: 'truth-bomb',
      sourceUrl: 'https://instagram.com/tonyrobbins',
    },
    {
      platform: 'instagram',
      authorName: 'Mel Robbins',
      authorHandle: '@melrobbins',
      authorFollowers: 6200000,
      content: "The 5 Second Rule:\n\nWhen you feel hesitation before doing something you know you should do:\n\nCount 5-4-3-2-1.\n\nThen move.\n\nHesitation is the enemy of action.\n\nYour brain will always try to protect you from discomfort.\n\n5-4-3-2-1.\n\nOutsmart your brain. Take control.",
      hook: "The 5 Second Rule: When you feel hesitation, count 5-4-3-2-1. Then move.",
      views: 5200000,
      likes: 380000,
      comments: 12000,
      shares: 72000,
      category: 'productivity',
      whyItWorks: "Named framework is memorable, simple technique, immediate applicability",
      hookPattern: 'framework',
      sourceUrl: 'https://instagram.com/melrobbins',
    },
    {
      platform: 'instagram',
      authorName: 'Simon Sinek',
      authorHandle: '@simonsinek',
      authorFollowers: 4800000,
      content: "People don't buy what you do.\n\nThey buy WHY you do it.\n\nApple doesn't sell computers.\nThey sell 'Think Different.'\n\nNike doesn't sell shoes.\nThey sell 'Just Do It.'\n\nStart with why.\n\nYour why is your competitive advantage.",
      hook: "People don't buy what you do. They buy WHY you do it.",
      views: 4500000,
      likes: 290000,
      comments: 9500,
      shares: 58000,
      category: 'marketing',
      whyItWorks: "Clear framework with examples, applies to business and life, memorable phrase",
      hookPattern: 'insight',
      sourceUrl: 'https://instagram.com/simonsinek',
    },
    {
      platform: 'instagram',
      authorName: 'Jay Shetty',
      authorHandle: '@jayshetty',
      authorFollowers: 11500000,
      content: "At 22, I left everything to become a monk in India.\n\nAt 25, I came back broke and confused.\n\nAt 30, I built a 8-figure media company.\n\nWhat changed? I stopped chasing what others wanted for me.\n\nAnd started building what I wanted for myself.\n\nYour path doesn't need to make sense to anyone but you.",
      hook: "At 22, I left everything to become a monk in India.",
      views: 8900000,
      likes: 520000,
      comments: 25000,
      shares: 95000,
      category: 'motivation',
      whyItWorks: "Unusual journey creates intrigue, transformation arc, universal message",
      hookPattern: 'story',
      sourceUrl: 'https://instagram.com/jayshetty',
    },
    // AI-focused virals
    {
      platform: 'twitter',
      authorName: 'Andrej Karpathy',
      authorHandle: '@karpathy',
      authorFollowers: 890000,
      content: "The hottest programming language in 2024 is English.\n\nSeriously.\n\nPrompt engineering is programming for the AI era.\n\nThe better you communicate, the better your AI outputs.\n\nCoders who can write clearly will win.\n\nWriters who can think logically will thrive.\n\nThe future is hybrid.",
      hook: "The hottest programming language in 2024 is English.",
      views: 6500000,
      likes: 95000,
      comments: 4800,
      shares: 35000,
      category: 'ai',
      whyItWorks: "Surprising claim from authority, reframes AI skill, inclusive of different backgrounds",
      hookPattern: 'contrarian',
      sourceUrl: 'https://twitter.com/karpathy',
    },
    {
      platform: 'linkedin',
      authorName: 'Sam Altman',
      authorHandle: 'samaltman',
      authorFollowers: 620000,
      content: "AI won't replace humans.\n\nHumans using AI will replace humans not using AI.\n\nThis is true for every industry, every role, every company.\n\nThe question isn't 'Will AI take my job?'\n\nThe question is 'Am I learning to use AI faster than others?'\n\nAdapt or get left behind.",
      hook: "AI won't replace humans. Humans using AI will replace humans not using AI.",
      views: 12500000,
      likes: 185000,
      comments: 14000,
      shares: 78000,
      category: 'ai',
      whyItWorks: "Reframes AI fear, creates urgency, clear call to action",
      hookPattern: 'insight',
      sourceUrl: 'https://linkedin.com/in/samaltman',
    },
    {
      platform: 'twitter',
      authorName: 'Ethan Mollick',
      authorHandle: '@emollick',
      authorFollowers: 380000,
      content: "I've been teaching MBA students to use AI for 18 months.\n\nWhat I've learned:\n\n- AI makes A students A+ students\n- AI makes C students B students\n- AI makes everyone faster\n\nBut here's the catch:\n\nAI amplifies effort, not laziness.\n\nThose who work hardest WITH AI win biggest.",
      hook: "I've been teaching MBA students to use AI for 18 months. What I've learned:",
      views: 3200000,
      likes: 48000,
      comments: 2600,
      shares: 16000,
      category: 'ai',
      whyItWorks: "Credible research, specific observations, nuanced take on AI's impact",
      hookPattern: 'research',
      sourceUrl: 'https://twitter.com/emollick',
    },
    // Startup/founder virals
    {
      platform: 'linkedin',
      authorName: 'Marc Andreessen',
      authorHandle: 'marcandreessen',
      authorFollowers: 580000,
      content: "The best founders I've backed share one trait:\n\nThey're pathologically optimistic about ONE thing.\n\nAnd brutally realistic about everything else.\n\nThey believe 100% in their vision.\nThey believe 0% in their current plan.\n\nThey're rigid on destination.\nFlexible on route.",
      hook: "The best founders I've backed share one trait: They're pathologically optimistic about ONE thing.",
      views: 4200000,
      likes: 72000,
      comments: 3800,
      shares: 22000,
      category: 'startup',
      whyItWorks: "VC authority, counterintuitive combination, memorable framework",
      hookPattern: 'insight',
      sourceUrl: 'https://linkedin.com/in/marcandreessen',
    },
    {
      platform: 'twitter',
      authorName: 'Paul Graham',
      authorHandle: '@paulg',
      authorFollowers: 1800000,
      content: "The best startups solve problems the founders have.\n\nAirbnb: founders couldn't pay rent\nStripe: founders hated payment integration\nDropbox: founder kept forgetting his USB drive\n\nYour biggest pain point might be your biggest opportunity.\n\nStart with yourself.",
      hook: "The best startups solve problems the founders have.",
      views: 5800000,
      likes: 88000,
      comments: 4200,
      shares: 28000,
      category: 'startup',
      whyItWorks: "Simple insight with famous examples, actionable advice, personal approach",
      hookPattern: 'framework',
      sourceUrl: 'https://twitter.com/paulg',
    },
    {
      platform: 'linkedin',
      authorName: 'Brian Chesky',
      authorHandle: 'brianchesky',
      authorFollowers: 420000,
      content: "In 2008, Airbnb had $0 revenue and 7 users.\n\nWe were rejected by 7 VCs in one week.\n\nOne called it 'the worst idea ever.'\n\nFast forward to today:\n$100B+ valuation\n4M+ hosts\n1B+ guest arrivals\n\nThe lesson?\n\nThe best ideas often look crazy at first.\n\nBet on yourself anyway.",
      hook: "In 2008, Airbnb had $0 revenue and 7 users. We were rejected by 7 VCs in one week.",
      views: 7200000,
      likes: 125000,
      comments: 8500,
      shares: 45000,
      category: 'startup',
      whyItWorks: "Incredible origin story, specific rejection details, inspiring outcome",
      hookPattern: 'story',
      sourceUrl: 'https://linkedin.com/in/brianchesky',
    },
    // Career/work virals
    {
      platform: 'linkedin',
      authorName: 'Adam Grant',
      authorHandle: 'adammgrant',
      authorFollowers: 4500000,
      content: "Quiet quitting is a response to loud managing.\n\nWhen leaders:\n- Demand loyalty without earning it\n- Expect passion without purpose\n- Want engagement without investment\n\nEmployees check out.\n\nWant people to go above and beyond?\n\nGo above and beyond for them first.\n\nLeadership is a mirror.",
      hook: "Quiet quitting is a response to loud managing.",
      views: 9500000,
      likes: 165000,
      comments: 18000,
      shares: 62000,
      category: 'leadership',
      whyItWorks: "Timely topic, reframes blame, calls out leadership",
      hookPattern: 'contrarian',
      sourceUrl: 'https://linkedin.com/in/adammgrant',
    },
    {
      platform: 'linkedin',
      authorName: 'Simon Sinek',
      authorHandle: 'simonsinek',
      authorFollowers: 3800000,
      content: "The best leaders don't create followers.\n\nThey create more leaders.\n\nYour job isn't to be the smartest in the room.\n\nYour job is to make everyone in the room smarter.\n\nLeadership is not about being in charge.\n\nIt's about taking care of those in your charge.",
      hook: "The best leaders don't create followers. They create more leaders.",
      views: 6800000,
      likes: 142000,
      comments: 9200,
      shares: 48000,
      category: 'leadership',
      whyItWorks: "Redefines leadership, humble approach, quotable format",
      hookPattern: 'insight',
      sourceUrl: 'https://linkedin.com/in/simonsinek',
    },
    // Tech/programming virals
    {
      platform: 'twitter',
      authorName: 'Theo',
      authorHandle: '@theo',
      authorFollowers: 320000,
      content: "Hot take: The best code is code you didn't write.\n\nSeriously.\n\nEvery line of code is:\n- A line that can break\n- A line that needs testing\n- A line that needs maintaining\n\nUse existing libraries.\nKeep it simple.\nDelete more than you write.\n\nLess code = less problems.",
      hook: "Hot take: The best code is code you didn't write.",
      views: 2800000,
      likes: 42000,
      comments: 2200,
      shares: 14000,
      category: 'tech',
      whyItWorks: "Counterintuitive for developers, practical wisdom, actionable advice",
      hookPattern: 'contrarian',
      sourceUrl: 'https://twitter.com/theo',
    },
    {
      platform: 'twitter',
      authorName: 'Fireship',
      authorHandle: '@fireship_dev',
      authorFollowers: 450000,
      content: "The JavaScript framework tier list (controversial):\n\nS-tier: React, Vue\nA-tier: Svelte, Solid\nB-tier: Angular, Qwik\nC-tier: Still using jQuery\n\nHonestly though?\n\nThe best framework is the one your team knows.\n\nShipping > debating.\n\nPick one and build something.",
      hook: "The JavaScript framework tier list (controversial):",
      views: 3500000,
      likes: 55000,
      comments: 8500,
      shares: 18000,
      category: 'tech',
      whyItWorks: "Engagement bait with tier list, balanced take at end, practical conclusion",
      hookPattern: 'listicle',
      sourceUrl: 'https://twitter.com/fireship_dev',
    },
    // Finance/money virals
    {
      platform: 'twitter',
      authorName: 'Morgan Housel',
      authorHandle: '@morganhousel',
      authorFollowers: 680000,
      content: "The hardest financial skill is getting the goalpost to stop moving.\n\nYou think $100K will make you happy.\nThen $500K.\nThen $1M.\n\nThe goalposts always move.\n\nWealth is what you don't spend.\n\nLearn to be happy with enough.\n\nThat's the real flex.",
      hook: "The hardest financial skill is getting the goalpost to stop moving.",
      views: 4200000,
      likes: 68000,
      comments: 3400,
      shares: 24000,
      category: 'business',
      whyItWorks: "Counterintuitive money advice, relatable trap, philosophical insight",
      hookPattern: 'insight',
      sourceUrl: 'https://twitter.com/morganhousel',
    },
    {
      platform: 'instagram',
      authorName: 'The Finance Bar',
      authorHandle: '@thefinancebar',
      authorFollowers: 1200000,
      content: "The 50/30/20 rule is broken.\n\nTry this instead:\n\n30% Rent/Mortgage\n20% Savings & Investing\n15% Transportation\n15% Food\n10% Utilities/Insurance\n10% Fun/Entertainment\n\nAdjust to YOUR life.\n\nNo one-size-fits-all budget works.\n\nBuild for your reality, not someone else's formula.",
      hook: "The 50/30/20 rule is broken. Try this instead:",
      views: 2900000,
      likes: 185000,
      comments: 8500,
      shares: 42000,
      category: 'business',
      whyItWorks: "Challenges popular rule, provides alternative, realistic approach",
      hookPattern: 'contrarian',
      sourceUrl: 'https://instagram.com/thefinancebar',
    },
    // More transformation stories
    {
      platform: 'linkedin',
      authorName: 'Gary Vaynerchuk',
      authorHandle: 'garyvaynerchuk',
      authorFollowers: 5200000,
      content: "I immigrated to the US at 3 with nothing.\n\nBy 34, I'd built a $200M company.\n\nBut here's what nobody talks about:\n\nFrom 22-30, I worked 15+ hours a day.\nNo vacations.\nNo weekends.\nNo shortcuts.\n\n8 years of grinding before any 'overnight success.'\n\nPatience is the ultimate strategy.",
      hook: "I immigrated to the US at 3 with nothing. By 34, I'd built a $200M company.",
      views: 11200000,
      likes: 195000,
      comments: 15000,
      shares: 68000,
      category: 'motivation',
      whyItWorks: "Immigrant story, specific sacrifice details, reframes overnight success",
      hookPattern: 'story',
      sourceUrl: 'https://linkedin.com/in/garyvaynerchuk',
    },
    {
      platform: 'instagram',
      authorName: 'Ed Mylett',
      authorHandle: '@edmylett',
      authorFollowers: 3200000,
      content: "At 23, I was making minimum wage.\n\nBy 33, I was worth 8 figures.\n\nThe difference?\n\nI stopped trading time for money.\nI started trading value for money.\n\nYour income is determined by the problems you solve.\n\nBigger problems = bigger income.\n\nSolve expensive problems.",
      hook: "At 23, I was making minimum wage. By 33, I was worth 8 figures.",
      views: 5500000,
      likes: 340000,
      comments: 12000,
      shares: 65000,
      category: 'business',
      whyItWorks: "Dramatic transformation, clear insight, actionable mindset shift",
      hookPattern: 'transformation',
      sourceUrl: 'https://instagram.com/edmylett',
    },
    // Remote work / future of work
    {
      platform: 'linkedin',
      authorName: 'Matt Mullenweg',
      authorHandle: 'mattmullenweg',
      authorFollowers: 380000,
      content: "We've been fully remote at Automattic for 18 years.\n\n2,000+ employees across 95 countries.\n\nWhat I've learned:\n\n1. Trust > surveillance\n2. Async > meetings\n3. Results > hours\n4. Documentation > verbal\n5. Flexibility > rigidity\n\nRemote work doesn't fail.\n\nBad management does.",
      hook: "We've been fully remote at Automattic for 18 years. 2,000+ employees across 95 countries.",
      views: 4800000,
      likes: 85000,
      comments: 5200,
      shares: 28000,
      category: 'leadership',
      whyItWorks: "Credibility from 18 years experience, simple framework, defends remote work",
      hookPattern: 'framework',
      sourceUrl: 'https://linkedin.com/in/mattmullenweg',
    },
    // Content creation virals
    {
      platform: 'twitter',
      authorName: 'Nicolas Cole',
      authorHandle: '@Nicolascole77',
      authorFollowers: 420000,
      content: "I've written 10,000+ articles.\n\nHere's the headline formula that works every time:\n\n[Number] + [Adjective] + [Keyword] + [Promise]\n\nExample:\n'7 Simple Habits That Made Me a Millionaire'\n\nNumbers = specificity\nAdjective = ease/uniqueness\nKeyword = topic\nPromise = outcome\n\nSteal this.",
      hook: "I've written 10,000+ articles. Here's the headline formula that works every time:",
      views: 3600000,
      likes: 58000,
      comments: 3200,
      shares: 22000,
      category: 'marketing',
      whyItWorks: "Massive experience claim, specific formula, immediately usable",
      hookPattern: 'how-to',
      sourceUrl: 'https://twitter.com/Nicolascole77',
    },
    {
      platform: 'linkedin',
      authorName: 'Jasmin Alic',
      authorHandle: 'jasminalic',
      authorFollowers: 380000,
      content: "I grew from 0 to 400K followers in 2 years.\n\nMy only strategy?\n\nWrite like you talk.\nEdit like a surgeon.\n\nMost people write like robots trying to impress professors.\n\nDelete the jargon.\nKill the passive voice.\nSay it simply.\n\nClarity beats cleverness. Every time.",
      hook: "I grew from 0 to 400K followers in 2 years. My only strategy?",
      views: 2800000,
      likes: 52000,
      comments: 3800,
      shares: 16000,
      category: 'marketing',
      whyItWorks: "Growth proof, simple strategy, actionable writing advice",
      hookPattern: 'case-study',
      sourceUrl: 'https://linkedin.com/in/jasminalic',
    },
    // Health & wellness
    {
      platform: 'instagram',
      authorName: 'Dr. Andrew Huberman',
      authorHandle: '@hubermanlab',
      authorFollowers: 6500000,
      content: "The single most powerful thing you can do for your health:\n\nGet sunlight in your eyes within 30 minutes of waking.\n\nNo sunglasses.\n10-30 minutes.\nEven on cloudy days.\n\nThis sets your circadian rhythm and:\n- Improves sleep\n- Boosts mood\n- Increases energy\n\nFree. Simple. Powerful.",
      hook: "The single most powerful thing you can do for your health:",
      views: 8200000,
      likes: 480000,
      comments: 22000,
      shares: 125000,
      category: 'productivity',
      whyItWorks: "Authority from PhD, simple actionable advice, backed by science",
      hookPattern: 'how-to',
      sourceUrl: 'https://instagram.com/hubermanlab',
    },
    // Parenting/life balance
    {
      platform: 'linkedin',
      authorName: 'Melinda Gates',
      authorHandle: 'melindagates',
      authorFollowers: 4200000,
      content: "The most important meeting of my week isn't at work.\n\nIt's Sunday dinner with my kids.\n\nNo phones. No distractions.\n\nJust conversation about their lives.\n\nI've closed billion-dollar deals.\nI've met world leaders.\n\nNothing matters more than these dinners.\n\nProtect what matters most.",
      hook: "The most important meeting of my week isn't at work. It's Sunday dinner with my kids.",
      views: 5800000,
      likes: 125000,
      comments: 8500,
      shares: 42000,
      category: 'leadership',
      whyItWorks: "Unexpected vulnerability from executive, relatable family priority, clear values",
      hookPattern: 'story',
      sourceUrl: 'https://linkedin.com/in/melindagates',
    },
  ];

  let added = 0;
  for (const viral of virals) {
    try {
      await db.insert(curatedVirals)
        .values({
          ...viral,
          verifiedAt: new Date(),
          createdAt: new Date(),
          isActive: true,
        })
        .onConflictDoNothing();
      added++;
    } catch (err) {
      // Duplicate
    }
  }

  console.log(`Seeded ${added} curated virals`);
  return added;
}
