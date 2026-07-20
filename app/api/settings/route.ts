import { NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/settings';
import { anthropicKeyStatus, vidiqKeyStatus } from '@/lib/envKeys';
import { settingsInputSchema } from '@/lib/validation';
import type { SettingsResponseDTO } from '@/lib/types';

async function buildResponse(): Promise<SettingsResponseDTO> {
  return {
    settings: await getSettings(),
    keys: {
      anthropic: anthropicKeyStatus(),
      vidiq: vidiqKeyStatus(),
    },
  };
}

export async function GET() {
  return NextResponse.json(await buildResponse());
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const parsed = settingsInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  await updateSettings(parsed.data);
  return NextResponse.json(await buildResponse());
}
