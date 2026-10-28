'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link, usePathname } from '@/i18n/navigation';
import LanguageSwitch from './LanguageSwitch';

/** Floating white pill navigation on the cream canvas; green circular menu toggle on small screens. */
export default function Header() {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  const nav = [
    ['/', t('nav.home')],
    ['/grocery', t('nav.grocery')],
    ['/saved', t('nav.saved')],
    ['/admin/sources', t('nav.sources')],
    ['/about', t('nav.about')],
  ] as const;
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

  return (
    <header className="px-3 pt-3 sm:px-6 sm:pt-5">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-surface focus:px-4 focus:py-2"
      >
        {t('app.skip')}
      </a>
      <div className="mx-auto max-w-[1200px] rounded-[50px] bg-surface px-3 py-2.5 sm:px-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 rounded-full pr-2 no-underline">
            <span
              aria-hidden="true"
              className="grid h-10 w-10 place-items-center rounded-[14px] bg-grass text-lg font-medium"
            >
              ₹
            </span>
            <span className="text-[15px] font-medium sm:text-[17px]">{t('app.short')}</span>
          </Link>
          <nav aria-label="Main" className="hidden flex-1 justify-center lg:flex">
            <ul className="flex gap-1">
              {nav.map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? 'page' : undefined}
                    className={`block rounded-full px-4 py-2 text-[15px] font-medium no-underline ${isActive(href) ? 'bg-bg' : 'hover:bg-bg'}`}
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:block">
              <LanguageSwitch />
            </div>
            <Link href="/agent" className="btn btn-ghost hidden sm:inline-flex">
              {t('nav.agent')}
              <span className="dot dot-sky" aria-hidden="true" />
            </Link>
            <button
              type="button"
              aria-expanded={open}
              aria-controls="mobile-nav"
              onClick={() => setOpen(!open)}
              className="grid h-10 w-10 place-items-center rounded-full bg-grass lg:hidden"
            >
              <span className="sr-only">Menu</span>
              <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true">
                {open ? (
                  <path d="M3 1l12 12M15 1L3 13" stroke="#2c2e2a" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M1 2h16M1 7h16M1 12h16" stroke="#2c2e2a" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {open && (
          <nav
            id="mobile-nav"
            aria-label="Main"
            className="mt-2 border-t border-line px-1 pb-1 pt-3 lg:hidden"
          >
            <ul className="grid gap-1">
              {[...nav, ['/agent', t('nav.agent')] as const].map(([href, label]) => (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={isActive(href) ? 'page' : undefined}
                    className="block rounded-full px-4 py-2.5 text-[17px] font-medium no-underline hover:bg-bg"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-3 px-3 sm:hidden">
              <LanguageSwitch />
            </div>
          </nav>
        )}
      </div>
      <p
        role="note"
        className="mx-auto mt-3 flex max-w-[1200px] items-center justify-center gap-2 text-center text-[13px] font-medium"
      >
        <span className="dot dot-coral" aria-hidden="true" />
        {t('app.sampleBanner')}
      </p>
    </header>
  );
}
