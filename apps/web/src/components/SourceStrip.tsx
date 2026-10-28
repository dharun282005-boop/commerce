'use client';
import { useTranslations } from 'next-intl';
import type { SourceStatus } from '@/lib/api';

export default function SourceStrip({ sources }: { sources: SourceStatus[] }) {
  const t = useTranslations('results');
  const visible = sources.filter((s) => s.status !== 'disabled');
  const off = sources.filter((s) => s.status === 'disabled');
  return (
    <details className="rounded border border-line bg-surface p-3 text-sm">
      <summary className="cursor-pointer text-ink-2">
        {t('sources')}: {visible.filter((s) => s.status === 'ok').length}/{visible.length}
        {visible.some((s) => s.status === 'unavailable') && (
          <span className="ml-2 text-bad-fg">
            ·{' '}
            {visible
              .filter((s) => s.status === 'unavailable')
              .map((s) => `${s.sourceName} ${t('status.unavailable')}`)
              .join(', ')}
          </span>
        )}
      </summary>
      <ul className="mt-2 grid gap-1 sm:grid-cols-2">
        {[...visible, ...off].map((s) => (
          <li key={s.sourceId} className="flex justify-between gap-2 text-xs">
            <span className="text-ink">{s.sourceName}</span>
            <span
              className={
                s.status === 'ok' ? 'text-ok' : s.status === 'unavailable' ? 'text-bad-fg' : 'text-ink-3'
              }
            >
              {t(`status.${s.status}`)}
              {s.status === 'ok' && ` · ${s.offerCount}${s.fromCache ? ` · ${t('fromCache')}` : ''}`}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
