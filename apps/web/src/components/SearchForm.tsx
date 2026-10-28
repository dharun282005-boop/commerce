'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { Vertical } from '@/lib/api';
import { VerticalIcon } from './Art';
import LocalityInput from './LocalityInput';

export default function SearchForm({
  initial,
}: {
  initial?: { vertical?: Vertical; q?: string; locality?: string };
}) {
  const t = useTranslations();
  const router = useRouter();
  const [vertical, setVertical] = useState<Vertical>(initial?.vertical ?? 'shopping');
  const [q, setQ] = useState(initial?.q ?? '');
  const [locality, setLocality] = useState(initial?.locality ?? '');
  const tabs: Vertical[] = ['shopping', 'food', 'grocery', 'property'];

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        if (vertical === 'grocery' && /,/.test(q)) {
          router.push(`/grocery?${new URLSearchParams({ list: q, locality })}`);
          return;
        }
        const extra: Record<string, string> = vertical === 'property' ? { listingType: 'rent' } : {};
        router.push(
          `/results?${new URLSearchParams({ vertical, q: q || (vertical === 'property' ? 'bhk' : q), locality, ...extra })}`,
        );
      }}
      className="space-y-5"
    >
      <div role="tablist" aria-label={t('search.categories')} className="flex flex-wrap gap-2">
        {tabs.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vertical === v}
            onClick={() => setVertical(v)}
            className="chip inline-flex items-center gap-2 !py-1.5 !pl-1.5"
          >
            <VerticalIcon vertical={v} className="h-8 w-8" />
            {t(`verticals.${v}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="label">
            {t('search.label')}
          </label>
          <input
            id="q"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            required={vertical !== 'property'}
            placeholder={t(`search.placeholder.${vertical}`)}
            className="field"
          />
        </div>
        <LocalityInput value={locality} onChange={setLocality} />
        <button type="submit" className="btn btn-primary justify-center !py-3.5 text-[17px]">
          {t('search.submit')}
          <span className="dot dot-white" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}
