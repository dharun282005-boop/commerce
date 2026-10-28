/**
 * Money is always an integer number of paise (1 rupee = 100 paise).
 * Integers avoid floating-point errors such as 0.1 + 0.2 !== 0.3.
 */
export type Paise = number;

export function rupeesToPaise(rupees: number): Paise {
  if (!Number.isFinite(rupees)) throw new RangeError('rupees must be a finite number');
  return Math.round(rupees * 100);
}

export function paiseToRupees(paise: Paise): number {
  return paise / 100;
}

export function assertPaise(value: number): Paise {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`not a valid paise amount: ${value}`);
  }
  return value;
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats with Indian digit grouping, e.g. 12345678 paise -> "₹1,23,456.78". */
export function formatINR(
  paise: Paise,
  opts: { locale?: 'en-IN' | 'ta-IN'; showPaise?: boolean } = {},
): string {
  const locale = opts.locale ?? 'en-IN';
  const showPaise = opts.showPaise ?? paise % 100 !== 0;
  const key = `${locale}:${showPaise}`;
  let fmt = formatters.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: showPaise ? 2 : 0,
      maximumFractionDigits: showPaise ? 2 : 0,
    });
    formatters.set(key, fmt);
  }
  return fmt.format(paise / 100);
}
