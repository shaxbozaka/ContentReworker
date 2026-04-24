import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { trackedAccounts, curatedVirals } from '../../shared/schema';
import { fetchChannelRecentVideos } from './scrapers/youtube';

export interface IngestResult {
  accountId: number;
  platform: string;
  added: number;
  skipped: number;
  error?: string;
}

export async function ingestForAccount(accountId: number): Promise<IngestResult> {
  const [account] = await db
    .select()
    .from(trackedAccounts)
    .where(eq(trackedAccounts.id, accountId));

  if (!account) {
    return { accountId, platform: 'unknown', added: 0, skipped: 0, error: 'account not found' };
  }
  if (!account.isActive) {
    return { accountId, platform: account.platform, added: 0, skipped: 0, error: 'inactive' };
  }

  let fetched;
  try {
    if (account.platform === 'youtube') {
      fetched = await fetchChannelRecentVideos(account.handle, 15);
    } else {
      // LinkedIn / Instagram / TikTok / Twitter ingestion happens via the
      // open-source browser extension (Phase 2). Server can't do it at $0.
      return {
        accountId,
        platform: account.platform,
        added: 0,
        skipped: 0,
        error: `${account.platform} ingest requires the browser extension (Phase 2)`,
      };
    }
  } catch (err: any) {
    console.error(`[competitor-ingest] ${account.platform}/${account.handle} failed:`, err.message);
    return {
      accountId,
      platform: account.platform,
      added: 0,
      skipped: 0,
      error: err.message,
    };
  }

  let added = 0;
  let skipped = 0;

  for (const v of fetched) {
    // Dedup per-user: same viral post can belong to multiple users
    // who track the same creator. `(tracked_account_id, platform_post_id)`
    // is the effective unique key.
    const existing = await db
      .select({ id: curatedVirals.id })
      .from(curatedVirals)
      .where(and(
        eq(curatedVirals.platform, v.platform),
        eq(curatedVirals.platformPostId, v.platformPostId),
        eq(curatedVirals.trackedAccountId, accountId),
      ))
      .limit(1);

    if (existing.length > 0) {
      skipped++;
      continue;
    }

    await db.insert(curatedVirals).values({
      platform: v.platform,
      authorName: v.authorName,
      authorHandle: v.authorHandle,
      content: v.content,
      hook: v.hook,
      mediaType: v.mediaType,
      videoUrl: v.videoUrl,
      thumbnailUrl: v.thumbnailUrl,
      duration: v.duration,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      category: v.category,
      sourceUrl: v.sourceUrl,
      platformPostId: v.platformPostId,
      publishedAt: v.publishedAt,
      verifiedAt: new Date(),
      trackedAccountId: accountId,
      isActive: true,
    });
    added++;
  }

  await db
    .update(trackedAccounts)
    .set({
      lastFetchedAt: new Date(),
      lastPostCount: fetched.length,
      updatedAt: new Date(),
    })
    .where(eq(trackedAccounts.id, accountId));

  return { accountId, platform: account.platform, added, skipped };
}

export async function ingestForUser(userId: number): Promise<IngestResult[]> {
  const accounts = await db
    .select()
    .from(trackedAccounts)
    .where(and(eq(trackedAccounts.userId, userId), eq(trackedAccounts.isActive, true)));

  const results: IngestResult[] = [];
  for (const a of accounts) {
    results.push(await ingestForAccount(a.id));
  }
  return results;
}

export async function ingestAllActive(): Promise<IngestResult[]> {
  const accounts = await db
    .select()
    .from(trackedAccounts)
    .where(eq(trackedAccounts.isActive, true));

  const results: IngestResult[] = [];
  for (const a of accounts) {
    results.push(await ingestForAccount(a.id));
  }
  return results;
}
