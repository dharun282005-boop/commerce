import type { Offer } from '../schemas.ts';

export interface CostLine {
  label: 'item' | 'delivery' | 'handling' | 'platform' | 'packaging' | 'taxes' | 'coupon';
  paise: number;
}

export interface LandedCost {
  itemPaise: number;
  feesPaise: number;
  couponSavingsPaise: number;
  /** Coupons we could not verify. Shown separately, never subtracted. */
  possibleSavingsPaise: number;
  totalPaise: number;
  /** True when at least one fee was missing. It counts as 0 but the UI must say "fees unknown". */
  feesUnknown: boolean;
  lines: CostLine[];
}

/**
 * Total landed cost = item + delivery + handling + platform + packaging + taxes not included
 * − verifiable coupons (docs/07 §1). Grocery fees are per order: here they are applied as if this
 * item were the whole order, with the free-delivery threshold respected.
 * Property: the monthly rent or sale price only (the deposit is shown separately).
 */
export function landedCost(o: Offer): LandedCost {
  const lines: CostLine[] = [{ label: 'item', paise: o.pricePaise }];
  if (o.vertical === 'property') {
    return {
      itemPaise: o.pricePaise,
      feesPaise: 0,
      couponSavingsPaise: 0,
      possibleSavingsPaise: 0,
      totalPaise: o.pricePaise,
      feesUnknown: false,
      lines,
    };
  }

  let feesUnknown = false;
  const add = (label: CostLine['label'], v: number | null) => {
    if (v === null) feesUnknown = true;
    else if (v > 0) lines.push({ label, paise: v });
  };
  let delivery = o.fees.deliveryPaise;
  if (
    o.vertical === 'grocery' &&
    delivery !== null &&
    o.order.freeDeliveryAbovePaise !== null &&
    o.pricePaise >= o.order.freeDeliveryAbovePaise
  ) {
    delivery = 0;
  }
  add('delivery', delivery);
  add('handling', o.fees.handlingPaise);
  add('platform', o.fees.platformPaise);
  add('packaging', o.fees.packagingPaise);
  add('taxes', o.fees.taxesNotIncludedPaise);

  const feesPaise = lines.slice(1).reduce((s, l) => s + l.paise, 0);
  const subtotal = o.pricePaise + feesPaise;
  let couponSavingsPaise = 0;
  let possibleSavingsPaise = 0;
  for (const c of o.coupons) {
    if (c.verifiable) couponSavingsPaise += c.savingPaise;
    else possibleSavingsPaise += c.savingPaise;
  }
  couponSavingsPaise = Math.min(couponSavingsPaise, subtotal); // never below zero
  if (couponSavingsPaise > 0) lines.push({ label: 'coupon', paise: -couponSavingsPaise });

  return {
    itemPaise: o.pricePaise,
    feesPaise,
    couponSavingsPaise,
    possibleSavingsPaise,
    totalPaise: subtotal - couponSavingsPaise,
    feesUnknown,
    lines,
  };
}
