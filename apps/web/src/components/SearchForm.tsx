'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import type { Vertical } from '@/lib/api';
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
      className="space-y-4 rounded-lg border border-line bg-surface p-4"
    >
      <div role="tablist" aria-label={t('search.categories')} className="flex flex-wrap gap-2">
        {tabs.map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vertical === v}
            onClick={() => setVertical(v)}
            className={`rounded-full px-3 py-1.5 text-sm ${vertical === v ? 'bg-accent text-accent-fg' : 'border border-line text-ink-2'}`}
          >
            {t(`verticals.${v}`)}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="mb-1 block text-sm font-medium text-ink">
            {t('search.label')}
          </label>
          <input
            id="q"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            required={vertical !== 'property'}
            placeholder={t(`search.placeholder.${vertical}`)}
            className="w-full rounded border border-line bg-surface px-3 py-2 text-ink"
          />
        </div>
        <LocalityInput value={locality} onChange={setLocality} />
        <button type="submit" className="rounded bg-accent px-5 py-2 font-medium text-accent-fg">
          {t('search.submit')}
        </button>
      </div>
    </form>
  );
}
