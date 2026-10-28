'use client';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { setLocal } from '@/lib/saved';
import { ACCESS_KEY } from './SavedView';

export default function AlertVerify() {
  const t = useTranslations('alerts');
  const params = useSearchParams();
  const [state, setState] = useState<'wait' | 'ok' | 'bad'>('wait');
  useEffect(() => {
    const token = params.get('token');
    if (!token) return setState('bad');
    api<{ accessToken: string }>('/v1/alerts/verify', { method: 'POST', json: { token } })
      .then((r) => {
        setLocal(ACCESS_KEY, r.accessToken);
        setState('ok');
      })
      .catch(() => setState('bad'));
  }, [params]);
  return (
    <p aria-live="polite" className={state === 'bad' ? 'text-bad-fg' : 'text-ink'}>
      {state === 'wait' ? '…' : state === 'ok' ? t('verified') : t('invalid')}
    </p>
  );
}
