export interface KeyStatus {
  present: boolean;
  masked: string | null;
}

// Server-only: never import this module from a 'use client' file. It reads
// raw env vars and is careful to only ever expose a masked tail, never the
// full value, to anything that crosses to the browser.
function getKeyStatus(envVar: string): KeyStatus {
  const value = process.env[envVar]?.trim();
  if (!value) return { present: false, masked: null };
  const tail = value.slice(-4);
  return { present: true, masked: `••••${tail}` };
}

export function anthropicKeyStatus(): KeyStatus {
  return getKeyStatus('ANTHROPIC_API_KEY');
}

export function vidiqKeyStatus(): KeyStatus {
  return getKeyStatus('VIDIQ_API_KEY');
}
