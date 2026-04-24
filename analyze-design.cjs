const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function analyzeDesign(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = 'image/png';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `You are a senior UI/UX designer at a top tech company. Analyze this SaaS web app screenshot and provide SPECIFIC, ACTIONABLE design improvements.

Focus on:
1. Visual hierarchy - what draws attention first, is it right?
2. Spacing & alignment issues
3. Color usage and contrast
4. Typography problems
5. Button/CTA effectiveness
6. Overall professional polish

For each issue, provide:
- WHAT is wrong (be specific, reference exact elements)
- WHY it matters (user impact)
- HOW to fix it (specific CSS/design changes)

Be brutally honest. Rate overall design 1-10 and list TOP 5 fixes that would have the biggest impact.`
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`
            }
          }
        ]
      }
    ],
    max_tokens: 2000,
  });

  return response.choices[0].message.content;
}

async function main() {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error('Usage: node analyze-design.js <image-path>');
    process.exit(1);
  }

  console.log(`Analyzing: ${imagePath}\n`);
  const analysis = await analyzeDesign(imagePath);
  console.log(analysis);
}

main().catch(console.error);
