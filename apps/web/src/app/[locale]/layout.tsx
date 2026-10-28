import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Tamil } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import ChatLauncher from '@/components/ChatLauncher';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import SWRegister from '@/components/SWRegister';
import { routing } from '@/i18n/routing';
import '../globals.css';

// Self-hosted at build time by next/font (no runtime requests to Google, CSP stays 'self').
const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-inter',
  display: 'swap',
});
const tamil = Noto_Sans_Tamil({
  subsets: ['tamil'],
  weight: ['400', '500'],
  variable: '--font-tamil',
  display: 'swap',
  preload: false,
});

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
  themeColor: '#f5f1e4',
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
    <html lang={locale} className={`${inter.variable} ${tamil.variable}`}>
      <body className="min-h-screen bg-bg text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <Suspense>
            <Header />
          </Suspense>
          <main id="main" className="mx-auto max-w-[1200px] px-4 pb-24 pt-6 sm:px-6">
            {children}
          </main>
          <Footer note={t('footer')} />
          <ChatLauncher />
          <SWRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
