const HOOK_TEMPLATES = [
  "You've never heard this one about {niche}.",
  "This {niche} fact sounds fake. It isn't.",
  'Wait until the last five seconds on this one.',
  "Nobody talks about this side of {niche}.",
  "This changed how I think about {niche}.",
];

const TITLE_TEMPLATES = [
  'The {niche} story nobody tells',
  'Why {niche} is stranger than you think',
  '3 things about {niche} that don’t add up',
  'The {niche} fact that broke my brain',
  'What they don’t teach about {niche}',
];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function fillTemplate(template: string, niche: string): string {
  return template.replace(/\{niche\}/g, niche.toLowerCase());
}

export interface GeneratedIdea {
  ideaTitle: string;
  hook: string;
  videoPrompt: string;
  voiceoverScript: string | null;
}

export function generateIdea(niche: string, needsVoiceover: boolean, voiceStyle: string | null): GeneratedIdea {
  const title = fillTemplate(pick(TITLE_TEMPLATES), niche);
  const hook = fillTemplate(pick(HOOK_TEMPLATES), niche);

  const videoPrompt = [
    `Vertical short-form video, 30-45 seconds, niche: ${niche}.`,
    `Open on a bold hook frame: "${hook}"`,
    'Fast cuts every 1-2 seconds, high-contrast captions burned in, punchy sound design.',
    'Close on a clear payoff and a one-line call to action to follow for more.',
  ].join('\n');

  const voiceoverScript = needsVoiceover
    ? [
        `[VOICEOVER${voiceStyle ? ` — ${voiceStyle}` : ''}]`,
        `${hook}`,
        `Here's the story behind it: ${title.toLowerCase()}.`,
        'Stick around, because the ending is the part everyone gets wrong.',
      ].join('\n')
    : null;

  return { ideaTitle: title, hook, videoPrompt, voiceoverScript };
}
