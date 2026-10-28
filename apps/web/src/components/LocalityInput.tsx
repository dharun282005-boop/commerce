'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, type Locality } from '@/lib/api';

/** Free-text locality with suggestions (name, Tamil name, pincode). Pincode is enough; no GPS. */
export default function LocalityInput({
  value,
  onChange,
  id = 'locality',
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  const t = useTranslations('search');
  const locale = useLocale();
  const [list, setList] = useState<Locality[]>([]);
  useEffect(() => {
    api<{ localities: Locality[] }>('/v1/localities')
      .then((r) => setList(r.localities))
      .catch(() => setList([]));
  }, []);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink">
        {t('locality')}
      </label>
      <input
        id={id}
        list={`${id}-list`}
        required
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('localityPlaceholder')}
        className="w-full rounded border border-line bg-surface px-3 py-2 text-ink"
      />
      <datalist id={`${id}-list`}>
        <option value="OMR" />
        {list.map((l) => (
          <option key={l.id} value={l.name}>
            {`${locale === 'ta' ? l.nameTa : l.name} · ${l.pincode}`}
          </option>
        ))}
      </datalist>
    </div>
  );
}
