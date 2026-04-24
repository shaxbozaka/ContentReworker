import { storage } from '../storage';
import { postToLinkedIn } from './linkedin';

// Check interval: 1 minute
const CHECK_INTERVAL = 60 * 1000;

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;

/**
 * Process pending scheduled posts that are due
 */
async function processPendingPosts(): Promise<void> {
  if (isRunning) {
    console.log('[Scheduler] Already processing, skipping...');
    return;
  }

  isRunning = true;

  try {
    // Get all pending posts that are due
    const pendingPosts = await storage.getPendingScheduledPosts();

    if (pendingPosts.length === 0) {
      return;
    }

    console.log(`[Scheduler] Processing ${pendingPosts.length} pending posts...`);

    for (const post of pendingPosts) {
      try {
        console.log(`[Scheduler] Processing post ${post.id} for platform ${post.platform}`);
        const normalizedPlatform = post.platform?.toLowerCase();

        if (normalizedPlatform === 'linkedin') {
          // Post to LinkedIn
          const result = await postToLinkedIn(post.userId, post.content);

          if (result.success) {
            // Update post status to posted
            await storage.updateScheduledPost(post.id, {
              status: 'posted',
              postedAt: new Date(),
              postId: result.shareUrn || undefined,
            } as any);
            console.log(`[Scheduler] Successfully posted ${post.id} to LinkedIn`);
          } else {
            // Update post status to failed
            await storage.updateScheduledPost(post.id, {
              status: 'failed',
              errorMessage: result.error || 'Unknown error',
            } as any);
            console.error(`[Scheduler] Failed to post ${post.id}: ${result.error}`);
          }
        } else if (normalizedPlatform === 'twitter') {
          // Twitter support can be added here
          await storage.updateScheduledPost(post.id, {
            status: 'failed',
            errorMessage: 'Twitter scheduling not yet implemented',
          } as any);
        } else {
          await storage.updateScheduledPost(post.id, {
            status: 'failed',
            errorMessage: `Platform ${post.platform} not supported`,
          } as any);
        }
      } catch (error: any) {
        console.error(`[Scheduler] Error processing post ${post.id}:`, error);
        await storage.updateScheduledPost(post.id, {
          status: 'failed',
          errorMessage: error.message || 'Internal error',
        } as any);
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error fetching pending posts:', error);
  } finally {
    isRunning = false;
  }
}

/**
 * Start the scheduler
 */
export function startScheduler(): void {
  if (intervalId) {
    console.log('[Scheduler] Already running');
    return;
  }

  console.log('[Scheduler] Starting post scheduler...');

  // Run immediately on start
  processPendingPosts();

  // Then run every minute
  intervalId = setInterval(processPendingPosts, CHECK_INTERVAL);
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('[Scheduler] Stopped');
  }
}

/**
 * Manually trigger processing (for testing)
 */
export async function triggerProcessing(): Promise<void> {
  await processPendingPosts();
}
