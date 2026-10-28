import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { parseQuantity } from '../units.ts';
import { rupeesToPaise } from '../money.ts';
import { Offer } from '../schemas.ts';
import { offerMatchesQuery } from './offer-query.ts';
import type { Compliance, RawOffer, SearchContext, SourceAdapter } from './types.ts';
import type { SearchQuery } from '../schemas.ts';

/**
 * Tier 3: the owner's own data (or a partner's file), loaded from CSV/JSON in a folder.
 * This is the "customised data" route: no platform is contacted.
 *
 * JSON: an array of canonical offers WITHOUT `id` and `provenance`, plus optional
 *   `externalId`, `isSample` (default true), `observedAt` (default: file time), `sourceName`.
 * CSV (shopping and grocery only): see data/imports/README.md for the columns.
 */
export interface ImportedRecord {
  externalId: string;
  offer: Offer;
}

export interface ImportReport {
  file: string;
  accepted: number;
  rejected: { row: number; error: string }[];
}

const Meta = z.object({
  externalId: z.string().min(1).max(100).optional(),
  isSample: z.boolean().default(true),
  observedAt: z.iso.datetime().optional(),
  sourceName: z.string().min(1).max(80).optional(),
});

export class ManualImportAdapter implements SourceAdapter {
  readonly id = 'manual-import';
  readonly name: string;
  readonly capabilities = {
    verticals: ['shopping', 'grocery', 'food', 'property'] as SourceAdapter['capabilities']['verticals'],
    supportsGetOffer: true,
    requiresCredentials: false,
  };
  readonly compliance: Compliance = {
    tier: 3,
    termsUrl: null,
    robotsAllowed: null,
    lastReviewed: '2026-10-29',
    enabledByDefault: true,
    notes:
      'Owner-supplied CSV/JSON files. No platform is contacted. Each row says whether it is sample data.',
  };
  private records: ImportedRecord[] = [];
  reports: ImportReport[] = [];

  constructor(
    private dir: string | null,
    name = 'Imported data',
  ) {
    this.name = name;
    if (dir) this.reload();
  }

  /** Re-reads every .json/.csv file in the folder. */
  reload(): ImportReport[] {
    this.records = [];
    this.reports = [];
    if (!this.dir) return [];
    let files: string[] = [];
    try {
      files = readdirSync(this.dir)
        .filter((f) => /\.(json|csv)$/i.test(f))
        .sort();
    } catch {
      return [];
    }
    for (const f of files) {
      const path = join(this.dir, f);
      const text = readFileSync(path, 'utf8');
      const mtime = statSync(path).mtime.toISOString();
      this.reports.push(
        this.addRows(f, f.endsWith('.csv') ? csvToRows(text) : (JSON.parse(text) as unknown[]), mtime),
      );
    }
    return this.reports;
  }

  /** Validates and adds rows (also used by the admin import endpoint). */
  addRows(label: string, rows: unknown[], defaultObservedAt: string): ImportReport {
    const report: ImportReport = { file: label, accepted: 0, rejected: [] };
    if (!Array.isArray(rows)) {
      report.rejected.push({ row: 0, error: 'expected an array of rows' });
      return report;
    }
    rows.forEach((row, i) => {
      try {
        const r = row as Record<string, unknown>;
        const meta = Meta.parse(r);
        const externalId = meta.externalId ?? `${label.replace(/\W+/g, '-')}-${i + 1}`;
        const sourceName = (meta.sourceName ?? this.name) + (meta.isSample ? ' (sample)' : '');
        const { externalId: _e, isSample: _s, observedAt: _o, sourceName: _n, ...offerFields } = r;
        const offer = Offer.parse({
          ...offerFields,
          id: `${this.id}:${externalId}`,
          provenance: {
            sourceId: this.id,
            sourceName,
            tier: 3,
            observedAt: meta.observedAt ?? defaultObservedAt,
            confidence: meta.isSample ? 1 : 0.9,
            isSample: meta.isSample,
          },
        });
        this.records = this.records.filter((x) => x.externalId !== externalId);
        this.records.push({ externalId, offer });
        report.accepted++;
      } catch (err) {
        report.rejected.push({
          row: i + 1,
          error: err instanceof z.ZodError ? z.prettifyError(err).slice(0, 300) : String(err).slice(0, 300),
        });
      }
    });
    return report;
  }

  async search(query: SearchQuery): Promise<RawOffer[]> {
    return this.records
      .filter((r) => offerMatchesQuery(r.offer, query))
      .map((r) => ({ externalId: r.externalId, payload: r.offer }));
  }

  async getOffer(externalId: string): Promise<RawOffer | null> {
    const r = this.records.find((x) => x.externalId === externalId);
    return r ? { externalId, payload: r.offer } : null;
  }

  normalise(raw: RawOffer, _ctx: SearchContext): unknown {
    return raw.payload;
  }

  async health() {
    const rejected = this.reports.reduce((s, r) => s + r.rejected.length, 0);
    return {
      ok: true,
      detail: `${this.records.length} imported rows from ${this.reports.length} files (${rejected} rejected)`,
    };
  }

  get size() {
    return this.records.length;
  }
}

// ---------- CSV ----------

/** Minimal RFC 4180 CSV parser (quotes, escaped quotes, commas and newlines inside quotes). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  row.push(field);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

const num = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : Number(s));
const paise = (s: string | undefined) => {
  const n = num(s);
  return n === null ? null : rupeesToPaise(n);
};
const str = (s: string | undefined) => (s === undefined || s.trim() === '' ? null : s.trim());

/** Turns CSV (header row + rows) into canonical-offer-shaped rows for shopping or grocery. */
export function csvToRows(text: string): unknown[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const cols = header.map((h) => h.trim().toLowerCase());
  return rows.map((cells) => {
    const c = Object.fromEntries(cols.map((k, i) => [k, cells[i]?.trim() ?? '']));
    const fees = {
      deliveryPaise: paise(c.delivery_rs),
      handlingPaise: paise(c.handling_rs) ?? 0,
      platformPaise: paise(c.platform_fee_rs) ?? 0,
      packagingPaise: 0,
      taxesNotIncludedPaise: 0,
    };
    const common = {
      externalId: str(c.external_id) ?? undefined,
      isSample: c.is_sample ? c.is_sample.toLowerCase() !== 'false' : true,
      observedAt: str(c.observed_at) ?? undefined,
      sourceName: str(c.source_name) ?? undefined,
      title: c.title,
      url: c.url,
      pricePaise: paise(c.price_rs),
      mrpPaise: paise(c.mrp_rs),
      fees,
      coupons: [],
      rating: num(c.rating) !== null ? { average: num(c.rating), count: num(c.rating_count) ?? 0 } : null,
      etaMinutes: num(c.eta_min),
      trust: { fulfilledByPlatform: null, returnPolicyDays: num(c.return_days), sellerRating: null },
      affiliate: false,
    };
    const pincodes = (c.pincodes ?? '').split(/[\s;|]+/).filter(Boolean);
    if (c.vertical === 'grocery') {
      return {
        ...common,
        vertical: 'grocery',
        brand: str(c.brand),
        product: c.product || c.title,
        category: c.category || 'grocery',
        quantity: parseQuantity(c.quantity ?? ''),
        packCount: num(c.pack_count) ?? 1,
        deliversTo: pincodes,
        order: {
          minOrderPaise: paise(c.min_order_rs),
          freeDeliveryAbovePaise: paise(c.free_delivery_above_rs),
        },
      };
    }
    return {
      ...common,
      vertical: c.vertical || 'shopping',
      brand: c.brand ?? '',
      model: c.model ?? '',
      category: c.category || 'general',
      seller: str(c.seller),
      variant: {
        storageGb: num(c.storage_gb),
        ramGb: num(c.ram_gb),
        colour: str(c.colour),
        size: str(c.size),
      },
      identifiers: { gtin: str(c.gtin), asin: null, mpn: str(c.mpn), modelNumber: str(c.model_number) },
      deliversTo: pincodes.length ? pincodes : null,
    };
  });
}
