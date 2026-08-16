'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { processCapture } from '@/lib/capture/imageChecks';
import type { ScanResult } from '@/lib/scanner/types';

interface ScanResponse {
  ok: boolean;
  error?: string;
  result?: ScanResult;
  frontImagePath?: string | null;
  backImagePath?: string | null;
}

interface FormState {
  year: string;
  brand: string;
  set: string;
  subset: string;
  player: string;
  cardNumber: string;
  parallel: string;
  serialNumbering: string;
  isAuto: boolean;
  isRelic: boolean;
  sport: string;
  grade: string;
  certNumber: string;
  purchasePrice: string;
  purchaseDate: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  year: '',
  brand: '',
  set: '',
  subset: '',
  player: '',
  cardNumber: '',
  parallel: '',
  serialNumbering: '',
  isAuto: false,
  isRelic: false,
  sport: '',
  grade: 'RAW',
  certNumber: '',
  purchasePrice: '',
  purchaseDate: '',
  notes: '',
};

const CONFIDENCE_LABEL: Record<NonNullable<ScanResult['confidence']>, string> = {
  exact: 'Exact match (cert)',
  high: 'High confidence',
  low: 'Parallel uncertain',
  unresolved: 'Not in catalog — check every field',
};

const CONFIDENCE_STYLE: Record<NonNullable<ScanResult['confidence']>, string> = {
  exact: 'bg-green-100 text-green-800',
  high: 'bg-green-100 text-green-800',
  low: 'bg-blue-100 text-blue-800',
  unresolved: 'bg-amber-100 text-amber-800',
};

const inputClass =
  'rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';
// "Spot blue" — the one highlight color for anything the scanner couldn't
// confirm, so it's visually distinct from a normal field without reading
// as an error.
const uncertainInputClass =
  'rounded-md border-2 border-blue-400 bg-blue-50 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400';

function PhotoPicker({
  label,
  checkGlare,
  onProcessed,
}: {
  label: string;
  checkGlare: boolean;
  onProcessed: (file: File | null, previewUrl: string | null) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [accepted, setAccepted] = useState(false);

  async function handleFile(raw: File | undefined) {
    if (!raw) return;
    setChecking(true);
    setReasons([]);
    setAccepted(false);
    onProcessed(null, null);
    try {
      const result = await processCapture(raw, { checkGlare });
      const url = URL.createObjectURL(result.processedBlob);
      setPreviewUrl(url);
      if (!result.ok) {
        setReasons(result.reasons);
        return;
      }
      const processed = new File([result.processedBlob], `${label.toLowerCase()}.jpg`, { type: 'image/jpeg' });
      setAccepted(true);
      onProcessed(processed, url);
    } catch (err: unknown) {
      console.error('Capture check failed:', err);
      setReasons(['Could not process that photo — try again.']);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="flex-1">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/40 p-4 text-center hover:bg-secondary">
        {previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={previewUrl} alt={`${label} preview`} className="h-32 w-auto rounded-md object-contain" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="aspect-[2.5/3.5] h-[88%] rounded border-2 border-dashed border-blue-400/60" />
            </div>
          </div>
        ) : (
          <span className="text-3xl">📷</span>
        )}
        <span className="text-sm font-medium">{checking ? 'Checking photo…' : label}</span>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void handleFile(f);
          }}
        />
      </label>
      {reasons.length > 0 && (
        <div className="mt-1.5 rounded-md bg-red-50 p-2 text-xs text-red-700">
          {reasons.map((r) => (
            <p key={r}>{r}</p>
          ))}
          <p className="mt-1 font-medium">Tap the box above to retake.</p>
        </div>
      )}
      {accepted && <p className="mt-1.5 text-xs text-green-700">✓ Looks good</p>}
    </div>
  );
}

function Field({
  label,
  uncertain,
  children,
}: {
  label: string;
  uncertain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted-foreground">
        {label}
        {uncertain && <span className="ml-1.5 text-[11px] font-normal text-blue-600">unconfirmed</span>}
      </span>
      {children}
    </label>
  );
}

export default function AddCardPage() {
  const router = useRouter();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [hasScanned, setHasScanned] = useState(false);
  const [scanMeta, setScanMeta] = useState<{
    confidence: ScanResult['confidence'];
    method: ScanResult['method'];
    parallelCandidates: string[];
  } | null>(null);

  const [imagePaths, setImagePaths] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null,
  });
  const [rawCopyrightYear, setRawCopyrightYear] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [parallelConfirmed, setParallelConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const uncertainFieldsUnresolved = scanMeta?.confidence === 'unresolved';
  const parallelUncertain = scanMeta?.confidence === 'low';

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === 'parallel') setParallelConfirmed(false);
  }

  async function handleScan() {
    if (!frontFile || !backFile) {
      setScanError('Both front and back photos are required.');
      return;
    }
    setScanning(true);
    setScanError(null);
    setParallelConfirmed(false);
    try {
      const body = new FormData();
      body.append('front', frontFile);
      body.append('back', backFile);

      const res = await fetch('/api/scan', { method: 'POST', body });
      const data = (await res.json()) as ScanResponse;

      setImagePaths({ front: data.frontImagePath ?? null, back: data.backImagePath ?? null });
      setHasScanned(true);

      if (!res.ok || !data.ok || !data.result) {
        setScanError(data.error ?? 'Scan failed. Enter the card details manually below.');
        return;
      }

      const r = data.result;
      setScanMeta({ confidence: r.confidence, method: r.method, parallelCandidates: r.parallelCandidates });
      setRawCopyrightYear(r.rawCopyrightYear);

      const isUnresolved = r.confidence === 'unresolved';
      setForm((prev) => ({
        ...prev,
        year: r.year != null ? String(r.year) : isUnresolved && r.rawCopyrightYear != null ? String(r.rawCopyrightYear) : '',
        brand: r.brand ?? (isUnresolved ? r.rawBrandLine ?? '' : ''),
        set: r.set ?? (isUnresolved ? r.rawSetName ?? '' : ''),
        subset: r.subset ?? '',
        player: r.player ?? '',
        cardNumber: r.cardNumber ?? '',
        parallel: r.parallel ?? '',
        serialNumbering: r.serialNumbering ?? '',
        isAuto: r.isAuto ?? false,
        isRelic: r.isRelic ?? false,
        sport: r.sport ?? '',
        grade: r.grade ?? prev.grade,
        certNumber: r.certNumber ?? '',
      }));
    } catch (err: unknown) {
      console.error('Scan request failed:', err);
      setScanError('Scan request failed. Enter the card details manually below.');
    } finally {
      setScanning(false);
    }
  }

  const parallelConfirmRequired = hasScanned && !scanError;

  async function handleSave() {
    if (!form.player.trim() || !form.year.trim() || !form.grade.trim()) {
      setSaveError('Player, year, and grade are required.');
      return;
    }
    if (parallelConfirmRequired && !parallelConfirmed) {
      setSaveError('Check the parallel against the photo and confirm it below before saving.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year: Number(form.year),
          brand: form.brand,
          set: form.set,
          subset: form.subset,
          player: form.player,
          cardNumber: form.cardNumber,
          parallel: form.parallel,
          serialNumbering: form.serialNumbering,
          isAuto: form.isAuto,
          isRelic: form.isRelic,
          sport: form.sport || 'Unknown',
          grade: form.grade,
          certNumber: form.certNumber || null,
          purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
          purchaseDate: form.purchaseDate || null,
          notes: form.notes || null,
          frontImagePath: imagePaths.front,
          backImagePath: imagePaths.back,
          identificationConfidence: scanMeta?.confidence ?? null,
          identificationMethod: scanMeta?.method ?? null,
          copyrightYear: rawCopyrightYear,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        setSaveError(data.error ?? 'Failed to save.');
        return;
      }

      router.push('/collection');
      router.refresh();
    } catch (err: unknown) {
      console.error('Save request failed:', err);
      setSaveError('Save request failed.');
    } finally {
      setSaving(false);
    }
  }

  const thumbnails = useMemo(
    () => [frontPreview, backPreview].filter((u): u is string => Boolean(u)),
    [frontPreview, backPreview],
  );

  return (
    <main className="container max-w-2xl py-8">
      <h1 className="mb-1 text-2xl font-semibold">Add a card</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Photograph the front and back — the scanner reads the identifiers off the back, resolves the card against
        your catalog, and reads the parallel off the front. You confirm or correct everything before it&rsquo;s
        saved.
      </p>

      <div className="mb-4 flex gap-4">
        <PhotoPicker
          label="Front (required)"
          checkGlare
          onProcessed={(file, url) => {
            setFrontFile(file);
            setFrontPreview(url);
          }}
        />
        <PhotoPicker
          label="Back (required)"
          checkGlare={false}
          onProcessed={(file, url) => {
            setBackFile(file);
            setBackPreview(url);
          }}
        />
      </div>

      <button
        type="button"
        onClick={handleScan}
        disabled={scanning || !frontFile || !backFile}
        className="mb-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : hasScanned ? 'Re-scan' : 'Scan card'}
      </button>

      {scanError && <p className="mb-4 text-sm text-destructive">{scanError}</p>}

      {scanMeta && (
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', CONFIDENCE_STYLE[scanMeta.confidence])}>
            {CONFIDENCE_LABEL[scanMeta.confidence]}
          </span>
          <span className="text-[11px] text-muted-foreground">via {scanMeta.method}</span>
        </div>
      )}

      {hasScanned && !scanError && (
        <p className="mb-4 text-sm font-medium text-foreground">
          Check this before saving. A wrong parallel pulls the wrong comps.
        </p>
      )}

      {thumbnails.length > 0 && (
        <div className="mb-4 flex gap-3">
          {thumbnails.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={url} src={url} alt="" className="h-20 w-auto rounded-md border border-border object-contain" />
          ))}
        </div>
      )}

      <form
        className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <Field label="Year" uncertain={uncertainFieldsUnresolved}>
          <input
            className={uncertainFieldsUnresolved ? uncertainInputClass : inputClass}
            type="number"
            value={form.year}
            onChange={(e) => setField('year', e.target.value)}
            required
          />
        </Field>
        <Field label="Sport" uncertain={uncertainFieldsUnresolved}>
          <input
            className={uncertainFieldsUnresolved ? uncertainInputClass : inputClass}
            value={form.sport}
            onChange={(e) => setField('sport', e.target.value)}
          />
        </Field>
        <Field label="Brand" uncertain={uncertainFieldsUnresolved}>
          <input
            className={uncertainFieldsUnresolved ? uncertainInputClass : inputClass}
            value={form.brand}
            onChange={(e) => setField('brand', e.target.value)}
          />
        </Field>
        <Field label="Set" uncertain={uncertainFieldsUnresolved}>
          <input
            className={uncertainFieldsUnresolved ? uncertainInputClass : inputClass}
            value={form.set}
            onChange={(e) => setField('set', e.target.value)}
          />
        </Field>
        <Field label="Subset">
          <input className={inputClass} value={form.subset} onChange={(e) => setField('subset', e.target.value)} />
        </Field>
        <Field label="Player" uncertain={uncertainFieldsUnresolved}>
          <input
            className={uncertainFieldsUnresolved ? uncertainInputClass : inputClass}
            value={form.player}
            onChange={(e) => setField('player', e.target.value)}
            required
          />
        </Field>
        <Field label="Card #" uncertain={uncertainFieldsUnresolved}>
          <input
            className={uncertainFieldsUnresolved ? uncertainInputClass : inputClass}
            value={form.cardNumber}
            onChange={(e) => setField('cardNumber', e.target.value)}
          />
        </Field>
        <Field label="Serial #">
          <input
            className={inputClass}
            placeholder="e.g. /99"
            value={form.serialNumbering}
            onChange={(e) => setField('serialNumbering', e.target.value)}
          />
        </Field>
        <Field label="Grade">
          <input
            className={inputClass}
            value={form.grade}
            onChange={(e) => setField('grade', e.target.value)}
            placeholder="RAW, PSA 10, ..."
            required
          />
        </Field>
        <Field label="Cert #">
          <input
            className={inputClass}
            value={form.certNumber}
            onChange={(e) => setField('certNumber', e.target.value)}
          />
        </Field>
        <Field label="Purchase price">
          <input
            className={inputClass}
            type="number"
            step="0.01"
            value={form.purchasePrice}
            onChange={(e) => setField('purchasePrice', e.target.value)}
          />
        </Field>
        <Field label="Purchase date">
          <input
            className={inputClass}
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setField('purchaseDate', e.target.value)}
          />
        </Field>
        <div className="col-span-2 flex items-center gap-6 py-1">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isAuto} onChange={(e) => setField('isAuto', e.target.checked)} />
            Autograph
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.isRelic} onChange={(e) => setField('isRelic', e.target.checked)} />
            Relic
          </label>
        </div>

        {/* Parallel is always its own block, separate from the grid above — it's the field that most changes value, so it always needs an explicit tap regardless of confidence. */}
        <div className="col-span-2 rounded-md border border-border bg-secondary/30 p-3">
          <Field label="Parallel" uncertain={parallelUncertain}>
            <input
              className={parallelUncertain ? uncertainInputClass : inputClass}
              value={form.parallel}
              onChange={(e) => setField('parallel', e.target.value)}
              placeholder="Base, Refractor, Gold /50, ..."
              list={scanMeta && scanMeta.parallelCandidates.length > 0 ? 'parallel-candidates' : undefined}
            />
            {scanMeta && scanMeta.parallelCandidates.length > 0 && (
              <datalist id="parallel-candidates">
                {scanMeta.parallelCandidates.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </Field>
          {scanMeta && scanMeta.parallelCandidates.length > 0 && (
            <p className="mt-1 text-xs text-blue-700">Couldn&rsquo;t narrow it down — candidates: {scanMeta.parallelCandidates.join(', ')}</p>
          )}
          {parallelConfirmRequired && (
            <label className="mt-2 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={parallelConfirmed}
                onChange={(e) => setParallelConfirmed(e.target.checked)}
              />
              I checked the parallel against the photo
            </label>
          )}
        </div>

        <div className="col-span-2 flex flex-col gap-1 text-sm">
          <span className="font-medium text-muted-foreground">Notes</span>
          <textarea
            className={inputClass}
            rows={2}
            value={form.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </div>

        {saveError && <p className="col-span-2 text-sm text-destructive">{saveError}</p>}

        <button
          type="submit"
          disabled={saving}
          className="col-span-2 mt-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save to collection'}
        </button>
      </form>
    </main>
  );
}
