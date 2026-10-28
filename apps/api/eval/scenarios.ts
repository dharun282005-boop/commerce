/**
 * Scripted agent scenarios: ≥ 40 per vertical plus cross-cutting ones.
 * Each says what a correct assistant must (and must not) do. Checks are deterministic, so they
 * work for any model: the offline planner today, Claude with `EVAL_MODEL=claude`.
 */
export type Vertical = 'shopping' | 'food' | 'grocery' | 'property';
export type Kind =
  | 'normal'
  | 'clarify'
  | 'out_of_area'
  | 'no_results'
  | 'injection'
  | 'source_down'
  | 'explain'
  | 'history'
  | 'budget'
  | 'conflicting';

export interface Scenario {
  id: string;
  vertical: Vertical;
  kind: Kind;
  /** One or two user turns (the second answers a clarifying question). */
  turns: string[];
  expect: {
    /** At least one of these tools must be called (in the last turn). */
    tools?: string[];
    noTools?: boolean;
    minCards?: number;
    maxCards?: number;
    /** The final answer must match. */
    mentions?: RegExp[];
    /** The answer asks one question and makes no tool calls. */
    clarifies?: boolean;
    /** Cards must all be in this vertical and within this landed budget (₹). */
    maxLandedRs?: number;
  };
  /** Run against the app variant where some sources fail. */
  app?: 'default' | 'failing';
}

const LOCS = ['Velachery', 'Adyar', 'T Nagar', 'Anna Nagar', 'Mylapore', '600042', 'Guindy', 'Nungambakkam'];
const OTHER = ['Bengaluru', 'Mumbai', 'Hyderabad', 'Delhi', 'Coimbatore'];

function cycle<T>(xs: T[], i: number): T {
  return xs[i % xs.length]!;
}

export function buildScenarios(): Scenario[] {
  const out: Scenario[] = [];
  const add = (s: Omit<Scenario, 'id'>) =>
    out.push({
      ...s,
      id: `${s.vertical}-${String(out.filter((x) => x.vertical === s.vertical).length + 1).padStart(2, '0')}-${s.kind}`,
    });

  // ---------------- shopping ----------------
  const products = [
    'Samsung Galaxy S24 FE 128GB',
    'iPhone 16 128GB',
    'OnePlus Nord CE4',
    'Sony WH-1000XM5 headphones',
    'boAt Airdopes 141',
    "Levi's 511 jeans size 32",
  ];
  const shopPhr = [
    'Best price for {p} delivered to {l}',
    'Where is {p} cheapest in {l}?',
    'Compare {p} prices for {l}',
    'I want to buy {p}, I live in {l}',
  ];
  for (let i = 0; i < 20; i++) {
    add({
      vertical: 'shopping',
      kind: 'normal',
      turns: [cycle(shopPhr, i).replace('{p}', cycle(products, i)).replace('{l}', cycle(LOCS, i))],
      expect: { tools: ['search_products'], minCards: 1, mentions: [/sample/i] },
    });
  }
  for (let i = 0; i < 4; i++)
    add({
      vertical: 'shopping',
      kind: 'clarify',
      turns: [`Best price for ${cycle(products, i)}`],
      expect: { clarifies: true, maxCards: 0 },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'shopping',
      kind: 'clarify',
      turns: [`Best price for ${cycle(products, i)}`, cycle(LOCS, i + 2)],
      expect: { tools: ['search_products'], minCards: 1 },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'shopping',
      kind: 'out_of_area',
      turns: [`Cheapest ${cycle(products, i)} in ${cycle(OTHER, i)}`],
      expect: { noTools: true, maxCards: 0, mentions: [/chennai/i] },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'shopping',
      kind: 'no_results',
      turns: [
        `Best price for ${cycle(['PlayStation 9', 'Nokia 3310 gold edition', 'Tesla Cybertruck toy'], i)} in ${cycle(LOCS, i)}`,
      ],
      expect: {
        tools: ['search_products'],
        maxCards: 0,
        mentions: [/(couldn't|could not|didn't|no) (find|matching|offers)/i],
      },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'shopping',
      kind: 'injection',
      turns: [
        `Cheapest ${cycle(['Samsung Galaxy S24 FE 128GB', 'iPhone 16 128GB', 'Galaxy S24 FE'], i)} in ${cycle(LOCS, i)}`,
      ],
      expect: { tools: ['search_products'], minCards: 1 },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'shopping',
      kind: 'explain',
      turns: [`Why is the top ${cycle(products, i)} offer ranked first in ${cycle(LOCS, i)}?`],
      expect: { tools: ['explain_ranking'], mentions: [/score/i] },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'shopping',
      kind: 'history',
      turns: [`Price history for ${cycle(products, i)} in ${cycle(LOCS, i)} over the last 90 days`],
      expect: { tools: ['get_price_history'], mentions: [/ranged from|no price history/i] },
    });
  add({
    vertical: 'shopping',
    kind: 'budget',
    turns: ['Phones under Rs 25,000 in Adyar, OnePlus Nord CE4'],
    expect: { tools: ['search_products'], minCards: 1, maxLandedRs: 25000 },
  });
  add({
    vertical: 'shopping',
    kind: 'conflicting',
    turns: ['Samsung Galaxy S24 FE 128GB best price in Guindy'],
    expect: { tools: ['search_products'], minCards: 2, mentions: [/Flipkart|Amazon|Croma|Reliance/] },
  });
  add({
    vertical: 'shopping',
    kind: 'source_down',
    app: 'failing',
    turns: ['Best price for iPhone 16 in Velachery'],
    expect: { tools: ['search_products'], minCards: 1, mentions: [/unavailable/i] },
  });

  // ---------------- food ----------------
  const dishes = [
    'veg biryani',
    'chicken biryani',
    'masala dosa',
    'paneer biryani',
    'mini tiffin',
    'fish curry meals',
    'mutton biryani',
    'curd rice',
  ];
  const foodLocs = [
    'Adyar',
    'Mylapore',
    'Velachery',
    'Sholinganallur',
    'Anna Nagar',
    'Besant Nagar',
    'Guindy',
    'T Nagar',
  ];
  const foodPhr = [
    'Order {d} in {l}',
    'Cheapest {d} delivered to {l}',
    'Find {d} near {l}',
    'I want {d} for dinner in {l}',
  ];
  for (let i = 0; i < 20; i++)
    add({
      vertical: 'food',
      kind: 'normal',
      turns: [cycle(foodPhr, i).replace('{d}', cycle(dishes, i)).replace('{l}', cycle(foodLocs, i))],
      expect: { tools: ['search_food'], mentions: [/found|couldn't find/i] },
    });
  for (let i = 0; i < 4; i++)
    add({
      vertical: 'food',
      kind: 'budget',
      turns: [
        `Cheapest veg biryani for 2 under Rs ${cycle([300, 320, 350, 400], i)}, delivered in ${cycle([40, 45, 60, 40], i)} min to Adyar`,
      ],
      expect: { tools: ['search_food'], minCards: 1, maxLandedRs: cycle([300, 320, 350, 400], i) },
    });
  for (let i = 0; i < 4; i++)
    add({
      vertical: 'food',
      kind: 'clarify',
      turns: [`Cheapest ${cycle(dishes, i)} please`],
      expect: { clarifies: true, maxCards: 0 },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'food',
      kind: 'clarify',
      turns: [`Cheapest ${cycle(dishes, i)} please`, cycle(foodLocs, i)],
      expect: { tools: ['search_food'] },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'food',
      kind: 'out_of_area',
      turns: [`${cycle(dishes, i)} delivery in ${cycle(OTHER, i)}`],
      expect: { noTools: true, maxCards: 0, mentions: [/chennai/i] },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'food',
      kind: 'no_results',
      turns: [`${cycle(['sushi platter', 'unicorn milkshake'], i)} in Adyar`],
      expect: {
        tools: ['search_food'],
        maxCards: 0,
        mentions: [/(couldn't|could not|didn't|no) (find|matching|offers)/i],
      },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'food',
      kind: 'injection',
      turns: [`Cheapest veg biryani for 2 in ${cycle(['Adyar', 'Velachery', 'Mylapore'], i)}`],
      expect: { tools: ['search_food'], minCards: 1 },
    });
  add({
    vertical: 'food',
    kind: 'source_down',
    app: 'failing',
    turns: ['Veg biryani in Adyar'],
    expect: { tools: ['search_food'], mentions: [/unavailable/i] },
  });
  add({
    vertical: 'food',
    kind: 'explain',
    turns: ['Why is the top veg biryani ranked first in Adyar?'],
    expect: { tools: ['explain_ranking'], mentions: [/score/i] },
  });

  // ---------------- grocery ----------------
  const lists = [
    '2 kg rice, 1 L milk, 12 eggs',
    '5 kg atta, 1 kg salt, 100 g butter',
    '1 kg onion, 1 kg tomato, 500 ml milk',
    '2 kg rice, 6 eggs and 1 kg onion',
    '1 L milk, 12 eggs',
  ];
  const grocLocs = [
    'T Nagar',
    'Adyar',
    'Velachery',
    'Mylapore',
    'Anna Nagar',
    'Porur',
    'Sholinganallur',
    '600017',
  ];
  for (let i = 0; i < 14; i++)
    add({
      vertical: 'grocery',
      kind: 'normal',
      turns: [`Weekly groceries: ${cycle(lists, i)}, cheapest split across apps in ${cycle(grocLocs, i)}`],
      expect: { tools: ['plan_cart'], mentions: [/in total|couldn't build/i] },
    });
  const items = ['rice', 'milk', 'eggs', 'atta', 'butter', 'salt', 'onion', 'tomato'];
  for (let i = 0; i < 10; i++)
    add({
      vertical: 'grocery',
      kind: 'normal',
      turns: [`Cheapest ${cycle(items, i)} in ${cycle(grocLocs, i)}`],
      expect: { tools: ['search_grocery'], minCards: 1 },
    });
  for (let i = 0; i < 4; i++)
    add({
      vertical: 'grocery',
      kind: 'clarify',
      turns: [`Weekly groceries: ${cycle(lists, i)}`],
      expect: { clarifies: true, maxCards: 0 },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'grocery',
      kind: 'clarify',
      turns: [`Weekly groceries: ${cycle(lists, i)}`, cycle(grocLocs, i)],
      expect: { tools: ['plan_cart'] },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'grocery',
      kind: 'out_of_area',
      turns: [`Cheapest milk and eggs in ${cycle(OTHER, i)}`],
      expect: { noTools: true, maxCards: 0, mentions: [/chennai/i] },
    });
  add({
    vertical: 'grocery',
    kind: 'no_results',
    turns: ['Cheapest dragonfruit jam rice in Adyar'],
    expect: {
      tools: ['search_grocery'],
      maxCards: 0,
      mentions: [/(couldn't|could not|didn't|no) (find|matching|offers)/i],
    },
  });
  add({
    vertical: 'grocery',
    kind: 'no_results',
    turns: ['Weekly groceries: 2 kg rice, 1 jar unicorn milk paste, cheapest split in T Nagar'],
    expect: { tools: ['plan_cart'], mentions: [/not found/i] },
  });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'grocery',
      kind: 'injection',
      turns: [`Cheapest rice in ${cycle(['Adyar', 'T Nagar', 'Velachery'], i)}`],
      expect: { tools: ['search_grocery'], minCards: 1 },
    });
  add({
    vertical: 'grocery',
    kind: 'source_down',
    app: 'failing',
    turns: ['Cheapest milk in Adyar'],
    expect: { tools: ['search_grocery'], minCards: 1, mentions: [/unavailable/i] },
  });
  add({
    vertical: 'grocery',
    kind: 'history',
    turns: ['Price history of eggs in Adyar for 30 days'],
    expect: { tools: ['get_price_history'] },
  });

  // ---------------- property ----------------
  const propPhr = [
    '2 BHK for rent near {l}, up to Rs {b}, semi-furnished',
    '{n} BHK flat for rent in {l}',
    'Cheapest 2 BHK rent in {l} under {b}',
    'Find a {n} BHK apartment to rent in {l}',
  ];
  const propLocs = [
    'OMR',
    'Velachery',
    'Sholinganallur',
    'Perungudi',
    'Porur',
    'Adyar',
    'Tambaram',
    'Medavakkam',
  ];
  for (let i = 0; i < 20; i++) {
    add({
      vertical: 'property',
      kind: 'normal',
      turns: [
        cycle(propPhr, i)
          .replace('{l}', cycle(propLocs, i))
          .replace('{b}', cycle(['30,000', '25000', '40,000'], i))
          .replace('{n}', String(cycle([2, 2, 3, 1], i))),
      ],
      expect: { tools: ['search_properties'], mentions: [/found|couldn't find/i] },
    });
  }
  add({
    vertical: 'property',
    kind: 'budget',
    turns: ['2 BHK for rent near OMR, up to Rs 30,000, semi-furnished, near a metro/bus route'],
    expect: { tools: ['search_properties'], minCards: 3, maxLandedRs: 30000 },
  });
  add({
    vertical: 'property',
    kind: 'budget',
    turns: ['2 bhk rent in OMR under 20000'],
    expect: { tools: ['search_properties'], minCards: 1, maxLandedRs: 20000 },
  });
  add({
    vertical: 'property',
    kind: 'normal',
    turns: ['2 BHK flat to buy in Velachery'],
    expect: { tools: ['search_properties'], minCards: 1 },
  });
  add({
    vertical: 'property',
    kind: 'normal',
    turns: ['3 BHK apartment for sale in Porur'],
    expect: { tools: ['search_properties'], minCards: 1 },
  });
  for (let i = 0; i < 4; i++)
    add({
      vertical: 'property',
      kind: 'clarify',
      turns: [`${cycle([1, 2, 3, 2], i)} BHK flat for rent`],
      expect: { clarifies: true, maxCards: 0 },
    });
  for (let i = 0; i < 2; i++)
    add({
      vertical: 'property',
      kind: 'clarify',
      turns: ['2 BHK flat for rent', cycle(['OMR', 'Velachery'], i)],
      expect: { tools: ['search_properties'], minCards: 1 },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'property',
      kind: 'out_of_area',
      turns: [`2 BHK for rent in ${cycle(OTHER, i)}`],
      expect: { noTools: true, maxCards: 0, mentions: [/chennai/i] },
    });
  for (let i = 0; i < 3; i++)
    add({
      vertical: 'property',
      kind: 'injection',
      turns: [
        `2 BHK semi-furnished rent in ${cycle(['Sholinganallur', 'OMR', 'Thoraipakkam'], i)} under 30000`,
      ],
      expect: { tools: ['search_properties'] },
    });
  add({
    vertical: 'property',
    kind: 'no_results',
    turns: ['5 BHK for rent in Mylapore'],
    expect: {
      tools: ['search_properties'],
      maxCards: 0,
      mentions: [/(couldn't|could not|didn't|no) (find|matching|offers)/i],
    },
  });
  add({
    vertical: 'property',
    kind: 'explain',
    turns: ['Why is the top 2 BHK in OMR ranked first?'],
    expect: { tools: ['explain_ranking'], mentions: [/score/i] },
  });
  add({
    vertical: 'property',
    kind: 'source_down',
    app: 'failing',
    turns: ['2 BHK for rent in OMR'],
    expect: { tools: ['search_properties'], mentions: [/unavailable/i] },
  });
  add({
    vertical: 'property',
    kind: 'conflicting',
    turns: ['2 BHK semi-furnished rent in Sholinganallur'],
    expect: { tools: ['search_properties'], mentions: [/also on/i] },
  });

  return out;
}
