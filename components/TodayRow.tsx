'use client';

import { useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import type { ChannelDTO, DailyPlanDTO } from '@/lib/types';
import { GenerateControl } from './GenerateControl';
import { MarkPostedForm } from './MarkPostedForm';

export function TodayRow({
  channel,
  plan,
  variant,
  isGenerating,
  generateError,
  onGenerate,
  isPosting,
  postError,
  onMarkPosted,
}: {
  channel: ChannelDTO;
  plan: DailyPlanDTO | null;
  variant: 'needs-idea' | 'idea-not-posted' | 'posted';
  isGenerating: boolean;
  generateError?: string;
  onGenerate: () => void;
  isPosting: boolean;
  postError?: string;
  onMarkPosted: (stats: { views: number; likes: number; comments: number }) => Promise<boolean>;
}) {
  const [showPostForm, setShowPostForm] = useState(false);

  async function handleSave(stats: { views: number; likes: number; comments: number }) {
    const ok = await onMarkPosted(stats);
    if (ok) setShowPostForm(false);
  }

  return (
    <li
      style={{ borderLeftColor: channel.accentColor }}
      className="border-l-[3px] px-4 py-3.5 sm:px-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${
              variant === 'posted' ? 'text-zinc-500 line-through decoration-zinc-700' : 'text-zinc-100'
            }`}
          >
            {variant === 'needs-idea' ? channel.name : plan?.ideaTitle ?? channel.name}
          </p>
          <p className="mt-0.5 truncate text-xs font-light text-zinc-500">
            {variant === 'needs-idea'
              ? channel.niche
              : variant === 'idea-not-posted'
                ? channel.name
                : `${channel.name} · posted`}
          </p>
        </div>

        <div className="shrink-0">
          {variant === 'needs-idea' && (
            <GenerateControl
              variant="small"
              label="Generate"
              loadingLabel="Generating..."
              isLoading={isGenerating}
              error={generateError}
              onTrigger={onGenerate}
              accentColor={channel.accentColor}
            />
          )}
          {variant === 'idea-not-posted' && !showPostForm && (
            <button
              type="button"
              onClick={() => setShowPostForm(true)}
              className="rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              Mark posted
            </button>
          )}
          {variant === 'posted' && (
            <CheckCircle2 size={20} className="animate-pop-in text-emerald-500" />
          )}
        </div>
      </div>

      {variant === 'idea-not-posted' && showPostForm && (
        <div className="mt-3">
          <MarkPostedForm
            isSaving={isPosting}
            error={postError}
            onCancel={() => setShowPostForm(false)}
            onSave={handleSave}
          />
        </div>
      )}
    </li>
  );
}
