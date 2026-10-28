/**
 * Grocery / quick-commerce sample data. Common product names, MADE-UP prices.
 * Fees here are PER ORDER (not per item); cart splitting in Phase C uses them once per platform.
 */
export interface GroceryPlatformRules {
  source: string;
  delivery: number; // ₹ per order
  handling: number; // ₹ per order
  platform: number; // ₹ per order
  freeDeliveryAbove: number | null;
  minOrder: number | null;
  eta: number;
  notDeliveringTo: string[]; // locality ids
}

export const GROCERY_PLATFORMS: GroceryPlatformRules[] = [
  {
    source: 'fixture-blinkit',
    delivery: 30,
    handling: 4,
    platform: 0,
    freeDeliveryAbove: 199,
    minOrder: null,
    eta: 12,
    notDeliveringTo: [],
  },
  {
    source: 'fixture-zepto',
    delivery: 30,
    handling: 3,
    platform: 2,
    freeDeliveryAbove: 199,
    minOrder: null,
    eta: 10,
    notDeliveringTo: ['navalur'],
  },
  {
    source: 'fixture-instamart',
    delivery: 35,
    handling: 5,
    platform: 0,
    freeDeliveryAbove: 199,
    minOrder: null,
    eta: 15,
    notDeliveringTo: [],
  },
  {
    source: 'fixture-bigbasket',
    delivery: 40,
    handling: 0,
    platform: 0,
    freeDeliveryAbove: 600,
    minOrder: null,
    eta: 30,
    notDeliveringTo: [],
  },
  {
    source: 'fixture-ondc-grocery',
    delivery: 25,
    handling: 0,
    platform: 0,
    freeDeliveryAbove: null,
    minOrder: 150,
    eta: 45,
    notDeliveringTo: ['tambaram', 'chromepet', 'navalur'],
  },
];

export interface GroceryProduct {
  key: string;
  brand: string | null;
  product: string;
  category: string;
  quantity: string; // parsed with parseQuantity()
  packCount: number;
  prices: Partial<Record<string, number>>; // source id -> ₹
  mrp: number | null;
}

export const GROCERY_PRODUCTS: GroceryProduct[] = [
  {
    key: 'sona-masoori-1kg',
    brand: null,
    product: 'Sona Masoori Raw Rice',
    category: 'rice',
    quantity: '1 kg',
    packCount: 1,
    mrp: 90,
    prices: {
      'fixture-blinkit': 78,
      'fixture-zepto': 76,
      'fixture-instamart': 79,
      'fixture-bigbasket': 72,
      'fixture-ondc-grocery': 70,
    },
  },
  {
    key: 'sona-masoori-5kg',
    brand: null,
    product: 'Sona Masoori Raw Rice',
    category: 'rice',
    quantity: '5 kg',
    packCount: 1,
    mrp: 420,
    prices: {
      'fixture-blinkit': 365,
      'fixture-instamart': 369,
      'fixture-bigbasket': 340,
      'fixture-ondc-grocery': 335,
    },
  },
  {
    key: 'ponni-boiled-5kg',
    brand: null,
    product: 'Ponni Boiled Rice',
    category: 'rice',
    quantity: '5 kg',
    packCount: 1,
    mrp: 410,
    prices: { 'fixture-blinkit': 379, 'fixture-bigbasket': 355, 'fixture-ondc-grocery': 345 },
  },
  {
    key: 'aavin-toned-500',
    brand: 'Aavin',
    product: 'Toned Milk',
    category: 'milk',
    quantity: '500 ml',
    packCount: 1,
    mrp: null,
    prices: {
      'fixture-blinkit': 25,
      'fixture-zepto': 25,
      'fixture-instamart': 26,
      'fixture-bigbasket': 24,
      'fixture-ondc-grocery': 24,
    },
  },
  {
    key: 'heritage-toned-1l',
    brand: 'Heritage',
    product: 'Toned Milk',
    category: 'milk',
    quantity: '1 L',
    packCount: 1,
    mrp: 68,
    prices: { 'fixture-blinkit': 66, 'fixture-zepto': 64, 'fixture-instamart': 65, 'fixture-bigbasket': 62 },
  },
  {
    key: 'eggs-6',
    brand: null,
    product: 'Farm Fresh White Eggs',
    category: 'eggs',
    quantity: '6 pc',
    packCount: 1,
    mrp: 54,
    prices: { 'fixture-blinkit': 48, 'fixture-zepto': 47, 'fixture-instamart': 49, 'fixture-bigbasket': 45 },
  },
  {
    key: 'eggs-12',
    brand: null,
    product: 'Farm Fresh White Eggs',
    category: 'eggs',
    quantity: '12 pc',
    packCount: 1,
    mrp: 105,
    prices: {
      'fixture-blinkit': 92,
      'fixture-zepto': 89,
      'fixture-instamart': 94,
      'fixture-bigbasket': 84,
      'fixture-ondc-grocery': 82,
    },
  },
  {
    key: 'eggs-30',
    brand: null,
    product: 'Farm Fresh White Eggs',
    category: 'eggs',
    quantity: '30 pc',
    packCount: 1,
    mrp: 240,
    prices: { 'fixture-bigbasket': 199 },
  },
  {
    key: 'tata-salt-1kg',
    brand: 'Tata',
    product: 'Iodised Salt',
    category: 'staples',
    quantity: '1 kg',
    packCount: 1,
    mrp: 30,
    prices: { 'fixture-blinkit': 28, 'fixture-zepto': 28, 'fixture-instamart': 28, 'fixture-bigbasket': 27 },
  },
  {
    key: 'amul-butter-100',
    brand: 'Amul',
    product: 'Pasteurised Butter',
    category: 'dairy',
    quantity: '100 g',
    packCount: 1,
    mrp: 60,
    prices: { 'fixture-blinkit': 58, 'fixture-zepto': 57, 'fixture-instamart': 58, 'fixture-bigbasket': 56 },
  },
  {
    key: 'aashirvaad-atta-5kg',
    brand: 'Aashirvaad',
    product: 'Whole Wheat Atta',
    category: 'staples',
    quantity: '5 kg',
    packCount: 1,
    mrp: 320,
    prices: {
      'fixture-blinkit': 289,
      'fixture-zepto': 285,
      'fixture-instamart': 295,
      'fixture-bigbasket': 265,
    },
  },
  {
    key: 'onion-1kg',
    brand: null,
    product: 'Onion',
    category: 'vegetables',
    quantity: '1 kg',
    packCount: 1,
    mrp: null,
    prices: {
      'fixture-blinkit': 42,
      'fixture-zepto': 39,
      'fixture-instamart': 45,
      'fixture-bigbasket': 38,
      'fixture-ondc-grocery': 35,
    },
  },
  {
    key: 'tomato-1kg',
    brand: null,
    product: 'Tomato',
    category: 'vegetables',
    quantity: '1 kg',
    packCount: 1,
    mrp: null,
    prices: { 'fixture-blinkit': 36, 'fixture-zepto': 34, 'fixture-instamart': 38, 'fixture-bigbasket': 32 },
  },
];
