'use client';

import { useRef, useState } from 'react';
import { Download, FileWarning, Loader2, Upload } from 'lucide-react';
import { ApiError, exportAllData, exportTodayPrompts, importData } from '@/lib/client-api';

export function BackupSection() {
  const [exportingToday, setExportingToday] = useState(false);
  const [exportTodayError, setExportTodayError] = useState<string | null>(null);
  const [exportingAll, setExportingAll] = useState(false);
  const [exportAllError, setExportAllError] = useState<string | null>(null);

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExportToday() {
    setExportingToday(true);
    setExportTodayError(null);
    try {
      await exportTodayPrompts();
    } catch (err) {
      setExportTodayError(err instanceof ApiError ? err.message : 'Export failed. Try again.');
    } finally {
      setExportingToday(false);
    }
  }

  async function handleExportAll() {
    setExportingAll(true);
    setExportAllError(null);
    try {
      await exportAllData();
    } catch (err) {
      setExportAllError(err instanceof ApiError ? err.message : 'Export failed. Try again.');
    } finally {
      setExportingAll(false);
    }
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setImportError(null);
    setImportSuccess(null);
    if (file) setPendingFile(file);
  }

  function cancelImport() {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function confirmImport() {
    if (!pendingFile) return;
    setImporting(true);
    setImportError(null);
    try {
      const text = await pendingFile.text();
      const json = JSON.parse(text);
      const { counts } = await importData(json);
      setImportSuccess(
        `Restored ${counts.channels} channel${counts.channels === 1 ? '' : 's'}, ${counts.dailyPlans} plan${counts.dailyPlans === 1 ? '' : 's'}, ${counts.postedVideos} video${counts.postedVideos === 1 ? '' : 's'}, and ${counts.insights} insight${counts.insights === 1 ? '' : 's'}.`
      );
      setPendingFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      if (err instanceof ApiError) {
        setImportError(err.message);
      } else if (err instanceof SyntaxError) {
        setImportError('That file is not valid JSON.');
      } else {
        setImportError('Import failed. Try again.');
      }
    } finally {
      setImporting(false);
    }
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
      <h2 className="font-heading text-sm font-semibold tracking-tight text-zinc-200">
        Export &amp; backup
      </h2>
      <p className="mt-1 text-xs font-light leading-relaxed text-zinc-500">
        This runs locally on one machine — your data isn&apos;t backed up anywhere else unless you
        export it.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-200">Export today&apos;s prompts</p>
            <p className="mt-0.5 text-xs font-light text-zinc-500">
              Every channel&apos;s current idea, prompt, and voiceover script in one markdown file.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportToday}
            disabled={exportingToday}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingToday ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export
          </button>
        </div>
        {exportTodayError && <p className="text-xs text-rose-400">{exportTodayError}</p>}

        <div className="flex flex-col gap-2 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-200">Export all data</p>
            <p className="mt-0.5 text-xs font-light text-zinc-500">
              A full JSON backup of every channel, plan, posted video, and insight.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportAll}
            disabled={exportingAll}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingAll ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            Export
          </button>
        </div>
        {exportAllError && <p className="text-xs text-rose-400">{exportAllError}</p>}

        <div className="border-t border-zinc-800 pt-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-200">Import data</p>
              <p className="mt-0.5 text-xs font-light text-zinc-500">
                Restore from a full JSON backup. This replaces everything currently in the app.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-700 px-3.5 py-2 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-600 hover:text-zinc-100"
            >
              <Upload size={14} />
              Choose file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={handleFileSelected}
              className="hidden"
            />
          </div>

          {pendingFile && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="flex items-start gap-2">
                <FileWarning size={15} className="mt-0.5 shrink-0 text-amber-400" />
                <p className="text-sm leading-relaxed text-amber-200">
                  This will permanently replace ALL current data with the contents of{' '}
                  <span className="font-medium">{pendingFile.name}</span>. This can&apos;t be
                  undone.
                </p>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelImport}
                  disabled={importing}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmImport}
                  disabled={importing}
                  className="flex items-center gap-1.5 rounded-md bg-rose-500/90 px-2.5 py-1 text-xs font-medium text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {importing && <Loader2 size={12} className="animate-spin" />}
                  Yes, replace everything
                </button>
              </div>
            </div>
          )}

          {importError && <p className="mt-2 text-xs text-rose-400">{importError}</p>}
          {importSuccess && <p className="mt-2 text-xs text-emerald-400">{importSuccess}</p>}
        </div>
      </div>
    </section>
  );
}
