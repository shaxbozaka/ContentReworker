/**
 * DALL-E 3 Image Generation Service
 * Generates high-quality images for Pro users
 */

import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export type ImageSize = '1024x1024' | '1792x1024' | '1024x1792';
export type ImageStyle = 'vivid' | 'natural';

export interface GenerateImageOptions {
  prompt: string;
  size?: ImageSize;
  style?: ImageStyle;
  quality?: 'standard' | 'hd';
}

export interface GeneratedImage {
  url: string;
  revisedPrompt: string;
}

/**
 * Generate an image using DALL-E 3
 */
export async function generateImage(options: GenerateImageOptions): Promise<GeneratedImage> {
  const {
    prompt,
    size = '1024x1024',
    style = 'vivid',
    quality = 'hd',
  } = options;

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size,
    style,
    quality,
  });

  const image = response.data[0];

  if (!image.url) {
    throw new Error('No image URL returned from DALL-E');
  }

  return {
    url: image.url,
    revisedPrompt: image.revised_prompt || prompt,
  };
}

/**
 * Extract safe visual themes from content
 * Maps common topics to safe, abstract visual concepts
 */
function extractVisualTheme(content: string): string {
  const lowerContent = content.toLowerCase();

  // Map keywords to safe visual themes
  const themeMap: Array<{ keywords: string[]; theme: string }> = [
    { keywords: ['work', 'remote', 'office', 'job', 'career', 'professional'], theme: 'modern workspace with laptop and coffee, productivity aesthetic' },
    { keywords: ['business', 'startup', 'entrepreneur', 'company', 'growth'], theme: 'abstract business growth visualization, upward trending lines' },
    { keywords: ['technology', 'tech', 'software', 'ai', 'digital', 'code'], theme: 'futuristic technology visualization, glowing circuits and data' },
    { keywords: ['marketing', 'social', 'content', 'brand', 'audience'], theme: 'connected network of people, social connections visualization' },
    { keywords: ['success', 'achieve', 'goal', 'win', 'accomplish'], theme: 'mountain peak with sunrise, achievement and success metaphor' },
    { keywords: ['learn', 'education', 'skill', 'knowledge', 'study'], theme: 'open book with glowing ideas floating upward, knowledge concept' },
    { keywords: ['health', 'fitness', 'wellness', 'exercise', 'mindful'], theme: 'serene nature scene with morning light, wellness and balance' },
    { keywords: ['creative', 'design', 'art', 'innovation', 'idea'], theme: 'colorful abstract shapes and flowing creativity, artistic expression' },
    { keywords: ['team', 'collaborate', 'together', 'community', 'people'], theme: 'diverse hands coming together, teamwork and unity' },
    { keywords: ['money', 'finance', 'invest', 'wealth', 'profit'], theme: 'abstract financial growth chart, prosperity visualization' },
    { keywords: ['time', 'productivity', 'efficiency', 'schedule', 'manage'], theme: 'elegant clock with flowing time particles, time management concept' },
    { keywords: ['change', 'transform', 'pivot', 'adapt', 'evolve'], theme: 'butterfly emerging from cocoon, transformation metaphor' },
    { keywords: ['future', 'vision', 'dream', 'plan', 'strategy'], theme: 'person looking at horizon with city skyline, future vision' },
  ];

  // Find matching theme
  for (const { keywords, theme } of themeMap) {
    if (keywords.some(kw => lowerContent.includes(kw))) {
      return theme;
    }
  }

  // Default professional theme
  return 'abstract professional gradient background with subtle geometric shapes';
}

/**
 * Generate a social media image from content
 */
export async function generateSocialImage(
  content: string,
  platform: 'twitter' | 'linkedin' | 'instagram',
  style: 'professional' | 'creative' | 'minimal' = 'creative'
): Promise<GeneratedImage> {
  const styleGuides = {
    professional: 'clean, corporate, minimalist design with subtle blue and gray tones',
    creative: 'vibrant, eye-catching, modern design with bold gradient colors',
    minimal: 'simple, elegant, lots of white space, single focal point',
  };

  const platformGuides = {
    twitter: 'wide panoramic format, suitable for social media banner',
    linkedin: 'professional wide format, business-appropriate aesthetic',
    instagram: 'square format, visually striking, scroll-stopping composition',
  };

  // Extract safe visual theme from content
  const visualTheme = extractVisualTheme(content);

  const prompt = `Create a ${styleGuides[style]} social media graphic.
Format: ${platformGuides[platform]}.
Visual concept: ${visualTheme}.
Style: Modern 2024 design trends, absolutely no text or letters in the image, suitable as a background or hero image.
Make it visually compelling, professional, and shareable. Photorealistic or high-quality 3D render style.`;

  const sizes: Record<string, ImageSize> = {
    twitter: '1792x1024',
    linkedin: '1792x1024',
    instagram: '1024x1024',
  };

  try {
    return await generateImage({
      prompt,
      size: sizes[platform],
      style: 'vivid',
      quality: 'hd',
    });
  } catch (error: any) {
    // If still rejected, try with a completely safe fallback prompt
    if (error.message?.includes('safety') || error.message?.includes('rejected')) {
      const fallbackPrompt = `Create a ${styleGuides[style]} abstract background image.
Format: ${platformGuides[platform]}.
Style: Modern gradient with subtle geometric patterns, professional and clean.
No text, no people, just beautiful abstract visuals suitable for social media.`;

      return await generateImage({
        prompt: fallbackPrompt,
        size: sizes[platform],
        style: 'vivid',
        quality: 'hd',
      });
    }
    throw error;
  }
}

/**
 * Generate a thumbnail image
 */
export async function generateThumbnail(
  title: string,
  description: string
): Promise<GeneratedImage> {
  const prompt = `Create a YouTube-style thumbnail image.
Topic: ${title}
Context: ${description.slice(0, 200)}
Style: Bold, vibrant colors, high contrast, professional, eye-catching, modern 2024 design.
No text in the image. Create a compelling visual that represents the topic.
Make it click-worthy and professional.`;

  return generateImage({
    prompt,
    size: '1792x1024',
    style: 'vivid',
    quality: 'hd',
  });
}
