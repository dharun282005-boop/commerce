/**
 * Bayesian-adjusted rating: R* = (C·m + n·r̄) / (C + n).
 * m = prior mean, C = how many ratings it takes before we trust the source's average.
 */
export interface RatingPrior {
  m: number;
  C: number;
}

export const DEFAULT_PRIOR: RatingPrior = { m: 4.0, C: 50 };

export function bayesianRating(average: number, count: number, prior: RatingPrior = DEFAULT_PRIOR): number {
  if (count < 0 || !Number.isFinite(average)) throw new RangeError('invalid rating');
  return (prior.C * prior.m + count * average) / (prior.C + count);
}
