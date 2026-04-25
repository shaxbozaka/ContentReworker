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

        Write a LinkedIn post that earns attention through value, not by demanding it. The 2021-era
        "Hot take:" / "Stop scrolling." / "Most people get X wrong. Here's why." formulas are now
        recognized as AI-generated boilerplate and signal low-quality content. Avoid them entirely.

        **HOOK (first line, shows in feed before the See more cut)**
        Generate 3 hooks. Each takes a DIFFERENT path into the post:

        - Hook 1 — SPECIFIC DETAIL: open with a concrete number, name, date, or observable fact. A
          reader who only skims the line should walk away knowing one real thing.
          Shape: "We onboarded 47 customers in 30 days from a strategy that took 4 minutes a day."
                 "Three weeks before launch, our biggest customer asked for a refund."

        - Hook 2 — IN MEDIA RES: drop the reader into a moment that's already happening. A scene,
          a quote, a line of dialogue, a turning point. The reader has to continue to learn what happened.
          Shape: "She walked out of the interview before I finished the second question."
                 "The deck was 47 slides. The CEO closed it at slide 3 and asked one question."

        - Hook 3 — PLAIN OBSERVATION: state a non-obvious truth in plain language, with no flagging.
          Don't call it a hot take. Don't ask a question. Don't promise a list. Just say the thing
          and let it stand on its own.
          Shape: "Most B2B dashboards show metrics that don't help anyone make a decision."
                 "The hiring market has quietly stopped rewarding loyalty."

        **HARD AVOID — every one of these reads as 'generic AI LinkedIn post' in 2026:**
        - "Stop scrolling." / "Hot take:" / "Unpopular opinion:" / "Hear me out."
        - "Most people get X wrong. Here's why."
        - "I did X for Y days. Here's what happened." (the format itself, not the structure)
        - Opening with an engagement-bait question ("Want to know the secret to ___?")
        - 🚨 / 🔥 / ⚡ as the first character
        - "Let me tell you a story" / "Storytime:"
        - "X failed. Here's why." as a literal opener
        - Vague maxims that could apply to anyone ("Success isn't about working harder")
        - Anything that requires the second sentence to make sense

        **HOOK CONSTRAINTS:**
        - Under ~18 words on the first line (LinkedIn truncates around 210 chars on mobile).
        - Lead with a concrete noun, person, or moment — not "I", "you", or "we" (fine in sentence 2+).
        - One specific beats three vague: concrete > clever.
        - Past tense generally > present tense (carries more authority).
        - No emojis in the hook itself.

        **FORMAT — return EXACTLY this structure:**

        ---HOOK OPTIONS---
        [Hook 1, single line]
        [Hook 2, single line]
        [Hook 3, single line]
        ---END HOOKS---

        ---POST BODY---
        [The rest of the post, using Hook 1 as the opener.]

        Body guidance:
        - Paragraph RHYTHM should vary. Single-sentence paragraphs work for emphasis but eight in a
          row reads as 'LinkedIn template'. Mix one-liners with 2-3 sentence paragraphs.
        - Build a real arc: setup → tension → turn → takeaway. OR claim → evidence → implication.
        - Use specifics. Real numbers, real names, real dates, real outcomes. Where the source has
          them, keep them. Where it doesn't, avoid making them up — be specific about what the
          source actually says.
        - "You" sparingly. Overusing it ("You know that feeling when...") is a tell.
        - Total 800-1500 characters. Long enough to deliver substance, short enough to feel feed-native.
        ---END BODY---

        ---CTA---
        [A real question or invitation that an actual reader could form an opinion about.
         Specific to the post's topic — not generic engagement bait.]

        GOOD shapes:
        - "Curious if anyone here has run this differently — what worked?"
        - "If you've been on the other side of this hire, what did the manager get wrong?"
        - "What's the one metric that actually moved retention for your team this year?"

        DO NOT generate any of these — they read as engagement bait:
        - "Drop a 🔥 if this resonates"
        - "Agree? I'd love to hear your take." (too generic)
        - "Like and follow for more"
        - "What do you think?" (too vague)
        - "Comment below if you've experienced this"
        ---END CTA---

        Final test before you respond: would a senior person in this field actually post this, or
        would they cringe at it? If the latter, rewrite.
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
