'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { api, ApiError } from '@/lib/api';

export default function AlertForm({ offerId, suggestedRs }: { offerId: string; suggestedRs: number }) {
  const t = useTranslations('alerts');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [rs, setRs] = useState(String(Math.floor(suggestedRs)));
  const [state, setState] = useState<'idle' | 'sent' | string>('idle');
  return (
    <form
      className="space-y-2 card !p-5 text-[15px]"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api('/v1/alerts', {
            method: 'POST',
            json: { email, offerId, thresholdRs: Number(rs), locale },
          });
          setState('sent');
        } catch (err) {
          setState(err instanceof ApiError ? err.message : 'error');
        }
      }}
    >
      <h3 className="font-medium">{t('title')}</h3>
      <label className="block">
        <span className="text-ink-2">{t('email')}</span>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field mt-1"
        />
      </label>
      <label className="block">
        <span className="text-ink-2">{t('threshold')}</span>
        <input
          inputMode="numeric"
          required
          value={rs}
          onChange={(e) => setRs(e.target.value)}
          className="field mt-1 !w-44"
        />
      </label>
      <button type="submit" className="btn btn-primary">
        {t('create')}
      </button>
      <p aria-live="polite" className="text-ink-2">
        {state === 'sent' ? t('sent') : state !== 'idle' ? state : ''}
      </p>
    </form>
  );
}
