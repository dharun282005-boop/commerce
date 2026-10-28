import type { Metadata, Viewport } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ChatLauncher from '@/components/ChatLauncher';
import Header from '@/components/Header';
import SWRegister from '@/components/SWRegister';
import { routing } from '@/i18n/routing';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  return {
    title: { default: t('name'), template: `%s · ${t('short')}` },
    description: t('tagline'),
    manifest: '/manifest.webmanifest',
    icons: { icon: '/icon.svg' },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfb' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a19' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const messages = await getMessages();
  const t = await getTranslations('app');
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-bg text-ink">
        <NextIntlClientProvider messages={messages}>
          <Suspense>
            <Header />
          </Suspense>
          <main id="main" className="mx-auto max-w-5xl px-4 py-6 pb-24">
            {children}
          </main>
          <footer className="mx-auto max-w-5xl px-4 pb-24 text-xs text-ink-3">{t('footer')}</footer>
          <ChatLauncher />
          <SWRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
