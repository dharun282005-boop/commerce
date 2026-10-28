'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Src {
  id: string;
  name: string;
  verticals: string[];
  compliance: {
    tier: number | string;
    enabledByDefault: boolean;
    notes: string;
    termsUrl: string | null;
    lastReviewed: string | null;
  };
  allowed: { allowed: boolean; reason: string };
  health: {
    breaker: string;
    lastSuccessAt: string | null;
    lastError: string | null;
    adapter: { ok: boolean; detail?: string };
  };
}

export default function SourcesView() {
  const t = useTranslations('sources');
  const [rows, setRows] = useState<Src[] | null>(null);
  useEffect(() => {
    const load = () =>
      api<{ sources: Src[] }>('/v1/sources')
        .then((r) => setRows(r.sources))
        .catch(() => setRows([]));
    load();
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, []);
  if (!rows) return <p className="text-ink-2">…</p>;
  return (
    <div className="overflow-x-auto rounded border border-line bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('title')}</caption>
        <thead className="bg-surface-2 text-left text-ink-2">
          <tr>
            <th scope="col" className="p-2">
              {t('id')}
            </th>
            <th scope="col" className="p-2">
              {t('tier')}
            </th>
            <th scope="col" className="p-2">
              {t('enabled')}
            </th>
            <th scope="col" className="p-2">
              {t('health')}
            </th>
            <th scope="col" className="p-2">
              {t('breaker')}
            </th>
            <th scope="col" className="p-2">
              {t('lastSuccess')}
            </th>
            <th scope="col" className="p-2">
              {t('notes')}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-t border-line align-top">
              <th scope="row" className="p-2 text-left font-medium">
                {s.name}
                <span className="block text-xs font-normal text-ink-3">
                  {s.id} · {s.verticals.join(', ')}
                </span>
              </th>
              <td className="p-2">{String(s.compliance.tier)}</td>
              <td className="p-2" title={s.allowed.reason}>
                {s.allowed.allowed ? t('yes') : `${t('no')} (${s.allowed.reason})`}
              </td>
              <td className={`p-2 ${s.health.adapter.ok ? 'text-ok' : 'text-bad-fg'}`}>
                {s.health.adapter.ok ? '✓' : '✗'} {s.health.adapter.detail}
              </td>
              <td className="p-2">{s.health.breaker}</td>
              <td className="p-2 text-xs">
                {s.health.lastSuccessAt ? new Date(s.health.lastSuccessAt).toLocaleTimeString() : '–'}
                {s.health.lastError && <span className="block text-bad-fg">{s.health.lastError}</span>}
              </td>
              <td className="p-2 text-xs text-ink-2">{s.compliance.notes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
