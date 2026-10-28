'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { inr } from '@/lib/format';
import { getLocal, loadSaved, removeSaved, setLocal, type SavedItem } from '@/lib/saved';
import { Freshness, SampleBadge } from './Badges';

export const ACCESS_KEY = 'cuc.access.v1';

export default function SavedView() {
  const t = useTranslations('saved');
  const locale = useLocale();
  const [items, setItems] = useState<SavedItem[]>([]);
  const [access, setAccess] = useState<string | null>(null);
  const [mine, setMine] = useState<{
    alerts: { id: string; offerTitle: string; thresholdPaise: number; verified: boolean }[];
  } | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    const refresh = () => setItems(loadSaved());
    refresh();
    window.addEventListener('cuc-saved', refresh);
    const tok = getLocal(ACCESS_KEY);
    setAccess(tok);
    if (tok)
      api<typeof mine>('/v1/me', { headers: { authorization: `Bearer ${tok}` } })
        .then(setMine)
        .catch(() => setMine(null));
    return () => window.removeEventListener('cuc-saved', refresh);
  }, []);

  return (
    <div className="space-y-6">
      <section>
        {items.length === 0 ? (
          <p className="text-ink-2">{t('empty')}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 card !p-5">
                <div className="min-w-0">
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="font-medium text-ink underline [overflow-wrap:anywhere]"
                  >
                    {s.title}
                  </a>
                  <p className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
                    <strong className="tabular text-[15px] text-ink">{inr(s.totalPaise, locale)}</strong>{' '}
                    {s.sourceName} {s.isSample && <SampleBadge />} <Freshness iso={s.observedAt} />
                  </p>
                </div>
                <button type="button" onClick={() => removeSaved(s.id)} className="btn btn-ghost !py-2">
                  {t('remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="mydata" className="card text-[15px]">
        <h2 id="mydata" className="t-heading-sm mb-4">
          {t('alerts')}
        </h2>
        {!access ? (
          <p className="text-ink-2">{t('noAccess')}</p>
        ) : (
          <div className="space-y-2">
            <ul className="list-disc pl-5">
              {mine?.alerts.map((a) => (
                <li key={a.id}>
                  {a.offerTitle} ≤ {inr(a.thresholdPaise, locale)} {a.verified ? '✓' : ''}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-ghost !py-2"
                onClick={async () => {
                  const data = await api('/v1/me', { headers: { authorization: `Bearer ${access}` } });
                  const url = URL.createObjectURL(
                    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
                  );
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'my-chennai-commerce-data.json';
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {t('export')}
              </button>
              <button
                type="button"
                className="btn bg-coral-tint !py-2"
                onClick={async () => {
                  await api('/v1/me', { method: 'DELETE', headers: { authorization: `Bearer ${access}` } });
                  setLocal(ACCESS_KEY, null);
                  setAccess(null);
                  setMine(null);
                  setMsg(t('deleted'));
                }}
              >
                {t('deleteAll')}
              </button>
            </div>
          </div>
        )}
        <p aria-live="polite">{msg}</p>
      </section>
    </div>
  );
}
