import OpenAI from "openai";
import type { 
  TransformationRequest, 
  TransformationResponse, 
  PlatformType,
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

export async function regenerateContent(request: RegenerationRequest): Promise<{ content: string, characterCount: number }> {
  const { content, contentSource, platform, tone, outputLength, useHashtags, useEmojis } = request;
  
  // Prepare system instructions
  const systemInstructions = getSystemInstructions(tone, outputLength, useHashtags, useEmojis);
  
  // Get platform-specific prompt
  const prompt = getPlatformPrompt(platform, contentSource, content);
  
  // Generate content
  const output = await generateContent(systemInstructions, prompt, platform);
  
  return output;
}

async function generateContent(
  systemInstructions: string, 
  prompt: string, 
  platform: PlatformType
): Promise<{ content: string, characterCount: number }> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemInstructions },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });
    
    const content = response.choices[0].message.content || "";
    const characterCount = content.length;
    
    return { content, characterCount };
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
        
        Create a professional LinkedIn post that highlights the key insights and valuable takeaways.
        Include paragraph breaks for readability.
        Add a call to action at the end.
        Use a professional tone appropriate for a business audience.
        Keep it under 3000 characters.
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
    
    case "Summary":
      return `
        ${basePrompt}
        
        Create a concise bullet-point summary that captures all the key points.
        Organize points logically with main points and sub-points where needed.
        Ensure the summary is comprehensive yet easy to scan.
      `;
    
    case "Calendar":
      return `
        ${basePrompt}
        
        Create a content calendar outline with suggestions for breaking this content into multiple pieces.
        Include content types (blog, social media, video, etc.), titles, and brief descriptions.
        Structure it as a weekly plan with specific content pieces for each day.
      `;
    
    default:
      return basePrompt;
  }
}
