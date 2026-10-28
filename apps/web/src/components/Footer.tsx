import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Yellow closing band. */
export default function Footer({ note }: { note: string }) {
  const t = useTranslations();
  return (
    <footer className="bg-sun">
      <div className="mx-auto grid max-w-[1200px] gap-6 px-4 py-14 sm:grid-cols-[2fr_1fr] sm:px-6">
        <div>
          <p className="t-heading-sm">{t('app.name')}</p>
          <p className="mt-3 max-w-xl text-[15px]">{note}</p>
          <p className="mt-2 max-w-xl text-[15px]">{t('app.sampleBanner')}</p>
        </div>
        <nav aria-label="Footer">
          <ul className="space-y-1.5 text-[15px] font-medium">
            {(
              [
                ['/about', t('nav.about')],
                ['/admin/sources', t('nav.sources')],
                ['/saved', t('nav.saved')],
                ['/agent', t('nav.agent')],
              ] as const
            ).map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="link">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
