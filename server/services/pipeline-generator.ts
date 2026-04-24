import { GoogleGenerativeAI } from "@google/generative-ai";
import { storage } from "../storage";
import type { ContentPipeline, PlatformType, ToneType, InsertPipelineDraft } from "@shared/schema";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const MODEL_NAME = "gemini-2.0-flash";

interface GeneratedDraft {
  content: string;
  platform: string;
  topic: string;
  suggestedMediaType: string | null;
}

/**
 * Generate content drafts for a pipeline
 */
export async function generatePipelineDrafts(pipeline: ContentPipeline): Promise<GeneratedDraft[]> {
  const drafts: GeneratedDraft[] = [];
  const platforms = pipeline.platforms as string[];
  const topics = pipeline.topics as string[];
  const draftsPerRun = pipeline.draftsPerRun || 1;

  // Generate drafts for each platform
  for (const platform of platforms) {
    for (let i = 0; i < draftsPerRun; i++) {
      // Pick a random topic for variety
      const topic = topics[Math.floor(Math.random() * topics.length)];

      try {
        const content = await generateContent(
          topic,
          platform as PlatformType,
          pipeline.tone as ToneType,
          pipeline.useHashtags ?? true,
          pipeline.useEmojis ?? true
        );

        const suggestedMediaType = suggestMediaType(content, platform as PlatformType);

        drafts.push({
          content,
          platform,
          topic,
          suggestedMediaType,
        });
      } catch (error) {
        console.error(`Error generating draft for ${platform}:`, error);
        // Continue with other drafts even if one fails
      }
    }
  }

  return drafts;
}

/**
 * Generate content for a specific topic and platform
 */
async function generateContent(
  topic: string,
  platform: PlatformType,
  tone: ToneType,
  useHashtags: boolean,
  useEmojis: boolean
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: getSystemPrompt(tone, useHashtags, useEmojis),
  });

  const prompt = getPlatformPrompt(topic, platform);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

function getSystemPrompt(tone: ToneType, useHashtags: boolean, useEmojis: boolean): string {
  return `
You are an expert social media content creator. You create engaging, authentic content that resonates with audiences.

Guidelines:
- Use a ${tone.toLowerCase()} tone
- Write as a human thought leader sharing genuine insights
- Be concise and punchy - every word should earn its place
- ${useHashtags ? "Include 2-5 relevant hashtags at the end" : "Do not include hashtags"}
- ${useEmojis ? "Use 1-3 emojis strategically to enhance engagement" : "Do not use emojis"}
- Never be salesy or promotional
- Focus on providing value, insights, or sparking discussion

IMPORTANT: Return ONLY the post content. No explanations, no "Here's a post about...", just the raw content ready to publish.
`;
}

function getPlatformPrompt(topic: string, platform: PlatformType): string {
  const platformGuidelines: Record<PlatformType, string> = {
    Twitter: `
Create a Twitter/X post about: "${topic}"

Guidelines:
- Maximum 280 characters for a single tweet
- If the topic needs more, create a thread with 3-5 tweets
- For threads, end each tweet with (1/X), (2/X), etc.
- Start with a hook that stops the scroll
- Be conversational and direct
    `,
    LinkedIn: `
Create a LinkedIn post about: "${topic}"

Guidelines:
- Start with a powerful hook (first 210 characters are crucial)
- Use short paragraphs (1-2 sentences each)
- Add blank lines between paragraphs for mobile readability
- Include a call-to-action question at the end
- Aim for 800-1500 characters total
- Write like you're sharing a professional insight, not marketing
    `,
    Instagram: `
Create an Instagram caption about: "${topic}"

Guidelines:
- Start with an attention-grabbing first line
- Keep it engaging and personal
- Use line breaks for readability
- Place hashtags at the very end, separated by two blank lines
- Maximum 2200 characters
    `,
    Threads: `
Create a Threads post about: "${topic}"

Guidelines:
- Maximum 500 characters
- Conversational and casual tone
- Can be a quick thought, hot take, or question
- More personal than LinkedIn, less constrained than Twitter
    `,
    Email: `
Create an email newsletter snippet about: "${topic}"

Guidelines:
- Compelling subject line (first line)
- Brief intro paragraph
- 2-3 key points as short paragraphs
- Clear call-to-action
- Professional but personable tone
    `,
  };

  return platformGuidelines[platform] || `Create a social media post about: "${topic}"`;
}

/**
 * Suggest the best media type for the content
 */
export function suggestMediaType(content: string, platform: PlatformType): string | null {
  const contentLower = content.toLowerCase();

  // Keywords that suggest different media types
  const imageKeywords = [
    'visual', 'picture', 'image', 'photo', 'infographic', 'chart', 'graph',
    'data', 'statistics', 'stats', 'numbers', 'comparison', 'before/after',
    'tips', 'list', 'steps', 'how to', 'guide', 'tutorial'
  ];

  const videoKeywords = [
    'video', 'watch', 'demo', 'demonstration', 'process', 'behind the scenes',
    'story', 'journey', 'transformation', 'before and after', 'explained',
    'animated', 'motion'
  ];

  // Check for video keywords
  if (videoKeywords.some(k => contentLower.includes(k))) {
    return 'video';
  }

  // Check for image keywords
  if (imageKeywords.some(k => contentLower.includes(k))) {
    return 'image';
  }

  // Default suggestions by platform
  switch (platform) {
    case 'Instagram':
      return 'image'; // Instagram is visual-first
    case 'LinkedIn':
      return content.length > 500 ? 'image' : null; // Long posts benefit from images
    case 'Twitter':
      return content.length > 200 ? 'image' : null; // Threads benefit from images
    default:
      return null;
  }
}

/**
 * Process a pipeline - generate drafts and save to database
 */
export async function processPipeline(pipelineId: number): Promise<number> {
  const pipeline = await storage.getPipeline(pipelineId);
  if (!pipeline) {
    throw new Error(`Pipeline ${pipelineId} not found`);
  }

  if (pipeline.status !== 'active') {
    console.log(`Pipeline ${pipelineId} is not active, skipping`);
    return 0;
  }

  console.log(`Processing pipeline: ${pipeline.name} (ID: ${pipelineId})`);

  // Generate drafts
  const generatedDrafts = await generatePipelineDrafts(pipeline);

  // Save drafts to database
  let savedCount = 0;
  for (const draft of generatedDrafts) {
    try {
      const draftData: InsertPipelineDraft = {
        userId: pipeline.userId,
        pipelineId: pipeline.id,
        content: draft.content,
        platform: draft.platform,
        topic: draft.topic,
        suggestedMediaType: draft.suggestedMediaType,
        status: 'pending_review',
      };

      await storage.createDraft(draftData);
      savedCount++;
    } catch (error) {
      console.error(`Error saving draft:`, error);
    }
  }

  // Update pipeline's lastRunAt
  await storage.updatePipeline(pipelineId, {
    lastRunAt: new Date(),
  });

  console.log(`Pipeline ${pipelineId}: Generated ${savedCount} drafts`);
  return savedCount;
}
