'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ScanAttributes {
  year: number | null;
  brand: string | null;
  set: string | null;
  subset: string | null;
  player: string | null;
  cardNumber: string | null;
  parallel: string | null;
  serialNumbering: string | null;
  isAuto: boolean | null;
  isRelic: boolean | null;
  sport: string | null;
  grade: string | null;
  certNumber: string | null;
  confidence: 'high' | 'medium' | 'low';
}

interface ScanResponse {
  ok: boolean;
  error?: string;
  attributes?: ScanAttributes;
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

const CONFIDENCE_STYLES: Record<ScanAttributes['confidence'], string> = {
  high: 'bg-green-100 text-green-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-red-100 text-red-800',
};

function PhotoPicker({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const previewUrl = file ? URL.createObjectURL(file) : null;

  return (
    <label className="flex flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/40 p-4 text-center hover:bg-secondary">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt={`${label} preview`} className="h-32 w-auto rounded-md object-contain" />
      ) : (
        <span className="text-3xl">📷</span>
      )}
      <span className="text-sm font-medium">{label}</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  'rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring';

export default function AddCardPage() {
  const router = useRouter();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<ScanAttributes['confidence'] | null>(null);
  const [hasScanned, setHasScanned] = useState(false);

  const [imagePaths, setImagePaths] = useState<{ front: string | null; back: string | null }>({
    front: null,
    back: null,
  });
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleScan() {
    if (!frontFile) {
      setScanError('Add a front photo first.');
      return;
    }
    setScanning(true);
    setScanError(null);
    try {
      const body = new FormData();
      body.append('front', frontFile);
      if (backFile) body.append('back', backFile);

      const res = await fetch('/api/scan', { method: 'POST', body });
      const data = (await res.json()) as ScanResponse;

      setImagePaths({ front: data.frontImagePath ?? null, back: data.backImagePath ?? null });
      setHasScanned(true);

      if (!res.ok || !data.ok || !data.attributes) {
        setScanError(data.error ?? 'Scan failed. Enter the card details manually below.');
        return;
      }

      const attrs = data.attributes;
      setConfidence(attrs.confidence);
      setForm((prev) => ({
        ...prev,
        year: attrs.year != null ? String(attrs.year) : '',
        brand: attrs.brand ?? '',
        set: attrs.set ?? '',
        subset: attrs.subset ?? '',
        player: attrs.player ?? '',
        cardNumber: attrs.cardNumber ?? '',
        parallel: attrs.parallel ?? '',
        serialNumbering: attrs.serialNumbering ?? '',
        isAuto: attrs.isAuto ?? false,
        isRelic: attrs.isRelic ?? false,
        sport: attrs.sport ?? '',
        grade: attrs.grade ?? prev.grade,
        certNumber: attrs.certNumber ?? '',
      }));
    } catch (err: unknown) {
      console.error('Scan request failed:', err);
      setScanError('Scan request failed. Enter the card details manually below.');
    } finally {
      setScanning(false);
    }
  }

  async function handleSave() {
    if (!form.player.trim() || !form.year.trim() || !form.grade.trim()) {
      setSaveError('Player, year, and grade are required.');
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
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}) as { error?: string });
        setSaveError(data.error ?? 'Failed to save.');
        return;
      }

      router.push('/');
      router.refresh();
    } catch (err: unknown) {
      console.error('Save request failed:', err);
      setSaveError('Save request failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="container max-w-2xl py-8">
      <h1 className="mb-1 text-2xl font-semibold">Add a card</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Take a photo of the front (and back, if you have it) and Claude will fill in the details below. You
        confirm or correct everything before it&rsquo;s saved — nothing is added to your collection automatically.
      </p>

      <div className="mb-4 flex gap-4">
        <PhotoPicker label="Front (required)" file={frontFile} onChange={setFrontFile} />
        <PhotoPicker label="Back (optional)" file={backFile} onChange={setBackFile} />
      </div>

      <button
        type="button"
        onClick={handleScan}
        disabled={scanning || !frontFile}
        className="mb-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : hasScanned ? 'Re-scan' : 'Scan card'}
      </button>

      {scanError && <p className="mb-4 text-sm text-destructive">{scanError}</p>}

      {confidence && (
        <div className="mb-4 flex items-center gap-2">
          <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', CONFIDENCE_STYLES[confidence])}>
            {confidence} confidence
          </span>
          {confidence === 'low' && (
            <span className="text-xs text-muted-foreground">Double-check every field below before saving.</span>
          )}
        </div>
      )}

      <form
        className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <Field label="Year">
          <input
            className={inputClass}
            type="number"
            value={form.year}
            onChange={(e) => setField('year', e.target.value)}
            required
          />
        </Field>
        <Field label="Sport">
          <input className={inputClass} value={form.sport} onChange={(e) => setField('sport', e.target.value)} />
        </Field>
        <Field label="Brand">
          <input className={inputClass} value={form.brand} onChange={(e) => setField('brand', e.target.value)} />
        </Field>
        <Field label="Set">
          <input className={inputClass} value={form.set} onChange={(e) => setField('set', e.target.value)} />
        </Field>
        <Field label="Subset">
          <input className={inputClass} value={form.subset} onChange={(e) => setField('subset', e.target.value)} />
        </Field>
        <Field label="Player">
          <input
            className={inputClass}
            value={form.player}
            onChange={(e) => setField('player', e.target.value)}
            required
          />
        </Field>
        <Field label="Card #">
          <input
            className={inputClass}
            value={form.cardNumber}
            onChange={(e) => setField('cardNumber', e.target.value)}
          />
        </Field>
        <Field label="Parallel">
          <input
            className={inputClass}
            value={form.parallel}
            onChange={(e) => setField('parallel', e.target.value)}
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
