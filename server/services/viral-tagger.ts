import OpenAI from 'openai';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '../db';
import { curatedVirals } from '../../shared/schema';

// Use the Gemini OpenAI-compatible endpoint so we avoid another SDK.
// 2.5-flash-lite is cheap (~$0.0001 / post) and reliable for short classification.
const client = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
});

const MODEL = 'gemini-2.5-flash-lite';

const SYSTEM = `You tag short viral social posts with 3-5 topic labels for a recommendation engine.
Rules:
- Return ONLY a JSON array of lowercase kebab-case strings, e.g. ["ai", "personal-branding", "short-form-video"]
- No prose, no code fences, no explanations.
- Prefer well-known topic labels that recur across posts (so overlap across posts is meaningful):
  ai, machine-learning, llm, startup, bootstrapping, fundraising, saas, b2b, marketing,
  growth, seo, content-marketing, social-media, personal-branding, copywriting, sales,
  cold-email, leadership, management, career, productivity, remote-work, hiring,
  design, ux, frontend, backend, devops, programming, fintech, crypto, web3,
  education, parenting, fitness, health, mindset, motivation, self-improvement,
  finance, investing, real-estate, entrepreneurship, freelancing, creator-economy,
  video, shorts, reels, podcast, newsletter, community, tools, productivity-tools.
- If a post doesn't obviously fit, invent a concise topic; lowercase kebab-case still.`;

export async function tagContent(hook: string, content: string): Promise<string[]> {
  const text = `${hook}\n\n${content}`.slice(0, 1500);
  try {
    const res = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      max_tokens: 80,
    });
    const raw = res.choices[0]?.message?.content?.trim() || '[]';
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
        .filter((t) => t.length > 0)
        .slice(0, 5);
    }
  } catch (err: any) {
    console.warn('[viral-tagger] tag failed:', err.message);
  }
  return [];
}

// Tag a single viral row if it hasn't been tagged yet.
export async function tagViral(viralId: number): Promise<void> {
  const [viral] = await db
    .select({ id: curatedVirals.id, hook: curatedVirals.hook, content: curatedVirals.content, topicsTaggedAt: curatedVirals.topicsTaggedAt })
    .from(curatedVirals)
    .where(eq(curatedVirals.id, viralId));
  if (!viral || viral.topicsTaggedAt) return;

  const topics = await tagContent(viral.hook, viral.content);
  await db
    .update(curatedVirals)
    .set({ topics, topicsTaggedAt: new Date() })
    .where(eq(curatedVirals.id, viralId));
}

// Background job: tag everything missing. Small batch so we respect rate limits.
export async function tagUntagged(batchSize = 20): Promise<number> {
  if (!process.env.GEMINI_API_KEY) return 0;

  const rows = await db
    .select({ id: curatedVirals.id, hook: curatedVirals.hook, content: curatedVirals.content })
    .from(curatedVirals)
    .where(isNull(curatedVirals.topicsTaggedAt))
    .limit(batchSize);

  let tagged = 0;
  for (const row of rows) {
    const topics = await tagContent(row.hook, row.content);
    await db
      .update(curatedVirals)
      .set({ topics, topicsTaggedAt: new Date() })
      .where(eq(curatedVirals.id, row.id));
    tagged++;
    // Tiny spacer to avoid bursts
    await new Promise((r) => setTimeout(r, 100));
  }
  return tagged;
}
