import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  TransformationRequest,
  TransformationResponse,
  PlatformType,
  PlatformOutput,
  ContentSource,
  ToneType
} from "@shared/schema";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// Use Gemini 2.5 Flash Lite — 2.5-flash hits 503 under load; lite is consistently available
const MODEL_NAME = "gemini-2.5-flash-lite";

interface RegenerationRequest {
  content: string;
  contentSource: ContentSource;
  platform: PlatformType;
  tone: ToneType;
  outputLength: number;
  useHashtags: boolean;
  useEmojis: boolean;
}

export async function repurposeContent(request: TransformationRequest): Promise<TransformationResponse['outputs']> {
  const { content, contentSource, platforms, tone, outputLength, useHashtags, useEmojis } = request;

  // Prepare system instructions
  const systemInstructions = getSystemInstructions(tone, outputLength, useHashtags, useEmojis);

  const platformPrompts = platforms.map(platform => {
    return {
      platform,
      prompt: getPlatformPrompt(platform, contentSource, content)
    };
  });

  // Process each platform in parallel
  const outputPromises = platformPrompts.map(async ({ platform, prompt }) => {
    try {
      const output = await generateContent(systemInstructions, prompt, platform);
      return { platform, output };
    } catch (error) {
      console.error(`Error generating content for ${platform}:`, error);
      throw error;
    }
  });

  const outputResults = await Promise.all(outputPromises);

  // Convert to the expected output format
  const outputs: TransformationResponse['outputs'] = {};
  outputResults.forEach(({ platform, output }) => {
    outputs[platform] = output;
  });

  return outputs;
}

export async function regenerateContent(request: RegenerationRequest): Promise<PlatformOutput> {
  const { content, contentSource, platform, tone, outputLength, useHashtags, useEmojis } = request;

  const systemInstructions = getSystemInstructions(tone, outputLength, useHashtags, useEmojis);
  const prompt = getPlatformPrompt(platform, contentSource, content);

  return await generateContent(systemInstructions, prompt, platform);
}

// Parse LinkedIn structured output into hooks, body, and CTA
function parseLinkedInOutput(rawContent: string): PlatformOutput {
  const hooks: string[] = [];
  let body = '';
  let cta = '';

  const cleanText = (text: string): string => {
    return text
      .replace(/^["'"]+|["'"]+$/g, '')
      .replace(/^[\s\n]+|[\s\n]+$/g, '')
      .trim();
  };

  const hooksMatch = rawContent.match(/---HOOK OPTIONS---\s*([\s\S]*?)\s*---END HOOKS---/);
  if (hooksMatch) {
    const hooksSection = hooksMatch[1].trim();
    const hookLines = hooksSection.split('\n').filter(line => line.trim());
    hookLines.forEach(line => {
      let cleanedHook = line
        .replace(/^(\[?Hook\s*\d+\]?:?|\d+[.\)]\s*|-\s*)/i, '')
        .trim();
      cleanedHook = cleanText(cleanedHook);
      if (cleanedHook) {
        hooks.push(cleanedHook);
      }
    });
  }

  const bodyMatch = rawContent.match(/---POST BODY---\s*([\s\S]*?)\s*---END BODY---/);
  if (bodyMatch) {
    body = bodyMatch[1].trim();

    if (hooks.length > 0) {
      for (const hook of hooks) {
        const hookPattern = new RegExp('^["\']?' + hook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']?\\s*\\n*', 'i');
        if (hookPattern.test(body)) {
          body = body.replace(hookPattern, '').trim();
          break;
        }
        const quotedHook = `"${hook}"`;
        if (body.startsWith(quotedHook)) {
          body = body.substring(quotedHook.length).trim();
          break;
        }
      }
    }
  }

  const ctaMatch = rawContent.match(/---CTA---\s*([\s\S]*?)\s*---END CTA---/);
  if (ctaMatch) {
    cta = cleanText(ctaMatch[1]);
  }

  let fullContent = '';
  if (hooks.length > 0 && body) {
    fullContent = hooks[0] + '\n\n' + body;
  } else if (body) {
    fullContent = body;
  } else {
    fullContent = rawContent;
  }
  if (cta) {
    fullContent += '\n\n' + cta;
  }

  return {
    content: fullContent,
    characterCount: fullContent.length,
    hooks: hooks.length > 0 ? hooks : undefined,
    body: body || undefined,
    cta: cta || undefined,
    selectedHook: hooks.length > 0 ? 0 : undefined,
  };
}

// Format Twitter content to ensure consistent (X/Y) format
function formatTwitterContent(content: string): string {
  // Check if already in correct (X/Y) format
  if (/\(\d+\/\d+\)/.test(content)) {
    return content;
  }

  // Handle "Tweet 1:", "**Tweet 1:**", "1.", "1:" etc. formats
  const tweetPatterns = [
    /\*?\*?Tweet\s*\d+\*?\*?:?\s*/gi,  // **Tweet 1:** or Tweet 1:
    /^\d+[.):\s]+/gm,                    // 1. or 1) or 1:
  ];

  let tweets: string[] = [];
  let workingContent = content;

  // Try to split by common patterns
  for (const pattern of tweetPatterns) {
    if (pattern.test(workingContent)) {
      tweets = workingContent.split(pattern).filter(t => t.trim());
      break;
    }
  }

  // If no pattern found, split by double newlines
  if (tweets.length === 0) {
    tweets = workingContent.split(/\n\n+/).filter(t => t.trim());
  }

  // If still just one chunk, return as-is
  if (tweets.length <= 1) {
    return content;
  }

  // Reformat with (X/Y) numbering
  const total = tweets.length;
  return tweets.map((tweet, index) => {
    const cleanTweet = tweet.trim();
    // Remove any existing numbering at the end
    const withoutNumbering = cleanTweet.replace(/\s*\(\d+\/\d+\)\s*$/, '').trim();
    return `${withoutNumbering} (${index + 1}/${total})`;
  }).join('\n\n');
}

// Format Instagram content to ensure proper hashtag spacing
function formatInstagramContent(content: string): string {
  // Find where hashtags start (first # that's followed by a word)
  const hashtagMatch = content.match(/(^|\s)(#[a-zA-Z]\w*)/);
  if (!hashtagMatch) return content;

  // Find the position of the first hashtag
  const firstHashtagIndex = content.indexOf(hashtagMatch[2]);
  if (firstHashtagIndex === -1) return content;

  // Split content into caption and hashtags
  const caption = content.substring(0, firstHashtagIndex).trimEnd();
  const hashtags = content.substring(firstHashtagIndex).trim();

  // Ensure proper spacing: two blank lines before hashtags
  return caption + '\n\n\n' + hashtags;
}

async function generateContent(
  systemInstructions: string,
  prompt: string,
  platform: PlatformType
): Promise<PlatformOutput> {
  try {
    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      systemInstruction: systemInstructions,
    });

    const result = await model.generateContent(prompt);
    let rawContent = result.response.text();

    // For LinkedIn, parse the structured output
    if (platform === "LinkedIn") {
      return parseLinkedInOutput(rawContent);
    }

    // For Twitter, ensure consistent (X/Y) format
    if (platform === "Twitter") {
      rawContent = formatTwitterContent(rawContent);
    }

    // For Instagram, ensure proper hashtag formatting
    if (platform === "Instagram") {
      rawContent = formatInstagramContent(rawContent);
    }

    return {
      content: rawContent,
      characterCount: rawContent.length,
    };
  } catch (error) {
    console.error(`Error generating content for ${platform}:`, error);
    throw new Error(`Failed to generate content for ${platform}`);
  }
}

function getSystemInstructions(
  tone: ToneType,
  outputLength: number,
  useHashtags: boolean,
  useEmojis: boolean
): string {
  const lengthMap: Record<number, string> = {
    1: "very concise and brief",
    2: "concise",
    3: "moderate length",
    4: "detailed",
    5: "comprehensive and thorough"
  };

  const lengthDescription = lengthMap[outputLength] || "moderate length";

  return `
    You are an expert content repurposing assistant that helps transform long-form content into
    optimized formats for different platforms and purposes.

    Use a ${tone.toLowerCase()} tone in your responses.
    Make the content ${lengthDescription}.
    ${useHashtags ? "Include relevant hashtags where appropriate." : "Do not include hashtags."}
    ${useEmojis ? "Use emojis appropriately to enhance engagement." : "Do not use emojis."}

    For each platform, format the content appropriately considering the platform's specific
    characteristics, audience expectations, and length limitations.

    Always preserve the key message and value of the original content while optimizing for
    the specified platform.
  `;
}

function getPlatformPrompt(platform: PlatformType, contentSource: ContentSource, content: string): string {
  const basePrompt = `
    The following content is from a ${contentSource.toLowerCase()}:

    ---
    ${content}
    ---

    Please transform this content into a format optimized for ${platform}.
  `;

  switch (platform) {
    case "Twitter":
      return `
        ${basePrompt}

        Create a Twitter/X thread that captures the main points of the content.

        **STRICT FORMAT RULES:**
        - Each tweet MUST be under 280 characters
        - Each tweet MUST end with the thread number in format (1/X), (2/X), etc.
        - Do NOT use "Tweet 1:" or "**Tweet 1:**" or any other format
        - Just write the tweet content followed by (1/X) at the end

        **EXAMPLE OUTPUT:**
        Remote work is transforming how we think about productivity. But here's what nobody tells you about the hidden costs of flexibility... (1/4)

        Studies show 73% of employees want hybrid options. Yet 67% miss the spontaneous collaboration that happens in person. The tension is real. (2/4)

        The solution isn't choosing one or the other. It's intentional design: async work for focus, in-person for connection. (3/4)

        Start with your team's actual needs, not industry trends. What does YOUR work actually require? That's the real question. (4/4)

        **REMEMBER:**
        - Write 3-6 tweets per thread
        - Each tweet should be able to stand alone but flow together
        - End EVERY tweet with (X/Y) format
        - Make it engaging and shareable
      `;

    case "LinkedIn":
      return `
        ${basePrompt}

        Create a HIGH-PERFORMING LinkedIn post optimized for engagement. Follow these rules:

        **HOOK (CRITICAL - First 210 characters)**
        The first line is EVERYTHING. LinkedIn truncates posts at 210 characters in the feed.
        Provide 3 different hook options, each designed to stop the scroll:
        - Hook 1: A bold, contrarian statement or hot take
        - Hook 2: A surprising statistic, result, or "I did X and here's what happened"
        - Hook 3: A relatable pain point or question that speaks directly to the reader

        **FORMAT**
        Structure your response EXACTLY like this:

        ---HOOK OPTIONS---
        [Hook 1]
        [Hook 2]
        [Hook 3]
        ---END HOOKS---

        ---POST BODY---
        [The rest of the post using the first hook, with these LinkedIn best practices:]
        - Use single-sentence paragraphs for mobile readability
        - Add white space between ideas (blank lines)
        - Keep paragraphs to 1-2 sentences max
        - Use "you" language to speak directly to the reader
        - Include a specific insight, lesson, or takeaway
        - Total post should be 800-1500 characters (sweet spot for engagement)
        ---END BODY---

        ---CTA---
        [A natural call-to-action that encourages engagement without being salesy]
        Example CTAs: "Agree? I'd love to hear your take." / "What would you add?" / "Drop a 🔥 if this resonates"
        ---END CTA---

        Remember: Write like a human sharing insights, not a marketer selling something.
      `;

    case "Instagram":
      return `
        ${basePrompt}

        Create an Instagram caption that conveys the main message in an engaging way.

        **FORMAT RULES:**
        - Use short paragraphs (1-2 sentences max)
        - Add blank lines between paragraphs for mobile readability
        - Each idea should be its own paragraph

        **HASHTAG RULES (if hashtags are enabled):**
        - Add TWO blank lines before hashtags to separate them from the caption
        - Group all hashtags at the very end
        - Use 5-15 relevant hashtags
        - Mix popular and niche hashtags

        Keep the total under 2200 characters.
      `;

    case "Threads":
      return `
        ${basePrompt}

        Create a Threads post (Meta's text-based social platform, similar to Twitter).

        **FORMAT RULES:**
        - Keep it under 500 characters (Threads limit)
        - Use a conversational, casual tone
        - Short paragraphs with line breaks
        - Can be a single post or a short thread (2-3 posts max)
        - If making a thread, separate each post with "---"

        **STYLE:**
        - More personal and authentic than LinkedIn
        - Less formal than Twitter
        - Great for hot takes, quick thoughts, questions
        - Emojis are welcome if enabled

        **HASHTAG RULES (if enabled):**
        - Keep to 3-5 relevant hashtags max
        - Place at the end, separated by blank line
      `;

    case "Email":
      return `
        ${basePrompt}

        Create an email newsletter snippet that summarizes the key points.
        Use a clear subject line, greeting, and sign-off.
        Format with short paragraphs, bullet points where appropriate.
        Include a clear call to action.
      `;

    default:
      return basePrompt;
  }
}
