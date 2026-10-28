'use client';
import { useEffect } from 'react';

/** Registers the service worker that keeps the app shell and saved list usable offline. */
export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
