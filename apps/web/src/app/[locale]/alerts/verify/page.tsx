import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import AlertVerify from '@/components/AlertVerify';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('alerts.verifyTitle') };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="space-y-4">
      <h1 className="t-heading">{t('alerts.verifyTitle')}</h1>
      <Suspense fallback={<p className="text-ink-2">…</p>}>
        <AlertVerify />
      </Suspense>
    </div>
  );
}
