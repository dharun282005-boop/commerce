'use client';
import { useTranslations } from 'next-intl';
import { minutesAgo } from '@/lib/format';

export function SampleBadge() {
  const t = useTranslations('results');
  return (
    <span className="rounded bg-sample-bg px-1.5 py-0.5 text-xs font-medium text-sample-fg">
      {t('sample')}
    </span>
  );
}

export function Freshness({ iso }: { iso: string }) {
  const t = useTranslations('results');
  const m = minutesAgo(iso);
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()} className="text-xs text-ink-3">
      {m < 120 ? t('checked', { minutes: m }) : t('checkedHours', { hours: Math.round(m / 60) })}
    </time>
  );
}

export function Flags({ flags }: { flags: string[] }) {
  const t = useTranslations('results');
  const shown = flags.filter((f) => f !== 'fees_unknown');
  if (!shown.length) return null;
  const severe = (f: string) =>
    ['price_anomaly', 'suspicious_text', 'below_market', 'asks_for_payment_or_id'].includes(f);
  return (
    <ul className="mt-2 space-y-1" aria-label={t('warnings')}>
      {shown.map((f) => (
        <li
          key={f}
          className={`flex items-start gap-1.5 rounded px-2 py-1 text-xs ${severe(f) ? 'bg-bad-bg text-bad-fg' : 'bg-warn-bg text-warn-fg'}`}
        >
          <span aria-hidden="true">⚠</span>
          <span>
            <span className="sr-only">{t('warnings')}: </span>
            {t.has(`flags.${f}`) ? t(`flags.${f}`) : f}
          </span>
        </li>
      ))}
    </ul>
  );
}
