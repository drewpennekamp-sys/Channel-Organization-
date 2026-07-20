import { getSettings } from '@/lib/settings';
import { anthropicKeyStatus, vidiqKeyStatus } from '@/lib/envKeys';
import { SettingsScreen } from '@/components/SettingsScreen';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const settings = await getSettings();
  const keys = { anthropic: anthropicKeyStatus(), vidiq: vidiqKeyStatus() };

  return <SettingsScreen initialSettings={settings} initialKeys={keys} />;
}
