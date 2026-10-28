'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { api, type Offer, type ResultItem } from '@/lib/api';
import { displayName, inr } from '@/lib/format';
import AlertForm from './AlertForm';
import { Freshness, SampleBadge } from './Badges';
import OfferCard from './OfferCard';
import PriceChart, { type Point } from './PriceChart';

interface Detail {
  offer: Offer;
  sameItem: ResultItem[];
  similar: ResultItem[];
  mrp: { claimedDiscountPct: number; inflated: boolean; explanation: string } | null;
}

export default function DetailView({ id }: { id: string }) {
  const t = useTranslations('detail');
  const locale = useLocale();
  const [d, setD] = useState<Detail | null | 'missing'>(null);
  const [days, setDays] = useState<30 | 90>(30);
  const [hist, setHist] = useState<{
    points: (Point & { isSample: boolean })[];
    minPaise: number | null;
    maxPaise: number | null;
  } | null>(null);

  useEffect(() => {
    api<Detail>(`/v1/offers/${encodeURIComponent(id)}`)
      .then(setD)
      .catch(() => setD('missing'));
  }, [id]);
  useEffect(() => {
    api<{ points: (Point & { isSample: boolean })[]; minPaise: number | null; maxPaise: number | null }>(
      `/v1/offers/${encodeURIComponent(id)}/history?days=${days}`,
    )
      .then(setHist)
      .catch(() => setHist(null));
  }, [id, days]);

  if (d === null)
    return (
      <p className="text-ink-2" aria-live="polite">
        …
      </p>
    );
  if (d === 'missing') return <p className="rounded-[24px] bg-coral-tint p-4">{t('notFound')}</p>;
  const o = d.offer;
  const mine = d.sameItem.find((r) => r.offer.id === o.id) ?? d.sameItem[0];
  const weights = { cost: 0.4, rating: 0.25, speed: 0.2, trust: 0.15 };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="t-heading [overflow-wrap:anywhere]">{displayName(o)}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] text-ink-2">
          {o.provenance.sourceName} {o.provenance.isSample && <SampleBadge />}{' '}
          <Freshness iso={o.provenance.observedAt} />
        </p>
      </header>

      {o.vertical === 'property' && (
        <section aria-labelledby="facts" className="card text-[15px]">
          <h2 id="facts" className="t-heading-sm mb-4">
            {t('property')}
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <dt className="text-ink-2">{t('area')}</dt>
            <dd>{o.areaSqft} sqft</dd>
            <dt className="text-ink-2">{t('floor')}</dt>
            <dd>
              {o.floor ?? '–'} / {o.totalFloors ?? '–'}
            </dd>
            <dt className="text-ink-2">{t('age')}</dt>
            <dd>{o.ageYears !== null && o.ageYears !== undefined ? t('years', { n: o.ageYears }) : '–'}</dd>
            <dt className="text-ink-2">{t('postedBy')}</dt>
            <dd>{o.postedBy === 'owner' ? t('owner') : t('broker')}</dd>
            <dt className="text-ink-2">{t('amenities')}</dt>
            <dd>{o.amenities?.join(', ') || '–'}</dd>
            <dt className="text-ink-2">{t('transit')}</dt>
            <dd>{o.nearTransit?.join(', ') || '–'}</dd>
          </dl>
          <p className="mt-3 text-[13px] text-ink-3">{t('description')}</p>
          <blockquote className="mt-1 border-l-2 border-line pl-3 text-[15px] text-ink-2 [overflow-wrap:anywhere]">
            {o.description}
          </blockquote>
          <p className="mt-3 text-[13px] text-ink-3">{t('noContact')}</p>
        </section>
      )}

      {o.vertical !== 'property' && (
        <section aria-labelledby="hist" className="card">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 id="hist" className="font-medium">
              {t('history')}
            </h2>
            <div role="group" aria-label={t('history')} className="flex gap-1 text-[15px]">
              {([30, 90] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={days === n}
                  onClick={() => setDays(n)}
                  className="chip"
                >
                  {n === 30 ? t('days30') : t('days90')}
                </button>
              ))}
            </div>
          </div>
          {hist && hist.points.length > 0 ? (
            <>
              <PriceChart
                points={hist.points}
                title={`${t('history')}: ${displayName(o)} (${o.provenance.sourceName})`}
              />
              <p className="mt-1 text-[15px] text-ink-2">
                {t('lowHigh', { low: inr(hist.minPaise!, locale), high: inr(hist.maxPaise!, locale) })}
                {hist.points.some((p) => p.isSample) && ` · ${t('historySample')}`}
              </p>
            </>
          ) : (
            <p className="text-[15px] text-ink-2">{t('noHistory')}</p>
          )}
          {d.mrp && (
            <p
              className={`mt-2 rounded p-2 text-[15px] ${d.mrp.inflated ? 'bg-warn-bg text-warn-fg' : 'text-ink-2'}`}
            >
              <strong>{t('mrp')}:</strong> {d.mrp.explanation}
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="same">
        <h2 id="same" className="t-heading-sm mb-4">
          {t('sameItem')}
        </h2>
        <ol className="space-y-3">
          {d.sameItem.map((r) => (
            <li key={r.offer.id}>
              <OfferCard item={r} weights={weights} />
            </li>
          ))}
        </ol>
      </section>

      {mine && <AlertForm offerId={o.id} suggestedRs={(mine.landed.totalPaise / 100) * 0.95} />}

      {d.similar.length > 0 && (
        <section aria-labelledby="sim">
          <h2 id="sim" className="t-heading-sm mb-4">
            {t('similar')}
          </h2>
          <ol className="space-y-3">
            {d.similar.map((r) => (
              <li key={r.offer.id}>
                <OfferCard item={r} weights={weights} />
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
