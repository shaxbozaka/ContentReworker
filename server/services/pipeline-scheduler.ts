import { storage } from "../storage";
import { processPipeline } from "./pipeline-generator";
import type { ContentPipeline, PipelineFrequency } from "@shared/schema";

// Check interval: 15 minutes
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

let schedulerInterval: NodeJS.Timeout | null = null;
let isProcessing = false;

/**
 * Start the pipeline scheduler
 */
export function startPipelineScheduler(): void {
  if (schedulerInterval) {
    console.log("Pipeline scheduler already running");
    return;
  }

  console.log("Starting pipeline scheduler (checking every 15 minutes)");

  // Run immediately on startup
  checkAndProcessPipelines();

  // Then run at intervals
  schedulerInterval = setInterval(() => {
    checkAndProcessPipelines();
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the pipeline scheduler
 */
export function stopPipelineScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("Pipeline scheduler stopped");
  }
}

/**
 * Manually trigger pipeline processing (for testing)
 */
export async function triggerPipelineProcessing(): Promise<void> {
  await checkAndProcessPipelines();
}

/**
 * Check for due pipelines and process them
 */
async function checkAndProcessPipelines(): Promise<void> {
  if (isProcessing) {
    console.log("Pipeline scheduler: Already processing, skipping this cycle");
    return;
  }

  isProcessing = true;
  console.log(`Pipeline scheduler: Checking for due pipelines at ${new Date().toISOString()}`);

  try {
    const duePipelines = await storage.getDuePipelines();
    console.log(`Pipeline scheduler: Found ${duePipelines.length} due pipelines`);

    for (const pipeline of duePipelines) {
      try {
        console.log(`Processing pipeline: ${pipeline.name} (ID: ${pipeline.id})`);

        // Process the pipeline
        const draftsGenerated = await processPipeline(pipeline.id);

        // Calculate next run time
        const nextRunAt = calculateNextRun(pipeline);

        // Update pipeline with next run time
        await storage.updatePipeline(pipeline.id, {
          lastRunAt: new Date(),
          nextRunAt,
        });

        console.log(`Pipeline ${pipeline.id}: Generated ${draftsGenerated} drafts, next run at ${nextRunAt?.toISOString()}`);
      } catch (error) {
        console.error(`Error processing pipeline ${pipeline.id}:`, error);
        // Continue with other pipelines
      }
    }
  } catch (error) {
    console.error("Error in pipeline scheduler:", error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Calculate the next run time based on pipeline frequency
 */
export function calculateNextRun(pipeline: ContentPipeline): Date {
  const now = new Date();
  const frequency = pipeline.frequency as PipelineFrequency;

  switch (frequency) {
    case 'daily':
      // Next day at the same time (or 9 AM if first run)
      const nextDaily = new Date(now);
      nextDaily.setDate(nextDaily.getDate() + 1);
      nextDaily.setHours(9, 0, 0, 0);
      return nextDaily;

    case 'every_other_day':
      // 2 days from now
      const nextEveryOther = new Date(now);
      nextEveryOther.setDate(nextEveryOther.getDate() + 2);
      nextEveryOther.setHours(9, 0, 0, 0);
      return nextEveryOther;

    case 'weekly':
      // 7 days from now
      const nextWeekly = new Date(now);
      nextWeekly.setDate(nextWeekly.getDate() + 7);
      nextWeekly.setHours(9, 0, 0, 0);
      return nextWeekly;

    case 'custom':
      // Parse cron expression if provided
      if (pipeline.cronExpression) {
        return parseNextCronRun(pipeline.cronExpression, now);
      }
      // Default to daily if no cron expression
      const nextCustom = new Date(now);
      nextCustom.setDate(nextCustom.getDate() + 1);
      nextCustom.setHours(9, 0, 0, 0);
      return nextCustom;

    default:
      // Default to daily
      const nextDefault = new Date(now);
      nextDefault.setDate(nextDefault.getDate() + 1);
      nextDefault.setHours(9, 0, 0, 0);
      return nextDefault;
  }
}

/**
 * Simple cron expression parser for next run time
 * Supports: "minute hour day month weekday"
 * Example: "0 9 * * 1" = Every Monday at 9 AM
 */
function parseNextCronRun(cronExpression: string, from: Date): Date {
  const parts = cronExpression.split(' ');
  if (parts.length !== 5) {
    // Invalid cron, default to tomorrow 9 AM
    const next = new Date(from);
    next.setDate(next.getDate() + 1);
    next.setHours(9, 0, 0, 0);
    return next;
  }

  const [minute, hour, day, month, weekday] = parts;

  // Simple implementation: handle common patterns
  const targetHour = hour === '*' ? 9 : parseInt(hour);
  const targetMinute = minute === '*' ? 0 : parseInt(minute);

  let next = new Date(from);
  next.setHours(targetHour, targetMinute, 0, 0);

  // If the time has passed today, move to tomorrow
  if (next <= from) {
    next.setDate(next.getDate() + 1);
  }

  // Handle weekday constraint
  if (weekday !== '*') {
    const targetWeekday = parseInt(weekday);
    while (next.getDay() !== targetWeekday) {
      next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

/**
 * Manually process a specific pipeline (triggered via API)
 */
export async function manuallyTriggerPipeline(pipelineId: number): Promise<number> {
  const pipeline = await storage.getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  if (pipeline.status !== 'active' && pipeline.status !== 'paused') {
    throw new Error(`Pipeline ${pipelineId} is not available for manual trigger`);
  }

  console.log(`Manually triggering pipeline: ${pipeline.name} (ID: ${pipelineId})`);

  const draftsGenerated = await processPipeline(pipelineId);

  // Don't update nextRunAt for manual triggers

  return draftsGenerated;
}
