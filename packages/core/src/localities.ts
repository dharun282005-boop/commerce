/**
 * Seeded Chennai localities. Coordinates are approximate centroids and Tamil names
 * still need checking by a native reader: both are listed in docs/15-open-questions.md.
 */
export interface Locality {
  id: string;
  name: string;
  nameTa: string;
  pincode: string;
  lat: number;
  lng: number;
  zone: 'Central' | 'North' | 'South' | 'West' | 'OMR' | 'Suburban';
  aliases: string[];
}

export const LOCALITIES: readonly Locality[] = [
  { id: 't-nagar', name: 'T Nagar', nameTa: 'தியாகராய நகர்', pincode: '600017', lat: 13.0418, lng: 80.2341, zone: 'Central', aliases: ['thyagaraya nagar', 'tnagar', 't. nagar'] },
  { id: 'adyar', name: 'Adyar', nameTa: 'அடையாறு', pincode: '600020', lat: 13.0012, lng: 80.2565, zone: 'South', aliases: [] },
  { id: 'anna-nagar', name: 'Anna Nagar', nameTa: 'அண்ணா நகர்', pincode: '600040', lat: 13.085, lng: 80.2101, zone: 'West', aliases: ['annanagar'] },
  { id: 'velachery', name: 'Velachery', nameTa: 'வேளச்சேரி', pincode: '600042', lat: 12.9815, lng: 80.218, zone: 'South', aliases: [] },
  { id: 'tambaram', name: 'Tambaram', nameTa: 'தாம்பரம்', pincode: '600045', lat: 12.9249, lng: 80.1, zone: 'Suburban', aliases: ['west tambaram'] },
  { id: 'porur', name: 'Porur', nameTa: 'போரூர்', pincode: '600116', lat: 13.0382, lng: 80.1565, zone: 'West', aliases: [] },
  { id: 'guindy', name: 'Guindy', nameTa: 'கிண்டி', pincode: '600032', lat: 13.0067, lng: 80.2206, zone: 'South', aliases: [] },
  { id: 'mylapore', name: 'Mylapore', nameTa: 'மயிலாப்பூர்', pincode: '600004', lat: 13.0339, lng: 80.2619, zone: 'Central', aliases: [] },
  { id: 'perungudi', name: 'Perungudi', nameTa: 'பெருங்குடி', pincode: '600096', lat: 12.9654, lng: 80.2461, zone: 'OMR', aliases: [] },
  { id: 'thoraipakkam', name: 'Thoraipakkam', nameTa: 'துரைப்பாக்கம்', pincode: '600097', lat: 12.9416, lng: 80.2362, zone: 'OMR', aliases: [] },
  { id: 'karapakkam', name: 'Karapakkam', nameTa: 'காரப்பாக்கம்', pincode: '600097', lat: 12.92, lng: 80.2295, zone: 'OMR', aliases: [] },
  { id: 'sholinganallur', name: 'Sholinganallur', nameTa: 'சோழிங்கநல்லூர்', pincode: '600119', lat: 12.901, lng: 80.2279, zone: 'OMR', aliases: [] },
  { id: 'navalur', name: 'Navalur', nameTa: 'நாவலூர்', pincode: '600130', lat: 12.8459, lng: 80.2265, zone: 'OMR', aliases: [] },
  { id: 'nungambakkam', name: 'Nungambakkam', nameTa: 'நுங்கம்பாக்கம்', pincode: '600034', lat: 13.0569, lng: 80.2425, zone: 'Central', aliases: [] },
  { id: 'besant-nagar', name: 'Besant Nagar', nameTa: 'பெசன்ட் நகர்', pincode: '600090', lat: 12.9982, lng: 80.2668, zone: 'South', aliases: ['bessie'] },
  { id: 'egmore', name: 'Egmore', nameTa: 'எழும்பூர்', pincode: '600008', lat: 13.0732, lng: 80.2609, zone: 'Central', aliases: [] },
  { id: 'kodambakkam', name: 'Kodambakkam', nameTa: 'கோடம்பாக்கம்', pincode: '600024', lat: 13.0524, lng: 80.2253, zone: 'Central', aliases: [] },
  { id: 'chromepet', name: 'Chromepet', nameTa: 'குரோம்பேட்டை', pincode: '600044', lat: 12.9516, lng: 80.1462, zone: 'Suburban', aliases: [] },
  { id: 'medavakkam', name: 'Medavakkam', nameTa: 'மேடவாக்கம்', pincode: '600100', lat: 12.9171, lng: 80.1923, zone: 'South', aliases: [] },
  { id: 'ashok-nagar', name: 'Ashok Nagar', nameTa: 'அசோக் நகர்', pincode: '600083', lat: 13.0358, lng: 80.212, zone: 'West', aliases: [] },
  { id: 'vadapalani', name: 'Vadapalani', nameTa: 'வடபழனி', pincode: '600026', lat: 13.05, lng: 80.2121, zone: 'West', aliases: [] },
  { id: 'royapettah', name: 'Royapettah', nameTa: 'ராயப்பேட்டை', pincode: '600014', lat: 13.054, lng: 80.264, zone: 'Central', aliases: [] },
];

/** Corridors are areas people search for that span several localities. */
export const CORRIDORS: Readonly<Record<string, { name: string; nameTa: string; aliases: string[]; members: string[] }>> = {
  omr: {
    name: 'OMR (Old Mahabalipuram Road)',
    nameTa: 'பழைய மகாபலிபுரம் சாலை',
    aliases: ['omr', 'old mahabalipuram road', 'rajiv gandhi salai', 'it corridor'],
    members: ['perungudi', 'thoraipakkam', 'karapakkam', 'sholinganallur', 'navalur'],
  },
};

export interface ResolvedArea {
  label: string;
  localities: Locality[];
  pincodes: string[];
}

const norm = (s: string) => s.toLowerCase().replace(/[.\s_-]+/g, ' ').trim();

/** Resolves a locality name, alias, corridor or pincode. Returns null if not a known Chennai area. */
export function resolveArea(input: string): ResolvedArea | null {
  const key = norm(input);
  if (!key) return null;

  for (const [id, c] of Object.entries(CORRIDORS)) {
    if (key === id || c.aliases.some((a) => norm(a) === key) || norm(c.name) === key) {
      const locs = LOCALITIES.filter((l) => c.members.includes(l.id));
      return { label: c.name, localities: locs, pincodes: unique(locs.map((l) => l.pincode)) };
    }
  }

  if (/^\d{6}$/.test(key)) {
    const locs = LOCALITIES.filter((l) => l.pincode === key);
    return locs.length ? { label: locs.map((l) => l.name).join(' / '), localities: locs, pincodes: [key] } : null;
  }

  const loc = LOCALITIES.find(
    (l) => norm(l.id) === key || norm(l.name) === key || l.aliases.some((a) => norm(a) === key),
  );
  return loc ? { label: loc.name, localities: [loc], pincodes: [loc.pincode] } : null;
}

export function searchLocalities(q: string | undefined): Locality[] {
  if (!q) return [...LOCALITIES];
  const key = norm(q);
  return LOCALITIES.filter(
    (l) =>
      l.pincode.startsWith(key) ||
      norm(l.name).includes(key) ||
      l.nameTa.includes(q.trim()) ||
      l.aliases.some((a) => norm(a).includes(key)),
  );
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
