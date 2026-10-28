'use client';
/** Saved items live in this browser only (works offline). Every access is guarded. */
export interface SavedItem {
  id: string;
  title: string;
  vertical: string;
  totalPaise: number;
  sourceName: string;
  observedAt: string;
  url: string;
  isSample: boolean;
  savedAt: string;
}

const KEY = 'cuc.saved.v1';

export function loadSaved(): SavedItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedItem[]) : [];
  } catch {
    return [];
  }
}

export function saveItem(item: SavedItem) {
  try {
    const all = loadSaved().filter((x) => x.id !== item.id);
    localStorage.setItem(KEY, JSON.stringify([item, ...all].slice(0, 100)));
    window.dispatchEvent(new Event('cuc-saved'));
  } catch {
    /* storage unavailable */
  }
}

export function removeSaved(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadSaved().filter((x) => x.id !== id)));
    window.dispatchEvent(new Event('cuc-saved'));
  } catch {
    /* storage unavailable */
  }
}

export function getLocal(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLocal(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}
