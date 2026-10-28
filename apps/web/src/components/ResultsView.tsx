'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { api, ApiError, type Preset, type SearchResponse, type Vertical, type Weights } from '@/lib/api';
import { displayName, inr } from '@/lib/format';
import OfferCard from './OfferCard';
import SourceStrip from './SourceStrip';

const PRESETS: Preset[] = ['cheapest', 'best_rated', 'fastest', 'balanced'];

export default function ResultsView() {
  const t = useTranslations('results');
  const locale = useLocale();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const vertical = (params.get('vertical') ?? 'shopping') as Vertical;
  const q = params.get('q') ?? '';
  const locality = params.get('locality') ?? '';
  const preset = (params.get('preset') ?? 'balanced') as Preset;
  const num = (k: string) => (params.get(k) ? Number(params.get(k)) : undefined);
  const filters = useMemo(
    () => ({
      maxPricePaise: num('maxRs') ? Math.round(num('maxRs')! * 100) : undefined,
      vegOnly: params.get('veg') === '1' || undefined,
      minServings: num('serves'),
      maxEtaMinutes: num('eta'),
      bhk: num('bhk'),
      listingType: (params.get('listingType') as 'rent' | 'buy' | null) ?? undefined,
      furnishing:
        (params.get('furnishing') as 'unfurnished' | 'semi-furnished' | 'furnished' | null) ?? undefined,
    }),
    [params.toString()],
  );
  const [custom, setCustom] = useState<Weights | null>(null);
  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [table, setTable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api<SearchResponse>('/v1/search', {
      method: 'POST',
      json: {
        vertical,
        q: q || 'bhk',
        locality,
        filters: Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined)),
        ...(custom ? { weights: custom } : { preset }),
      },
    })
      .then((r) => !cancelled && setData(r))
      .catch(
        (e) =>
          !cancelled &&
          setError(e instanceof ApiError && e.code === 'unknown_locality' ? t('notChennai') : t('error')),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vertical, q, locality, preset, filters, custom, t]);

  const setParam = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    router.replace(`${pathname}?${next.toString()}`);
  };

  const weights = data?.weights ?? { cost: 0.4, rating: 0.25, speed: 0.2, trust: 0.15 };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('rankBy')}>
        <span className="text-[15px] text-ink-2">{t('rankBy')}:</span>
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={!custom && preset === p}
            onClick={() => {
              setCustom(null);
              setParam({ preset: p });
            }}
            className="chip"
          >
            {t(`presets.${p}`)}
          </button>
        ))}
      </div>

      <details className="card !p-5 text-[15px]">
        <summary className="cursor-pointer text-ink-2">{t('customWeights')}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['cost', 'rating', 'speed', 'trust'] as const).map((k) => (
            <label key={k} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2">
              <span className="text-ink-2">{t(`components.${k}`)}</span>
              <input
                type="range"
                min={0}
                max={100}
                step={5}
                value={Math.round((custom ?? weights)[k] * 100)}
                onChange={(e) => setCustom({ ...(custom ?? weights), [k]: Number(e.target.value) / 100 })}
              />
              <span className="tabular text-right text-ink">{Math.round((custom ?? weights)[k] * 100)}</span>
            </label>
          ))}
        </div>
      </details>

      <Filters vertical={vertical} params={params} onApply={setParam} />

      <div aria-live="polite" aria-busy={loading}>
        {loading && <p className="text-ink-2">{t('loading')}</p>}
        {error && <p className="rounded-[24px] bg-coral-tint p-4">{error}</p>}
        {data && !loading && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="t-heading-sm">
                {t('title', { count: data.results.length, area: data.area.label })}
              </h2>
              {data.results.length > 1 && (
                <button
                  type="button"
                  aria-pressed={table}
                  onClick={() => setTable(!table)}
                  className="btn btn-ghost !py-2"
                >
                  {t('compareTable')}
                </button>
              )}
            </div>
            <SourceStrip sources={data.sources} />
            {data.results.length === 0 && <p className="text-ink-2">{t('empty')}</p>}
            {table && (
              <div className="overflow-x-auto rounded-[32px] bg-surface p-3">
                <table className="w-full text-[15px]">
                  <caption className="sr-only">{t('compareTable')}</caption>
                  <thead className="text-left text-ink-2">
                    <tr>
                      <th scope="col" className="p-2">
                        {t('rank')}
                      </th>
                      <th scope="col" className="p-2">
                        {t('item')}
                      </th>
                      <th scope="col" className="p-2">
                        {t('source')}
                      </th>
                      <th scope="col" className="p-2 text-right">
                        {t('total')}
                      </th>
                      <th scope="col" className="p-2 text-right">
                        {t('components.rating')}
                      </th>
                      <th scope="col" className="p-2 text-right">
                        ETA
                      </th>
                      <th scope="col" className="p-2 text-right">
                        {t('score')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.results.map((r) => (
                      <tr key={r.offer.id} className="border-t border-line">
                        <td className="p-2">
                          {r.rank}
                          {r.flags.some((f) => f !== 'fees_unknown') ? ' ⚠' : ''}
                        </td>
                        <td className="p-2 [overflow-wrap:anywhere]">
                          {r.flags.includes('suspicious_text') ? '…' : displayName(r.offer)}
                        </td>
                        <td className="p-2">{r.offer.provenance.sourceName}</td>
                        <td className="tabular p-2 text-right">{inr(r.landed.totalPaise, locale)}</td>
                        <td className="tabular p-2 text-right">{r.adjustedRating?.toFixed(2) ?? '–'}</td>
                        <td className="tabular p-2 text-right">{r.offer.etaMinutes ?? '–'}</td>
                        <td className="tabular p-2 text-right">{r.score.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <ol className="space-y-3">
              {data.results.map((r) => (
                <li key={r.offer.id}>
                  <OfferCard item={r} weights={data.weights} />
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

function Filters({
  vertical,
  params,
  onApply,
}: {
  vertical: Vertical;
  params: URLSearchParams;
  onApply: (u: Record<string, string | null>) => void;
}) {
  const t = useTranslations('results');
  const [f, setF] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      ['maxRs', 'veg', 'serves', 'eta', 'bhk', 'listingType', 'furnishing'].map((k) => [
        k,
        params.get(k) ?? '',
      ]),
    ),
  );
  const field = 'field !rounded-[14px] !py-2';
  return (
    <details className="card !p-5 text-[15px]" open={vertical !== 'shopping'}>
      <summary className="cursor-pointer text-ink-2">{t('filters')}</summary>
      <form
        className="mt-3 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onApply(f);
        }}
      >
        <label className="flex flex-col gap-1">
          <span className="text-ink-2">{t('maxPrice')}</span>
          <input
            inputMode="numeric"
            pattern="[0-9]*"
            className={`${field} w-28`}
            value={f.maxRs}
            onChange={(e) => setF({ ...f, maxRs: e.target.value })}
          />
        </label>
        {vertical === 'food' && (
          <>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={f.veg === '1'}
                onChange={(e) => setF({ ...f, veg: e.target.checked ? '1' : '' })}
              />
              <span>{t('vegOnly')}</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-2">{t('minServings')}</span>
              <input
                inputMode="numeric"
                className={`${field} w-20`}
                value={f.serves}
                onChange={(e) => setF({ ...f, serves: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-2">{t('maxEta')}</span>
              <input
                inputMode="numeric"
                className={`${field} w-20`}
                value={f.eta}
                onChange={(e) => setF({ ...f, eta: e.target.value })}
              />
            </label>
          </>
        )}
        {vertical === 'property' && (
          <>
            <label className="flex flex-col gap-1">
              <span className="text-ink-2">{t('bhk')}</span>
              <select className={field} value={f.bhk} onChange={(e) => setF({ ...f, bhk: e.target.value })}>
                <option value="">{t('any')}</option>
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-2">{t('listingType')}</span>
              <select
                className={field}
                value={f.listingType}
                onChange={(e) => setF({ ...f, listingType: e.target.value })}
              >
                <option value="rent">{t('rent')}</option>
                <option value="buy">{t('buy')}</option>
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-ink-2">{t('furnishing')}</span>
              <select
                className={field}
                value={f.furnishing}
                onChange={(e) => setF({ ...f, furnishing: e.target.value })}
              >
                <option value="">{t('any')}</option>
                {['unfurnished', 'semi-furnished', 'furnished'].map((x) => (
                  <option key={x} value={x}>
                    {t(`furn.${x}`)}
                  </option>
                ))}
              </select>
            </label>
          </>
        )}
        <button type="submit" className="btn btn-primary">
          {t('apply')}
        </button>
      </form>
    </details>
  );
}
