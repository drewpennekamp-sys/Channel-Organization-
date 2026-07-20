import Anthropic from '@anthropic-ai/sdk';
import type { PostedVideoDTO } from './types';
import { parseAnalysisResponse, type AnalysisResult } from './insights';

// Reads ANTHROPIC_API_KEY from the environment. Must be set for /analyze to work.
const client = new Anthropic();

const SYSTEM_PROMPT = `You are a short-form video strategist reviewing one creator's posted video performance for a single channel. You are given the channel's niche and its full posting history: titles, post dates, views, likes, comments, shares, average view duration, and any retention notes the creator wrote themselves.

Identify the single most important pattern in the data — what's working, what isn't — and give concrete next steps.

Respond with ONLY valid JSON. No markdown code fences, no commentary before or after the JSON, nothing but the object itself, in exactly this shape:
{"summary": "one or two plain-language sentences naming the most important pattern", "recommendations": ["a short, concrete, actionable directive phrased as a command", "..."]}

Rules for the fields:
- "summary" must reference specifics from the data (titles, numbers, or the retention notes) rather than generic advice.
- "recommendations" must contain between 2 and 4 items, each a short imperative sentence (e.g. "Open with the payoff, not the setup", "Test a 15-second cut this week") — not vague encouragement.`;

function formatVideoLine(video: PostedVideoDTO): string {
  const parts = [
    `"${video.ideaTitle}"`,
    `posted ${new Date(video.postedAt).toISOString().slice(0, 10)}`,
    `${video.views} views`,
    `${video.likes} likes`,
    `${video.comments} comments`,
  ];
  if (video.shares !== null) parts.push(`${video.shares} shares`);
  if (video.avgViewDuration !== null) parts.push(`${video.avgViewDuration}s avg view duration`);
  if (video.retentionNote) parts.push(`creator's note: "${video.retentionNote}"`);
  return `- ${parts.join(', ')}`;
}

export async function generateChannelAnalysis(
  niche: string,
  videos: PostedVideoDTO[]
): Promise<AnalysisResult> {
  const videoLines = videos.map(formatVideoLine).join('\n');
  const userMessage = `Niche: ${niche}\n\nPosted videos (${videos.length} total, most recent first):\n${videoLines}\n\nAnalyze what's working, what isn't, and what to change next.`;

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 2048,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The analysis was declined. Try again.');
  }

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');

  return parseAnalysisResponse(text);
}
