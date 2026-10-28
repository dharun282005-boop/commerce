import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { HeroArt, VerticalIcon } from '@/components/Art';
import SearchForm from '@/components/SearchForm';
import { Link } from '@/i18n/navigation';

export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale);
  const t = useTranslations();
  const examples = [
    {
      v: 'shopping',
      label: t('search.ex1'),
      href: '/results?vertical=shopping&q=Samsung+Galaxy+S24+FE+128GB&locality=Velachery&preset=cheapest',
    },
    {
      v: 'food',
      label: t('search.ex2'),
      href: '/results?vertical=food&q=veg+biryani&locality=Adyar&veg=1&serves=2&maxRs=300&eta=40&preset=cheapest',
    },
    {
      v: 'grocery',
      label: t('search.ex3'),
      href: '/grocery?list=2+kg+rice%2C+1+L+milk%2C+12+eggs&locality=T+Nagar',
    },
    {
      v: 'property',
      label: t('search.ex4'),
      href: '/results?vertical=property&q=2+bhk&locality=OMR&bhk=2&listingType=rent&furnishing=semi-furnished&maxRs=30000',
    },
  ] as const;
  return (
    <div className="space-y-16 sm:space-y-24">
      <section className="pt-6 sm:pt-12">
        <h1 className="t-display max-w-[11ch]">{t('home.headline')}</h1>
        <p className="mt-6 max-w-2xl text-[18px] sm:text-[20px]">{t('app.tagline')}</p>
        <HeroArt className="mt-8 h-auto w-full max-w-3xl" />
      </section>

      <section aria-labelledby="search-h" className="sheet -mt-6 sm:-mt-10">
        <h2 id="search-h" className="t-heading-sm mb-5">
          {t('home.searchTitle')}
        </h2>
        <SearchForm />
      </section>

      <section aria-labelledby="ex">
        <h2 id="ex" className="t-heading mb-8">
          {t('search.examples')}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {examples.map((e) => (
            <li key={e.href}>
              <Link
                href={e.href}
                className="card flex h-full items-center gap-4 no-underline transition-colors hover:bg-[#fbfaf5]"
              >
                <VerticalIcon vertical={e.v} className="h-12 w-12 flex-none" />
                <span className="flex-1 text-[17px] font-medium">{e.label}</span>
                <span className="dot dot-sky" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how" className="grid gap-4 sm:grid-cols-3">
        <h2 id="how" className="sr-only">
          {t('home.howTitle')}
        </h2>
        {(['total', 'why', 'trust'] as const).map((k, i) => (
          <div key={k} className="card">
            <span
              className={`dot ${['dot-grass', 'dot-sky', 'dot-coral'][i]} mb-4 block !h-4 !w-4`}
              aria-hidden="true"
            />
            <h3 className="t-heading-sm">{t(`home.${k}Title`)}</h3>
            <p className="mt-2 text-[15px] text-ink-2">{t(`home.${k}Body`)}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
