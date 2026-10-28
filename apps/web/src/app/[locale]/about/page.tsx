import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return { title: (await getTranslations({ locale, namespace: 'about' }))('title') };
}

export default async function About({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('about');
  const sections = ['sample', 'how', 'rules', 'checkout', 'privacy'] as const;
  const body = {
    sample: 'sample',
    how: 'tiers',
    rules: 'rules',
    checkout: 'checkout',
    privacy: 'privacy',
  } as const;
  return (
    <article className="max-w-prose space-y-5">
      <h1 className="t-heading">{t('title')}</h1>
      <p>{t('p1')}</p>
      {sections.map((s) => (
        <section key={s}>
          <h2 className="mb-1 font-medium">{t(`${s}Title`)}</h2>
          <p className="text-ink-2">{t(body[s])}</p>
        </section>
      ))}
      <p>
        <Link href="/admin/sources" className="link">
          {t('sources')} →
        </Link>
      </p>
    </article>
  );
}
