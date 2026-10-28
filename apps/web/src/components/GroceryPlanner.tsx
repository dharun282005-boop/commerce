'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type SourceStatus } from '@/lib/api';
import { inr } from '@/lib/format';
import LocalityInput from './LocalityInput';
import SourceStrip from './SourceStrip';

interface Plan {
  area: { label: string };
  sampleData: boolean;
  needs: { id: string; text: string }[];
  sources: SourceStatus[];
  plan: {
    method: string;
    feasible: boolean;
    totalPaise: number;
    unavailable: string[];
    bestSinglePlatform: { sourceId: string; totalPaise: number } | null;
    orders: {
      sourceId: string;
      sourceName: string;
      subtotalPaise: number;
      feesPaise: number;
      totalPaise: number;
      lines: { offerId: string; title: string; packs: number; costPaise: number }[];
    }[];
  };
}

export default function GroceryPlanner() {
  const t = useTranslations('grocery');
  const tr = useTranslations('results');
  const locale = useLocale();
  const params = useSearchParams();
  const [list, setList] = useState(params.get('list') ?? '2 kg rice, 1 L milk, 12 eggs');
  const [locality, setLocality] = useState(params.get('locality') ?? '');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(
    async (l: string, loc: string) => {
      setBusy(true);
      setError(null);
      try {
        setPlan(await api<Plan>('/v1/cart/plan', { method: 'POST', json: { list: l, locality: loc } }));
      } catch (e) {
        setError(e instanceof ApiError && e.code === 'unknown_locality' ? tr('notChennai') : tr('error'));
      } finally {
        setBusy(false);
      }
    },
    [tr],
  );

  useEffect(() => {
    if (params.get('list') && params.get('locality')) void run(params.get('list')!, params.get('locality')!);
  }, [params, run]);

  const p = plan?.plan;
  return (
    <div className="space-y-4">
      <form
        className="space-y-3 rounded-lg border border-line bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault();
          void run(list, locality);
        }}
      >
        <label className="block">
          <span className="mb-1 block text-sm font-medium">{t('list')}</span>
          <textarea
            value={list}
            onChange={(e) => setList(e.target.value)}
            rows={3}
            required
            maxLength={1000}
            placeholder={t('listPlaceholder')}
            className="w-full rounded border border-line bg-surface px-3 py-2"
          />
        </label>
        <LocalityInput value={locality} onChange={setLocality} id="g-locality" />
        <button type="submit" className="rounded bg-accent px-4 py-2 font-medium text-accent-fg">
          {t('plan')}
        </button>
      </form>
      <div aria-live="polite" aria-busy={busy}>
        {busy && <p className="text-ink-2">{tr('loading')}</p>}
        {error && <p className="rounded bg-bad-bg p-3 text-bad-fg">{error}</p>}
        {plan && p && !busy && (
          <div className="space-y-3">
            {!p.feasible ? (
              <p className="rounded bg-warn-bg p-3 text-warn-fg">{t('infeasible')}</p>
            ) : (
              <div className="rounded-lg border border-line bg-surface p-4">
                <p className="tabular text-2xl font-semibold">
                  {t('total', { amount: inr(p.totalPaise, locale) })}
                </p>
                {p.bestSinglePlatform && (
                  <p className="text-sm text-ink-2">
                    {t('single', { amount: inr(p.bestSinglePlatform.totalPaise, locale) })}
                    {p.bestSinglePlatform.totalPaise > p.totalPaise &&
                      ` · ${t('save', { amount: inr(p.bestSinglePlatform.totalPaise - p.totalPaise, locale) })}`}
                  </p>
                )}
                {plan.sampleData && <p className="mt-1 text-xs text-sample-fg">{tr('sample')}</p>}
                <p className="mt-1 text-xs text-ink-3">{t('method', { method: p.method })}</p>
              </div>
            )}
            <ul className="space-y-3">
              {p.orders.map((o) => (
                <li key={o.sourceId} className="rounded-lg border border-line bg-surface p-4">
                  <h3 className="font-medium">{o.sourceName}</h3>
                  <ul className="mt-1 text-sm">
                    {o.lines.map((l) => (
                      <li key={l.offerId} className="flex justify-between gap-2">
                        <span className="[overflow-wrap:anywhere]">
                          {t('packs', { packs: l.packs })} {l.title}
                        </span>
                        <span className="tabular">{inr(l.costPaise, locale)}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-xs text-ink-2">
                    {t('subtotal', { amount: inr(o.subtotalPaise, locale) })} ·{' '}
                    {t('orderFees', { amount: inr(o.feesPaise, locale) })} ·{' '}
                    <strong className="text-ink">{inr(o.totalPaise, locale)}</strong>
                  </p>
                </li>
              ))}
            </ul>
            {p.unavailable.length > 0 && (
              <p className="text-sm text-warn-fg">
                {t('notFound', {
                  items: plan.needs
                    .filter((n) => p.unavailable.includes(n.id))
                    .map((n) => n.text)
                    .join(', '),
                })}
              </p>
            )}
            <SourceStrip sources={plan.sources} />
          </div>
        )}
      </div>
    </div>
  );
}
