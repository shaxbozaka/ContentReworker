import OpenAI from "openai";
import type {
  TransformationRequest,
  TransformationResponse,
  PlatformType,
  PlatformOutput,
  ContentSource,
  ToneType
} from "@shared/schema";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "sk-dummy-key" });

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
  
  // Process each platform in parallel for better performance
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
  
  // Prepare system instructions
  const systemInstructions = getSystemInstructions(tone, outputLength, useHashtags, useEmojis);
  
  // Get platform-specific prompt
  const prompt = getPlatformPrompt(platform, contentSource, content);
  
  // Generate content
  const output = await generateContent(systemInstructions, prompt, platform);
  
  return output;
}

// Parse LinkedIn structured output into hooks, body, and CTA
function parseLinkedInOutput(rawContent: string): PlatformOutput {
  const hooks: string[] = [];
  let body = '';
  let cta = '';

  // Helper to clean quotes and whitespace
  const cleanText = (text: string): string => {
    return text
      .replace(/^["'"]+|["'"]+$/g, '') // Remove surrounding quotes
      .replace(/^[\s\n]+|[\s\n]+$/g, '') // Trim whitespace
      .trim();
  };

  // Extract hooks
  const hooksMatch = rawContent.match(/---HOOK OPTIONS---\s*([\s\S]*?)\s*---END HOOKS---/);
  if (hooksMatch) {
    const hooksSection = hooksMatch[1].trim();
    // Split by newlines and filter out empty lines
    const hookLines = hooksSection.split('\n').filter(line => line.trim());
    hookLines.forEach(line => {
      // Remove any leading markers like "Hook 1:", "[Hook 1]", "1.", "1)", "- ", etc.
      let cleanedHook = line
        .replace(/^(\[?Hook\s*\d+\]?:?|\d+[.\)]\s*|-\s*)/i, '')
        .trim();
      // Remove surrounding quotes
      cleanedHook = cleanText(cleanedHook);
      if (cleanedHook) {
        hooks.push(cleanedHook);
      }
    });
  }

  // Extract body
  const bodyMatch = rawContent.match(/---POST BODY---\s*([\s\S]*?)\s*---END BODY---/);
  if (bodyMatch) {
    body = bodyMatch[1].trim();

    // Remove the hook from the start of body if it's duplicated there
    if (hooks.length > 0) {
      for (const hook of hooks) {
        // Check if body starts with the hook (with or without quotes)
        const hookPattern = new RegExp('^["\']?' + hook.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '["\']?\\s*\\n*', 'i');
        if (hookPattern.test(body)) {
          body = body.replace(hookPattern, '').trim();
          break;
        }
        // Also check for quoted version
        const quotedHook = `"${hook}"`;
        if (body.startsWith(quotedHook)) {
          body = body.substring(quotedHook.length).trim();
          break;
        }
      }
    }
  }

  // Extract CTA
  const ctaMatch = rawContent.match(/---CTA---\s*([\s\S]*?)\s*---END CTA---/);
  if (ctaMatch) {
    cta = cleanText(ctaMatch[1]);
  }

  // Build the full content with first hook as default
  let fullContent = '';
  if (hooks.length > 0 && body) {
    fullContent = hooks[0] + '\n\n' + body;
  } else if (body) {
    fullContent = body;
  } else {
    fullContent = rawContent; // Fallback to raw if parsing failed
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

async function generateContent(
  systemInstructions: string,
  prompt: string,
  platform: PlatformType
): Promise<PlatformOutput> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1500, // Increased for structured LinkedIn output
    });

    const rawContent = response.choices[0].message.content || "";

    // For LinkedIn, parse the structured output
    if (platform === "LinkedIn") {
      return parseLinkedInOutput(rawContent);
    }

    // For other platforms, return simple format
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
  // Map outputLength (1-5) to descriptive length
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
        
        Create a Twitter thread (multiple tweets) that captures the main points of the content.
        Each tweet should be under 280 characters.
        Format as a cohesive thread with (1/X) numbering at the end of each tweet.
        Make it engaging and shareable.
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
        Structure it with short paragraphs and line breaks for easy mobile reading.
        If using hashtags, group them at the end.
        Keep it under 2200 characters.
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
