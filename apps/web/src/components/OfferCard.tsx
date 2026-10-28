'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { ResultItem, Weights } from '@/lib/api';
import { displayName, inr } from '@/lib/format';
import { loadSaved, removeSaved, saveItem } from '@/lib/saved';
import { Flags, Freshness, SampleBadge } from './Badges';

export function WhyPanel({ item, weights }: { item: ResultItem; weights: Weights }) {
  const t = useTranslations('results');
  const sum = weights.cost + weights.rating + weights.speed + weights.trust;
  const keys = ['cost', 'rating', 'speed', 'trust'] as const;
  return (
    <details className="mt-2 text-[15px]">
      <summary className="cursor-pointer font-medium text-ink">{t('why', { rank: item.rank })}</summary>
      <div className="mt-2 space-y-1.5">
        <p className="text-ink-2">
          {t('score')}: <strong className="tabular text-ink">{item.score.toFixed(3)}</strong>
        </p>
        {keys.map((k) => (
          <div key={k} className="grid grid-cols-[7.5rem_1fr_3.5rem] items-center gap-2 text-[13px]">
            <span className="text-ink-2">{t(`components.${k}`)}</span>
            <span className="h-2 rounded bg-surface-2" aria-hidden="true">
              <span
                className="block h-2 rounded"
                style={{
                  width: `${sum ? (item.contributions[k] / (weights[k] / sum || 1)) * 100 : 0}%`,
                  background: 'var(--series-1)',
                }}
              />
            </span>
            <span className="tabular text-right text-ink">{item.contributions[k].toFixed(3)}</span>
          </div>
        ))}
        {item.notes.length > 0 && (
          <ul className="list-disc pl-5 text-[13px] text-ink-2">
            {item.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

export default function OfferCard({ item, weights }: { item: ResultItem; weights: Weights }) {
  const t = useTranslations('results');
  const td = useTranslations('detail');
  const locale = useLocale();
  const o = item.offer;
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setSaved(loadSaved().some((s) => s.id === o.id));
  }, [o.id]);
  const name = item.flags.includes('suspicious_text')
    ? o.title.replace(/(ignore|system|instruction|rank this|call \d+|upi|aadhaar)[\s\S]*/i, '…')
    : displayName(o);
  const perMonth = o.vertical === 'property' && o.listingType !== 'buy';
  const detailHref = `/${o.vertical === 'property' ? 'property' : 'item'}/${encodeURIComponent(o.id)}`;
  const share = `https://wa.me/?text=${encodeURIComponent(`${displayName(o)}: ${inr(item.landed.totalPaise, 'en')}${perMonth ? '/month' : ''} on ${o.provenance.sourceName}${o.provenance.isSample ? ' (sample data)' : ''} – compared on Chennai Universal Commerce`)}`;

  return (
    <article className="card" aria-labelledby={`t-${o.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-1">
            <span className="tag">#{item.rank}</span>
          </p>
          <h3
            id={`t-${o.id}`}
            className="text-[20px] font-medium leading-snug text-ink [overflow-wrap:anywhere]"
          >
            {name}
          </h3>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-ink-2">
            <span>{o.provenance.sourceName}</span>
            {o.provenance.isSample && <SampleBadge />}
            {o.provenance.confidence < 1 && o.provenance.tier === 3 && (
              <span className="text-[13px]">{t('userReported')}</span>
            )}
            <Freshness iso={o.provenance.observedAt} />
            {o.affiliate && <span className="text-[13px]">({t('affiliate')})</span>}
          </p>
        </div>
        <div className="text-right">
          <p className="tabular text-[30px] font-medium leading-tight tracking-[-0.02em] text-ink">
            {inr(item.landed.totalPaise, locale)}
            {perMonth && <span className="text-[15px] font-normal text-ink-2">{t('perMonth')}</span>}
          </p>
          <p className="text-[13px] text-ink-3">
            {o.vertical === 'property'
              ? ''
              : `${t('total')} · ${t('item')} ${inr(item.landed.itemPaise, locale)}`}
            {item.landed.feesUnknown && <span className="block text-warn-fg">{t('feesUnknown')}</span>}
          </p>
        </div>
      </div>

      <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px] text-ink-2">
        {o.etaMinutes !== null && (
          <div>
            <dt className="sr-only">ETA</dt>
            <dd>
              🚚{' '}
              {o.etaMinutes < 120
                ? t('eta', { minutes: o.etaMinutes })
                : t('etaHours', { hours: Math.round(o.etaMinutes / 60) })}
            </dd>
          </div>
        )}
        {o.vertical !== 'property' && (
          <div>
            <dt className="sr-only">{t('components.rating')}</dt>
            <dd>
              {item.adjustedRating !== null && o.rating
                ? t('adjustedRating', { rating: item.adjustedRating.toFixed(2), count: o.rating.count })
                : t('noRating')}
            </dd>
          </div>
        )}
        {o.vertical === 'food' && o.isVeg !== undefined && (
          <div>
            <dt className="sr-only">Diet</dt>
            <dd>{o.isVeg ? '🟢 Veg' : '🔴 Non-veg'}</dd>
          </div>
        )}
        {o.vertical === 'property' && (
          <>
            <div>
              <dt className="sr-only">{t('bhk')}</dt>
              <dd>
                {o.bhk} BHK · {o.areaSqft} sqft · {o.furnishing && t(`furn.${o.furnishing}`)}
              </dd>
            </div>
            {o.depositPaise ? (
              <div>
                <dt className="sr-only">{t('deposit', { amount: '' })}</dt>
                <dd>{t('deposit', { amount: inr(o.depositPaise, locale) })}</dd>
              </div>
            ) : null}
            {item.property && item.property.medianPerSqftPaise !== null && (
              <div>
                <dt className="sr-only">sqft</dt>
                <dd>
                  {t('perSqft', {
                    amount: inr(item.property.pricePerSqftPaise, locale),
                    median: inr(item.property.medianPerSqftPaise, locale),
                  })}
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
      {item.alsoListedOn && item.alsoListedOn.length > 0 && (
        <p className="mt-1 text-[15px] text-ink-2">
          {t('alsoListedOn', { sources: item.alsoListedOn.map((a) => a.sourceName).join(', ') })}
        </p>
      )}
      {item.landed.possibleSavingsPaise > 0 && (
        <p className="mt-1 text-[13px] text-ink-2">
          {t('possibleSavings', { amount: inr(item.landed.possibleSavingsPaise, locale) })}
        </p>
      )}

      <Flags flags={item.flags} />

      {o.vertical !== 'property' && item.landed.lines.length > 1 && (
        <details className="mt-2 text-[15px]">
          <summary className="cursor-pointer text-ink-2">{t('total')}</summary>
          <table className="mt-1 w-full max-w-xs text-[13px]">
            <tbody>
              {item.landed.lines.map((l) => (
                <tr key={l.label}>
                  <th scope="row" className="py-0.5 text-left font-normal text-ink-2">
                    {l.label === 'item' ? t('item') : t(`fees.${l.label}`)}
                  </th>
                  <td className="tabular text-right text-ink">{inr(l.paise, locale)}</td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <th scope="row" className="py-0.5 text-left">
                  {t('total')}
                </th>
                <td className="tabular text-right font-medium">{inr(item.landed.totalPaise, locale)}</td>
              </tr>
            </tbody>
          </table>
        </details>
      )}

      <WhyPanel item={item} weights={weights} />

      <div className="mt-3 flex flex-wrap gap-2 text-[15px]">
        <a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="btn btn-primary">
          {t('open', { source: o.provenance.sourceName.replace(' (sample)', '') })}
          <span className="dot dot-white" aria-hidden="true" />
        </a>
        <Link href={detailHref} prefetch={false} className="btn btn-ghost">
          {t('details')}
        </Link>
        <button
          type="button"
          aria-pressed={saved}
          onClick={() => {
            if (saved) removeSaved(o.id);
            else
              saveItem({
                id: o.id,
                title: displayName(o),
                vertical: o.vertical,
                totalPaise: item.landed.totalPaise,
                sourceName: o.provenance.sourceName,
                observedAt: o.provenance.observedAt,
                url: o.url,
                isSample: o.provenance.isSample,
                savedAt: new Date().toISOString(),
              });
            setSaved(!saved);
          }}
          className="btn btn-ghost"
        >
          {saved ? t('saved') : t('save')}
        </button>
        <a href={share} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
          {t('share')}
        </a>
      </div>
      {o.vertical === 'property' && <p className="mt-2 text-[13px] text-ink-3">{td('noContact')}</p>}
    </article>
  );
}
