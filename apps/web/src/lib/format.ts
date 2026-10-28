/** Money is paise everywhere; display uses Indian digit grouping (₹1,23,456). */
export function inr(paise: number, locale: string = 'en'): string {
  const showPaise = paise % 100 !== 0;
  return new Intl.NumberFormat(locale === 'ta' ? 'ta-IN' : 'en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: showPaise ? 2 : 0,
    maximumFractionDigits: showPaise ? 2 : 0,
  }).format(paise / 100);
}

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
}

export function displayName(o: {
  vertical: string;
  title: string;
  dish?: string;
  restaurant?: { name: string };
}): string {
  return o.vertical === 'food' && o.dish && o.restaurant ? `${o.dish} · ${o.restaurant.name}` : o.title;
}
