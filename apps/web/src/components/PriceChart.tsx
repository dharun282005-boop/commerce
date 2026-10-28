'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';
import { inr } from '@/lib/format';

export interface Point {
  observedAt: string;
  pricePaise: number;
}

/**
 * Single-series price history: 2px line in series-1, recessive grid, crosshair that snaps to the
 * nearest day (pointer and arrow keys), tooltip with the value first, and a table view.
 * One series, so no legend: the heading names it.
 */
export default function PriceChart({ points, title }: { points: Point[]; title: string }) {
  const locale = useLocale();
  const t = useTranslations('detail');
  const id = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 640;
  const H = 220;
  const pad = { l: 64, r: 12, t: 12, b: 28 };

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const ys = points.map((p) => p.pricePaise);
    let min = Math.min(...ys);
    let max = Math.max(...ys);
    if (min === max) {
      min *= 0.95;
      max *= 1.05;
    }
    const span = max - min;
    min -= span * 0.1;
    max += span * 0.1;
    const x = (i: number) =>
      pad.l + (points.length === 1 ? 0 : (i / (points.length - 1)) * (W - pad.l - pad.r));
    const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
    const ticks = [0, 0.5, 1].map((f) => min + f * (max - min));
    return {
      x,
      y,
      ticks,
      path: points
        .map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.pricePaise).toFixed(1)}`)
        .join(' '),
    };
  }, [points]);

  if (!geo) return <p className="text-[15px] text-ink-2">{t('noHistory')}</p>;
  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'ta' ? 'ta-IN' : 'en-IN', { day: 'numeric', month: 'short' });
  const a = active === null ? null : points[active]!;

  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - pad.l) / (W - pad.l - pad.r)) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  };

  return (
    <figure className="space-y-2">
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full touch-none select-none"
          role="img"
          aria-labelledby={`${id}-t`}
          tabIndex={0}
          onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') setActive((v) => Math.max(0, (v ?? points.length - 1) - 1));
            if (e.key === 'ArrowRight') setActive((v) => Math.min(points.length - 1, (v ?? 0) + 1));
          }}
        >
          <title id={`${id}-t`}>{title}</title>
          {geo.ticks.map((v) => (
            <g key={v}>
              <line
                x1={pad.l}
                x2={W - pad.r}
                y1={geo.y(v)}
                y2={geo.y(v)}
                stroke="var(--grid)"
                strokeWidth={1}
              />
              <text
                x={pad.l - 6}
                y={geo.y(v) + 4}
                textAnchor="end"
                fontSize={11}
                fill="var(--text-3)"
                className="tabular"
              >
                {inr(Math.round(v / 100) * 100, locale)}
              </text>
            </g>
          ))}
          <text x={pad.l} y={H - 8} fontSize={11} fill="var(--text-3)">
            {fmtDate(points[0]!.observedAt)}
          </text>
          <text x={W - pad.r} y={H - 8} fontSize={11} fill="var(--text-3)" textAnchor="end">
            {fmtDate(points.at(-1)!.observedAt)}
          </text>
          <path
            d={geo.path}
            fill="none"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {a && active !== null && (
            <g>
              <line
                x1={geo.x(active)}
                x2={geo.x(active)}
                y1={pad.t}
                y2={H - pad.b}
                stroke="var(--text-3)"
                strokeWidth={1}
              />
              <circle
                cx={geo.x(active)}
                cy={geo.y(a.pricePaise)}
                r={4}
                fill="var(--series-1)"
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>
        {a && active !== null && (
          <div
            className="pointer-events-none absolute top-1 rounded-[14px] border-[1.5px] border-ink bg-surface px-3 py-1.5 text-[13px]"
            style={{ left: `clamp(0px, calc(${(geo.x(active) / W) * 100}% - 3.5rem), calc(100% - 7rem))` }}
            role="status"
          >
            <strong className="tabular block text-[15px] text-ink">{inr(a.pricePaise, locale)}</strong>
            <span className="text-ink-2">{fmtDate(a.observedAt)}</span>
          </div>
        )}
      </div>
      <details className="text-[15px]">
        <summary className="cursor-pointer text-ink-2">Table</summary>
        <div className="max-h-56 overflow-y-auto">
          <table className="w-full max-w-xs text-[13px]">
            <caption className="sr-only">{title}</caption>
            <tbody>
              {points.map((p) => (
                <tr key={p.observedAt}>
                  <th scope="row" className="text-left font-normal text-ink-2">
                    {fmtDate(p.observedAt)}
                  </th>
                  <td className="tabular text-right">{inr(p.pricePaise, locale)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
