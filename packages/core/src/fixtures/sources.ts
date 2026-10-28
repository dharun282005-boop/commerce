import type { Vertical } from '../schemas.ts';

/**
 * Sample sources. Each copies the *name* of a real platform so comparisons look realistic,
 * but all data is made up and labelled "(sample)". The real platform's Terms URL is recorded
 * for the compliance review in docs/06. Deep links go to the platform's public search page.
 * [VERIFY] The Terms URLs have not been opened yet. Check each one before any Phase D review.
 */
export interface FixtureSourceDef {
  id: string;
  name: string;
  platform: string;
  verticals: Vertical[];
  realTermsUrl: string | null;
  searchUrl: (q: string) => string;
}

const enc = encodeURIComponent;

export const FIXTURE_SOURCES: readonly FixtureSourceDef[] = [
  { id: 'fixture-amazon-in', name: 'Amazon.in (sample)', platform: 'Amazon.in', verticals: ['shopping'], realTermsUrl: 'https://www.amazon.in/gp/help/customer/display.html?nodeId=200545940', searchUrl: (q) => `https://www.amazon.in/s?k=${enc(q)}` },
  { id: 'fixture-flipkart', name: 'Flipkart (sample)', platform: 'Flipkart', verticals: ['shopping'], realTermsUrl: 'https://www.flipkart.com/pages/terms', searchUrl: (q) => `https://www.flipkart.com/search?q=${enc(q)}` },
  { id: 'fixture-croma', name: 'Croma (sample)', platform: 'Croma', verticals: ['shopping'], realTermsUrl: 'https://www.croma.com/terms-of-use', searchUrl: (q) => `https://www.croma.com/searchB?q=${enc(q)}` },
  { id: 'fixture-reliance-digital', name: 'Reliance Digital (sample)', platform: 'Reliance Digital', verticals: ['shopping'], realTermsUrl: 'https://www.reliancedigital.in/terms-and-conditions', searchUrl: (q) => `https://www.reliancedigital.in/search?q=${enc(q)}` },
  { id: 'fixture-myntra', name: 'Myntra (sample)', platform: 'Myntra', verticals: ['shopping'], realTermsUrl: 'https://www.myntra.com/termsofuse', searchUrl: (q) => `https://www.myntra.com/${enc(q.replace(/\s+/g, '-'))}` },
  { id: 'fixture-swiggy', name: 'Swiggy (sample)', platform: 'Swiggy', verticals: ['food'], realTermsUrl: 'https://www.swiggy.com/terms-and-conditions', searchUrl: (q) => `https://www.swiggy.com/search?query=${enc(q)}` },
  { id: 'fixture-zomato', name: 'Zomato (sample)', platform: 'Zomato', verticals: ['food'], realTermsUrl: 'https://www.zomato.com/policies/terms-of-service/', searchUrl: (q) => `https://www.zomato.com/chennai/delivery?q=${enc(q)}` },
  { id: 'fixture-ondc-food', name: 'ONDC food sellers (sample)', platform: 'ONDC', verticals: ['food'], realTermsUrl: 'https://ondc.org', searchUrl: () => 'https://ondc.org' },
  { id: 'fixture-blinkit', name: 'Blinkit (sample)', platform: 'Blinkit', verticals: ['grocery'], realTermsUrl: 'https://blinkit.com/terms', searchUrl: (q) => `https://blinkit.com/s/?q=${enc(q)}` },
  { id: 'fixture-zepto', name: 'Zepto (sample)', platform: 'Zepto', verticals: ['grocery'], realTermsUrl: 'https://www.zeptonow.com/terms-of-service', searchUrl: (q) => `https://www.zeptonow.com/search?query=${enc(q)}` },
  { id: 'fixture-instamart', name: 'Swiggy Instamart (sample)', platform: 'Swiggy Instamart', verticals: ['grocery'], realTermsUrl: 'https://www.swiggy.com/terms-and-conditions', searchUrl: (q) => `https://www.swiggy.com/instamart/search?query=${enc(q)}` },
  { id: 'fixture-bigbasket', name: 'BigBasket (sample)', platform: 'BigBasket', verticals: ['grocery'], realTermsUrl: 'https://www.bigbasket.com/terms-and-conditions/', searchUrl: (q) => `https://www.bigbasket.com/ps/?q=${enc(q)}` },
  { id: 'fixture-ondc-grocery', name: 'ONDC grocery sellers (sample)', platform: 'ONDC', verticals: ['grocery'], realTermsUrl: 'https://ondc.org', searchUrl: () => 'https://ondc.org' },
  { id: 'fixture-magicbricks', name: 'MagicBricks (sample)', platform: 'MagicBricks', verticals: ['property'], realTermsUrl: 'https://www.magicbricks.com/terms-conditions', searchUrl: (q) => `https://www.magicbricks.com/property-for-rent-rent-in-Chennai-pppfr?keyword=${enc(q)}` },
  { id: 'fixture-99acres', name: '99acres (sample)', platform: '99acres', verticals: ['property'], realTermsUrl: 'https://www.99acres.com/load/Company/termsconditions', searchUrl: (q) => `https://www.99acres.com/search/property/rent/chennai?keyword=${enc(q)}` },
  { id: 'fixture-nobroker', name: 'NoBroker (sample)', platform: 'NoBroker', verticals: ['property'], realTermsUrl: 'https://www.nobroker.in/terms_and_conditions', searchUrl: (q) => `https://www.nobroker.in/property/rent/chennai/${enc(q)}` },
  { id: 'fixture-housing', name: 'Housing.com (sample)', platform: 'Housing.com', verticals: ['property'], realTermsUrl: 'https://housing.com/terms-of-use', searchUrl: (q) => `https://housing.com/in/rent/search?q=${enc(q)}` },
];
