/** Canonical units: grams for mass, millilitres for volume, pieces for counts. */
export type CanonicalUnit = 'g' | 'ml' | 'pc';
export interface Quantity {
  value: number;
  unit: CanonicalUnit;
}

const FACTORS: Record<string, { unit: CanonicalUnit; factor: number }> = {
  mg: { unit: 'g', factor: 0.001 },
  g: { unit: 'g', factor: 1 },
  gm: { unit: 'g', factor: 1 },
  gms: { unit: 'g', factor: 1 },
  gram: { unit: 'g', factor: 1 },
  grams: { unit: 'g', factor: 1 },
  kg: { unit: 'g', factor: 1000 },
  kgs: { unit: 'g', factor: 1000 },
  ml: { unit: 'ml', factor: 1 },
  l: { unit: 'ml', factor: 1000 },
  ltr: { unit: 'ml', factor: 1000 },
  litre: { unit: 'ml', factor: 1000 },
  liter: { unit: 'ml', factor: 1000 },
  pc: { unit: 'pc', factor: 1 },
  pcs: { unit: 'pc', factor: 1 },
  piece: { unit: 'pc', factor: 1 },
  pieces: { unit: 'pc', factor: 1 },
  n: { unit: 'pc', factor: 1 },
  eggs: { unit: 'pc', factor: 1 },
};

/**
 * Parses strings like "2 kg", "500g", "1 L", "6 x 200 ml", "12 pcs".
 * Returns null when it cannot be sure (rule 3: no guessing).
 */
export function parseQuantity(text: string): Quantity | null {
  const t = text.trim().toLowerCase().replace(/,/g, '');
  const multi = t.match(/^(\d+)\s*[x×]\s*(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (multi) {
    const q = toCanonical(Number(multi[2]), multi[3]!);
    return q && { value: round(q.value * Number(multi[1])), unit: q.unit };
  }
  const single = t.match(/^(\d+(?:\.\d+)?)\s*([a-z]+)$/);
  if (single) return toCanonical(Number(single[1]), single[2]!);
  return null;
}

function toCanonical(value: number, unitText: string): Quantity | null {
  const f = FACTORS[unitText];
  if (!f || !Number.isFinite(value) || value <= 0) return null;
  return { value: round(value * f.factor), unit: f.unit };
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Price per 100 g / 100 ml / 1 piece, in paise (rounded). Null if quantity is unknown. */
export function unitPricePaise(pricePaise: number, qty: Quantity | null): number | null {
  if (!qty || qty.value <= 0) return null;
  const per = qty.unit === 'pc' ? 1 : 100;
  return Math.round((pricePaise / qty.value) * per);
}

export function formatQuantity(q: Quantity): string {
  if (q.unit === 'g') return q.value >= 1000 ? `${q.value / 1000} kg` : `${q.value} g`;
  if (q.unit === 'ml') return q.value >= 1000 ? `${q.value / 1000} L` : `${q.value} ml`;
  return `${q.value} pc`;
}
