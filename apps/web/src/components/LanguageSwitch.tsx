'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { usePathname, useRouter } from '@/i18n/navigation';

/** Two small pills: EN / தமிழ். */
export default function LanguageSwitch() {
  const locale = useLocale();
  const t = useTranslations('app');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const go = (l: string) => {
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { locale: l });
  };
  return (
    <div
      role="group"
      aria-label={t('language')}
      className="flex rounded-full bg-bg p-1 text-[13px] font-medium"
    >
      {(
        [
          ['en', 'EN'],
          ['ta', 'தமிழ்'],
        ] as const
      ).map(([l, label]) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={locale === l}
          onClick={() => go(l)}
          className={`rounded-full px-3 py-1.5 ${locale === l ? 'bg-surface' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
