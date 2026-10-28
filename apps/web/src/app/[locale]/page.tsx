import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import SearchForm from '@/components/SearchForm';
import { Link } from '@/i18n/navigation';

export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  const examples = [
    {
      label: t('search.ex1'),
      href: '/results?vertical=shopping&q=Samsung+Galaxy+S24+FE+128GB&locality=Velachery&preset=cheapest',
    },
    {
      label: t('search.ex2'),
      href: '/results?vertical=food&q=veg+biryani&locality=Adyar&veg=1&serves=2&maxRs=300&eta=40&preset=cheapest',
    },
    { label: t('search.ex3'), href: '/grocery?list=2+kg+rice%2C+1+L+milk%2C+12+eggs&locality=T+Nagar' },
    {
      label: t('search.ex4'),
      href: '/results?vertical=property&q=2+bhk&locality=OMR&bhk=2&listingType=rent&furnishing=semi-furnished&maxRs=30000',
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t('app.name')}</h1>
        <p className="mt-1 text-ink-2">{t('app.tagline')}</p>
      </div>
      <SearchForm />
      <section aria-labelledby="ex">
        <h2 id="ex" className="mb-2 text-sm font-medium text-ink-2">
          {t('search.examples')}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {examples.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="block rounded border border-line bg-surface px-3 py-2 text-sm text-ink hover:border-accent"
              >
                {e.label} →
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
