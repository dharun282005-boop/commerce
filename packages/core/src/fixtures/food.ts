/**
 * Food sample data. Restaurants are FICTIONAL (rule 3: no invented ratings for real businesses).
 * Prices are made up. Food prices exclude 5% GST, which is shown as taxesNotIncluded.
 */
export interface Restaurant {
  id: string;
  name: string;
  localityId: string;
  deliversToLocalities: string[];
}

export const RESTAURANTS: Restaurant[] = [
  {
    id: 'marina-biryani-house',
    name: 'Marina Biryani House',
    localityId: 'adyar',
    deliversToLocalities: ['adyar', 'besant-nagar', 'mylapore', 'velachery', 'guindy'],
  },
  {
    id: 'kapali-veg-mess',
    name: 'Kapali Veg Mess',
    localityId: 'mylapore',
    deliversToLocalities: ['mylapore', 'adyar', 't-nagar', 'royapettah', 'nungambakkam'],
  },
  {
    id: 'omr-dum-pot',
    name: 'OMR Dum Pot',
    localityId: 'sholinganallur',
    deliversToLocalities: ['sholinganallur', 'karapakkam', 'thoraipakkam', 'navalur', 'perungudi'],
  },
  {
    id: 'anna-nagar-tiffin-corner',
    name: 'Anna Nagar Tiffin Corner',
    localityId: 'anna-nagar',
    deliversToLocalities: ['anna-nagar', 'kodambakkam', 'vadapalani', 'egmore'],
  },
  {
    id: 'velachery-spice-kitchen',
    name: 'Velachery Spice Kitchen',
    localityId: 'velachery',
    deliversToLocalities: ['velachery', 'adyar', 'guindy', 'medavakkam', 'perungudi'],
  },
  {
    id: 'coastal-curry-co',
    name: 'Coastal Curry Co.',
    localityId: 'besant-nagar',
    deliversToLocalities: ['besant-nagar', 'adyar', 'mylapore'],
  },
];

export interface FoodListing {
  source: string;
  price: number;
  delivery: number | null;
  packaging: number | null;
  platform: number | null;
  eta: number | null;
  restaurantRating: [number, number] | null;
  coupon?: { code: string | null; description: string; saving: number; verifiable: boolean };
}

export interface Dish {
  key: string;
  restaurantId: string;
  dish: string;
  servings: number;
  isVeg: boolean;
  tags: string[];
  listings: FoodListing[];
}

export const DISHES: Dish[] = [
  {
    key: 'mbh-veg-biryani-2',
    restaurantId: 'marina-biryani-house',
    dish: 'Veg Dum Biryani (serves 2)',
    servings: 2,
    isVeg: true,
    tags: ['biryani', 'rice'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 249,
        delivery: 35,
        packaging: 20,
        platform: 10,
        eta: 32,
        restaurantRating: [4.2, 8400],
        coupon: { code: 'SAVE50', description: '₹50 off above ₹199', saving: 50, verifiable: true },
      },
      {
        source: 'fixture-zomato',
        price: 259,
        delivery: 30,
        packaging: 25,
        platform: 6,
        eta: 38,
        restaurantRating: [4.1, 6200],
      },
      {
        source: 'fixture-ondc-food',
        price: 229,
        delivery: 40,
        packaging: 15,
        platform: 0,
        eta: 45,
        restaurantRating: null,
      },
    ],
  },
  {
    key: 'mbh-chicken-biryani-2',
    restaurantId: 'marina-biryani-house',
    dish: 'Chicken Dum Biryani (serves 2)',
    servings: 2,
    isVeg: false,
    tags: ['biryani', 'rice', 'chicken'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 349,
        delivery: 35,
        packaging: 20,
        platform: 10,
        eta: 32,
        restaurantRating: [4.2, 8400],
      },
      {
        source: 'fixture-zomato',
        price: 359,
        delivery: 30,
        packaging: 25,
        platform: 6,
        eta: 38,
        restaurantRating: [4.1, 6200],
      },
    ],
  },
  {
    key: 'kvm-veg-biryani-1',
    restaurantId: 'kapali-veg-mess',
    dish: 'Vegetable Biryani with Raita',
    servings: 1,
    isVeg: true,
    tags: ['biryani', 'rice', 'pure-veg'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 149,
        delivery: 25,
        packaging: 10,
        platform: 10,
        eta: 28,
        restaurantRating: [4.6, 15200],
      },
      {
        source: 'fixture-zomato',
        price: 145,
        delivery: 30,
        packaging: 10,
        platform: 6,
        eta: 30,
        restaurantRating: [4.5, 9800],
      },
    ],
  },
  {
    key: 'kvm-paneer-biryani-2',
    restaurantId: 'kapali-veg-mess',
    dish: 'Paneer Biryani (serves 2)',
    servings: 2,
    isVeg: true,
    tags: ['biryani', 'rice', 'paneer', 'pure-veg'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 289,
        delivery: 25,
        packaging: 15,
        platform: 10,
        eta: 30,
        restaurantRating: [4.6, 15200],
      },
      {
        source: 'fixture-zomato',
        price: 235,
        delivery: 30,
        packaging: 15,
        platform: 6,
        eta: 35,
        restaurantRating: [4.5, 9800],
      },
      {
        source: 'fixture-ondc-food',
        price: 265,
        delivery: 35,
        packaging: 10,
        platform: 0,
        eta: 50,
        restaurantRating: null,
      },
    ],
  },
  {
    key: 'kvm-mini-tiffin',
    restaurantId: 'kapali-veg-mess',
    dish: 'Mini Tiffin (idli, vada, pongal, kesari)',
    servings: 1,
    isVeg: true,
    tags: ['tiffin', 'south-indian', 'pure-veg'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 129,
        delivery: 25,
        packaging: 10,
        platform: 10,
        eta: 25,
        restaurantRating: [4.6, 15200],
      },
      {
        source: 'fixture-zomato',
        price: 125,
        delivery: 30,
        packaging: 10,
        platform: 6,
        eta: 27,
        restaurantRating: [4.5, 9800],
      },
    ],
  },
  {
    key: 'vsk-veg-biryani-2',
    restaurantId: 'velachery-spice-kitchen',
    dish: 'Veg Biryani Family Pack (serves 2-3)',
    servings: 2,
    isVeg: true,
    tags: ['biryani', 'rice'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 279,
        delivery: 40,
        packaging: 20,
        platform: 10,
        eta: 55,
        restaurantRating: [4.0, 2100],
      },
      {
        source: 'fixture-zomato',
        price: 269,
        delivery: 45,
        packaging: 20,
        platform: 6,
        eta: 50,
        restaurantRating: [4.9, 4],
      },
    ],
  },
  {
    key: 'vsk-mutton-biryani-1',
    restaurantId: 'velachery-spice-kitchen',
    dish: 'Mutton Biryani',
    servings: 1,
    isVeg: false,
    tags: ['biryani', 'rice', 'mutton'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 329,
        delivery: 40,
        packaging: 20,
        platform: 10,
        eta: 45,
        restaurantRating: [4.0, 2100],
      },
      {
        source: 'fixture-zomato',
        price: 319,
        delivery: 45,
        packaging: 20,
        platform: 6,
        eta: 48,
        restaurantRating: [4.9, 4],
      },
    ],
  },
  {
    key: 'odp-veg-biryani-2',
    restaurantId: 'omr-dum-pot',
    dish: 'Veg Dum Pot Biryani (serves 2)',
    servings: 2,
    isVeg: true,
    tags: ['biryani', 'rice'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 299,
        delivery: 30,
        packaging: 30,
        platform: 10,
        eta: 35,
        restaurantRating: [4.3, 5600],
      },
      {
        source: 'fixture-zomato',
        price: 309,
        delivery: 25,
        packaging: 30,
        platform: 6,
        eta: 33,
        restaurantRating: [4.3, 4100],
      },
      {
        source: 'fixture-ondc-food',
        price: 279,
        delivery: 35,
        packaging: 20,
        platform: 0,
        eta: 40,
        restaurantRating: null,
      },
    ],
  },
  {
    key: 'odp-chicken-biryani-1',
    restaurantId: 'omr-dum-pot',
    dish: 'Chicken Dum Pot Biryani',
    servings: 1,
    isVeg: false,
    tags: ['biryani', 'rice', 'chicken'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 239,
        delivery: 30,
        packaging: 30,
        platform: 10,
        eta: 35,
        restaurantRating: [4.3, 5600],
      },
      {
        source: 'fixture-zomato',
        price: 245,
        delivery: 25,
        packaging: 30,
        platform: 6,
        eta: 33,
        restaurantRating: [4.3, 4100],
      },
    ],
  },
  {
    key: 'antc-masala-dosa',
    restaurantId: 'anna-nagar-tiffin-corner',
    dish: 'Ghee Masala Dosa',
    servings: 1,
    isVeg: true,
    tags: ['dosa', 'south-indian', 'tiffin'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 110,
        delivery: 25,
        packaging: 10,
        platform: 10,
        eta: 25,
        restaurantRating: [4.4, 7300],
      },
      {
        source: 'fixture-zomato',
        price: 105,
        delivery: 25,
        packaging: 10,
        platform: 6,
        eta: 28,
        restaurantRating: [4.3, 5200],
      },
      {
        source: 'fixture-ondc-food',
        price: 99,
        delivery: 30,
        packaging: 5,
        platform: 0,
        eta: 35,
        restaurantRating: null,
      },
    ],
  },
  {
    key: 'antc-veg-biryani-1',
    restaurantId: 'anna-nagar-tiffin-corner',
    dish: 'Veg Biryani',
    servings: 1,
    isVeg: true,
    tags: ['biryani', 'rice'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 159,
        delivery: 25,
        packaging: 10,
        platform: 10,
        eta: 30,
        restaurantRating: [4.4, 7300],
      },
    ],
  },
  {
    key: 'ccc-fish-meals',
    restaurantId: 'coastal-curry-co',
    dish: 'Fish Curry Meals',
    servings: 1,
    isVeg: false,
    tags: ['meals', 'seafood', 'rice'],
    listings: [
      {
        source: 'fixture-swiggy',
        price: 219,
        delivery: 30,
        packaging: 15,
        platform: 10,
        eta: 40,
        restaurantRating: [4.5, 3900],
      },
      {
        source: 'fixture-zomato',
        price: 229,
        delivery: 30,
        packaging: 15,
        platform: 6,
        eta: 42,
        restaurantRating: [4.4, 3100],
      },
    ],
  },
  {
    key: 'ccc-curd-rice',
    restaurantId: 'coastal-curry-co',
    dish: 'Curd Rice',
    servings: 1,
    isVeg: true,
    tags: ['rice', 'south-indian'],
    listings: [
      {
        source: 'fixture-zomato',
        price: 89,
        delivery: 30,
        packaging: 10,
        platform: 6,
        eta: 35,
        restaurantRating: [4.4, 3100],
      },
    ],
  },
];
