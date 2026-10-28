import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'ta'],
  defaultLocale: 'en',
  localePrefix: 'always',
});
