import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';
import SavedView from '@/components/SavedView';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  return { title: t('saved.title') };
}

export default async function Page({ params }: { params: Promise<{ locale: string; id?: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{t('saved.title')}</h1>
      <Suspense fallback={<p className="text-ink-2">…</p>}>
        <SavedView />
      </Suspense>
    </div>
  );
}
