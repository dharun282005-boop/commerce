'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import Chat from './Chat';

/** Side-panel assistant available on every page. */
export default function ChatLauncher() {
  const t = useTranslations('agent');
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 rounded-full bg-accent px-4 py-3 font-medium text-accent-fg shadow-lg"
      >
        💬 {t('open')}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="fixed inset-0 z-40 flex justify-end bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col bg-bg p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">{t('title')}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-line px-2 py-1 text-sm"
                autoFocus
              >
                {t('close')}
              </button>
            </div>
            <Chat compact />
          </div>
        </div>
      )}
    </>
  );
}
