'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ChannelDTO, DailyPlanDTO } from '@/lib/types';
import { getDashboardState } from '@/lib/dashboard';
import { OwnerBadge } from './OwnerBadge';
import { MicIndicator } from './MicIndicator';
import { GenerateControl } from './GenerateControl';
import { CollapsibleSection } from './CollapsibleSection';
import { MarkPostedForm } from './MarkPostedForm';

export function DashboardCard({
  channel,
  plan,
  isGenerating,
  generateError,
  onGenerate,
  isPosting,
  postError,
  onMarkPosted,
}: {
  channel: ChannelDTO;
  plan: DailyPlanDTO | null;
  isGenerating: boolean;
  generateError?: string;
  onGenerate: () => void;
  isPosting: boolean;
  postError?: string;
  onMarkPosted: (stats: { views: number; likes: number; comments: number }) => Promise<boolean>;
}) {
  const [showPostForm, setShowPostForm] = useState(false);
  const state = getDashboardState(plan);

  async function handleSave(stats: { views: number; likes: number; comments: number }) {
    const ok = await onMarkPosted(stats);
    if (ok) setShowPostForm(false);
  }

  return (
    <div
      style={{ borderLeftColor: channel.accentColor }}
      className="flex h-full flex-col rounded-xl border-l-[3px] bg-zinc-900 p-5 shadow-sm shadow-black/20 ring-1 ring-white/[0.04]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-heading text-base font-semibold tracking-tight text-zinc-50">
            {channel.name}
          </h3>
          <p className="mt-1 truncate text-sm font-light text-zinc-400">{channel.niche}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <OwnerBadge owner={channel.owner} />
          <MicIndicator on={channel.needsVoiceover} />
        </div>
      </div>

      <div className="mt-4 flex flex-1 flex-col justify-end gap-3">
        {state === 'no-idea' && (
          <GenerateControl
            variant="primary"
            label="Generate idea"
            loadingLabel="Generating..."
            isLoading={isGenerating}
            error={generateError}
            onTrigger={onGenerate}
            accentColor={channel.accentColor}
          />
        )}

        {state === 'idea' && plan && (
          <div className="space-y-3">
            <div>
              <p className="font-medium text-zinc-100">{plan.ideaTitle}</p>
              {plan.hook && <p className="mt-1 text-sm italic text-zinc-500">{plan.hook}</p>}
            </div>

            {plan.videoPrompt && <CollapsibleSection title="Video prompt" content={plan.videoPrompt} />}
            {channel.needsVoiceover && plan.voiceoverScript && (
              <CollapsibleSection title="Voiceover script" content={plan.voiceoverScript} />
            )}

            {showPostForm ? (
              <MarkPostedForm
                isSaving={isPosting}
                error={postError}
                onCancel={() => setShowPostForm(false)}
                onSave={handleSave}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowPostForm(true)}
                className="w-full rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
              >
                Mark as posted
              </button>
            )}

            {!showPostForm && (
              <div className="flex justify-center pt-0.5">
                <GenerateControl
                  variant="link"
                  label="Generate a different idea"
                  loadingLabel="Generating a new idea..."
                  isLoading={isGenerating}
                  error={generateError}
                  onTrigger={onGenerate}
                />
              </div>
            )}
          </div>
        )}

        {state === 'posted' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <CheckCircle2 size={16} className="text-emerald-400" />
              Posted today
            </div>
            <GenerateControl
              variant="small"
              label="Generate next idea"
              loadingLabel="Generating..."
              isLoading={isGenerating}
              error={generateError}
              onTrigger={onGenerate}
              accentColor={channel.accentColor}
            />
          </div>
        )}
      </div>
    </div>
  );
}
