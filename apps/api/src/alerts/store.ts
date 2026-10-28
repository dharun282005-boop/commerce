import type pg from 'pg';

export interface Alert {
  id: string;
  email: string;
  offerId: string;
  offerTitle: string;
  thresholdPaise: number;
  locale: string;
  verified: boolean;
  createdAt: string;
  lastNotifiedAt: string | null;
}

export interface AlertStore {
  add(a: Alert): Promise<void>;
  get(id: string): Promise<Alert | null>;
  verify(id: string): Promise<void>;
  byOffer(offerId: string): Promise<Alert[]>;
  byEmail(email: string): Promise<Alert[]>;
  markNotified(id: string, at: string): Promise<void>;
  deleteByEmail(email: string): Promise<number>;
  deleteOne(id: string, email: string): Promise<boolean>;
}

export class MemoryAlertStore implements AlertStore {
  private items = new Map<string, Alert>();
  async add(a: Alert) {
    this.items.set(a.id, { ...a });
  }
  async get(id: string) {
    return this.items.get(id) ?? null;
  }
  async verify(id: string) {
    const a = this.items.get(id);
    if (a) a.verified = true;
  }
  async byOffer(offerId: string) {
    return [...this.items.values()].filter((a) => a.verified && a.offerId === offerId);
  }
  async byEmail(email: string) {
    return [...this.items.values()].filter((a) => a.email === email);
  }
  async markNotified(id: string, at: string) {
    const a = this.items.get(id);
    if (a) a.lastNotifiedAt = at;
  }
  async deleteByEmail(email: string) {
    let n = 0;
    for (const [id, a] of this.items) if (a.email === email && this.items.delete(id)) n++;
    return n;
  }
  async deleteOne(id: string, email: string) {
    const a = this.items.get(id);
    return a?.email === email ? this.items.delete(id) : false;
  }
}

const row = (r: Record<string, unknown>): Alert => ({
  id: r.id as string,
  email: r.email as string,
  offerId: r.offer_id as string,
  offerTitle: r.offer_title as string,
  thresholdPaise: Number(r.threshold_paise),
  locale: r.locale as string,
  verified: r.verified as boolean,
  createdAt: new Date(r.created_at as string).toISOString(),
  lastNotifiedAt: r.last_notified_at ? new Date(r.last_notified_at as string).toISOString() : null,
});

export class PgAlertStore implements AlertStore {
  constructor(private pool: pg.Pool) {}
  async add(a: Alert) {
    await this.pool.query(
      'insert into alerts (id, email, offer_id, offer_title, threshold_paise, locale, verified) values ($1,$2,$3,$4,$5,$6,$7)',
      [a.id, a.email, a.offerId, a.offerTitle, a.thresholdPaise, a.locale, a.verified],
    );
  }
  async get(id: string) {
    const { rows } = await this.pool.query('select * from alerts where id = $1', [id]);
    return rows[0] ? row(rows[0]) : null;
  }
  async verify(id: string) {
    await this.pool.query('update alerts set verified = true where id = $1', [id]);
  }
  async byOffer(offerId: string) {
    const { rows } = await this.pool.query('select * from alerts where offer_id = $1 and verified', [
      offerId,
    ]);
    return rows.map(row);
  }
  async byEmail(email: string) {
    const { rows } = await this.pool.query('select * from alerts where email = $1 order by created_at', [
      email,
    ]);
    return rows.map(row);
  }
  async markNotified(id: string, at: string) {
    await this.pool.query('update alerts set last_notified_at = $2 where id = $1', [id, at]);
  }
  async deleteByEmail(email: string) {
    return (await this.pool.query('delete from alerts where email = $1', [email])).rowCount ?? 0;
  }
  async deleteOne(id: string, email: string) {
    return (
      ((await this.pool.query('delete from alerts where id = $1 and email = $2', [id, email])).rowCount ??
        0) > 0
    );
  }
}
