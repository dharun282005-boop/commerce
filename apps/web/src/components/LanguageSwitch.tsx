'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

export default function LanguageSwitch() {
  const locale = useLocale();
  const t = useTranslations('app');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (
    <label className="flex items-center gap-2 text-sm text-ink-2">
      <span className="sr-only">{t('language')}</span>
      <select
        value={locale}
        onChange={(e) => {
          const qs = params.toString();
          router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { locale: e.target.value });
        }}
        className="rounded border border-line bg-surface px-2 py-1 text-ink"
      >
        <option value="en">English</option>
        <option value="ta">தமிழ்</option>
      </select>
    </label>
  );
}
