import { SourceError, type Compliance, type RawOffer, type SourceAdapter } from './types.ts';

/**
 * Tier 1 placeholders for official APIs. They ship DISABLED and do nothing until the owner has
 * credentials, has accepted the API terms, and approves the source (rule 1, Phase D).
 * Names and terms must be confirmed in the official docs first (docs/06, docs/15).
 */
function officialStub(id: string, name: string, termsUrl: string, notes: string): SourceAdapter {
  const compliance: Compliance = {
    tier: 1,
    termsUrl,
    robotsAllowed: null,
    lastReviewed: '2026-10-29',
    enabledByDefault: false,
    notes,
  };
  return {
    id,
    name,
    capabilities: { verticals: ['shopping'], supportsGetOffer: false, requiresCredentials: true },
    compliance,
    async search(): Promise<RawOffer[]> {
      throw new SourceError('disabled', 'not configured: needs owner credentials and approval');
    },
    async getOffer() {
      return null;
    },
    normalise() {
      throw new SourceError('disabled', 'not configured');
    },
    async health() {
      return { ok: false, detail: 'not configured (no credentials; owner approval needed)' };
    },
  };
}

export const amazonOfficialApi = () =>
  officialStub(
    'amazon-in-official',
    'Amazon.in official product API',
    'https://affiliate-program.amazon.in/',
    'Amazon Product Advertising API / Creators API [VERIFY current name, eligibility and terms]. Disabled.',
  );

export const flipkartOfficialApi = () =>
  officialStub(
    'flipkart-affiliate',
    'Flipkart Affiliate API',
    'https://affiliate.flipkart.com/',
    'Flipkart Affiliate product feed API [VERIFY availability and terms]. Disabled.',
  );
