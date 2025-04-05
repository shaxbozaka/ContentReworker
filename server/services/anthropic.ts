import Anthropic from '@anthropic-ai/sdk';
import { ContentSource, PlatformType, ToneType } from '@shared/schema';

// The newest Anthropic model is "claude-3-7-sonnet-20250219" which was released February 24, 2025
const CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';

// Check if the API key is set
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

interface RegenerationRequest {
  content: string;
  contentSource: ContentSource;
  platform: PlatformType;
  tone: ToneType;
  outputLength: number;
  useHashtags: boolean;
  useEmojis: boolean;
}

// Initialize the Anthropic client only if the API key is available
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set');
  }

  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: ANTHROPIC_API_KEY,
    });
  }

  return anthropicClient;
}

export async function repurposeContent(
  content: string, 
  contentSource: ContentSource, 
  platforms: PlatformType[], 
  tone: ToneType, 
  outputLength: number,
  useHashtags: boolean,
  useEmojis: boolean
): Promise<Record<PlatformType, { content: string, characterCount: number }>> {
  const anthropic = getAnthropicClient();
  const outputs: Record<PlatformType, { content: string, characterCount: number }> = {} as any;
  
  // Process each platform in parallel for faster results
  await Promise.all(platforms.map(async (platform) => {
    const result = await generateContent(
      anthropic,
      content, 
      contentSource, 
      platform, 
      tone, 
      outputLength,
      useHashtags,
      useEmojis
    );
    
    outputs[platform] = {
      content: result,
      characterCount: result.length
    };
  }));
  
  return outputs;
}

export async function regenerateContent(request: RegenerationRequest): Promise<{ content: string, characterCount: number }> {
  const anthropic = getAnthropicClient();
  
  const content = await generateContent(
    anthropic,
    request.content,
    request.contentSource,
    request.platform,
    request.tone,
    request.outputLength,
    request.useHashtags,
    request.useEmojis
  );
  
  return {
    content,
    characterCount: content.length
  };
}

async function generateContent(
  anthropic: Anthropic,
  content: string,
  contentSource: ContentSource,
  platform: PlatformType,
  tone: ToneType,
  outputLength: number,
  useHashtags: boolean,
  useEmojis: boolean
): Promise<string> {
  const systemInstructions = getSystemInstructions(tone, outputLength, useHashtags, useEmojis);
  const platformPrompt = getPlatformPrompt(platform, contentSource, content);
  
  try {
    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      system: systemInstructions,
      messages: [
        { role: 'user', content: platformPrompt }
      ]
    });
    
    // The content array will contain at least one item with text content
    const content = response.content[0] as { type: string, text: string };
    return content.text;
  } catch (error: any) {
    console.error(`Anthropic API error:`, error);
    throw new Error(`Failed to generate content for ${platform}: ${error.message}`);
  }
}

function getSystemInstructions(
  tone: ToneType, 
  outputLength: number,
  useHashtags: boolean,
  useEmojis: boolean
): string {
  // Map output length to descriptive length
  const lengthDescriptions = {
    1: 'very concise',
    2: 'concise',
    3: 'moderate length',
    4: 'detailed',
    5: 'comprehensive and detailed'
  };
  
  const lengthDescription = lengthDescriptions[outputLength as keyof typeof lengthDescriptions] || 'moderate length';
  
  // Build system instructions
  let instructions = `You are an expert content repurposing assistant that helps creators transform long-form content into optimized formats for different platforms.
  
Your task is to rewrite the provided content for the specified platform, maintaining the key messages while adapting the style and format to be highly effective for that platform.

Follow these guidelines:
- Use a ${tone.toLowerCase()} tone
- Create a ${lengthDescription} output appropriate for the target platform
- Preserve the most important points from the original content
- Optimize the format, style, and presentation for the specific platform
- Make the content engaging and likely to perform well on the target platform
- Improve clarity and readability`;

  if (useHashtags) {
    instructions += '\n- Include 3-5 relevant hashtags where appropriate for the platform';
  } else {
    instructions += '\n- Do not include hashtags';
  }
  
  if (useEmojis) {
    instructions += '\n- Use relevant emojis to enhance the content where appropriate';
  } else {
    instructions += '\n- Do not use emojis';
  }
  
  instructions += '\n\nYour output should be ready to publish on the specified platform without requiring further editing.';
  
  return instructions;
}

function getPlatformPrompt(platform: PlatformType, contentSource: ContentSource, content: string): string {
  // Platform-specific prompts
  const platformPrompts: Record<PlatformType, string> = {
    Twitter: `Transform the following ${contentSource.toLowerCase()} into an engaging Twitter thread. Break it into 5-7 tweets that capture the main points. Each tweet should be under 280 characters and compelling on its own, while the thread should flow naturally from one tweet to the next. Number each tweet.`,
    
    LinkedIn: `Transform the following ${contentSource.toLowerCase()} into a professional LinkedIn post that will engage a business audience. Focus on key insights, professional takeaways, and business value. The post should be well-structured with paragraphs, bullet points where appropriate, and a clear call to action at the end.`,
    
    Instagram: `Transform the following ${contentSource.toLowerCase()} into an engaging Instagram caption. The caption should be attention-grabbing, personal, and relatable while conveying the main message. Consider how this would appear alongside an image that captures the essence of the content.`,
    
    Email: `Transform the following ${contentSource.toLowerCase()} into an email newsletter segment. Create a compelling subject line followed by the body content that's engaging, valuable, and formatted for easy reading in an email context. Include a clear call to action.`,
    
    Summary: `Create a concise summary of the following ${contentSource.toLowerCase()} that captures all the key points in a few paragraphs. The summary should be comprehensive yet brief, highlighting the most important information.`,
    
    Calendar: `Transform the following ${contentSource.toLowerCase()} into a content calendar outline with 5-10 derivative content ideas that could be created from this original content. For each idea, provide a brief title/concept and a one-sentence description of what the content would cover.`,
  };
  
  return `${platformPrompts[platform]}\n\nOriginal ${contentSource}:\n"${content}"`;
}