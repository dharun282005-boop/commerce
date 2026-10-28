import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import LanguageSwitch from './LanguageSwitch';

export default function Header() {
  const t = useTranslations();
  const nav = [
    ['/', t('nav.home')],
    ['/agent', t('nav.agent')],
    ['/grocery', t('nav.grocery')],
    ['/saved', t('nav.saved')],
    ['/admin/sources', t('nav.sources')],
    ['/about', t('nav.about')],
  ] as const;
  return (
    <header className="border-b border-line bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-accent-fg"
      >
        {t('app.skip')}
      </a>
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <Link href="/" className="text-lg font-semibold text-ink no-underline">
          {t('app.short')}
        </Link>
        <nav aria-label="Main" className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto sm:flex-1">
          <ul className="flex gap-1 whitespace-nowrap text-sm">
            {nav.map(([href, label]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="block rounded px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto sm:ml-0">
          <LanguageSwitch />
        </div>
      </div>
      <p role="note" className="bg-sample-bg px-4 py-1.5 text-center text-xs text-sample-fg">
        {t('app.sampleBanner')}
      </p>
    </header>
  );
}
