'use client';

import { useRef } from 'react';
import { PIPELINE_STATUSES, type ProspectStatus } from '@/lib/status';

export function StatusSelect({
  action,
  current,
}: {
  action: (formData: FormData) => void;
  current: ProspectStatus;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <select
        name="status"
        defaultValue={current}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
      >
        {PIPELINE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    </form>
  );
}
