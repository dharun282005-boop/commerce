import { randomUUID } from 'node:crypto';
import { formatINR, landedCost, type Offer } from '@cuc/core';
import type { AlertStore, Alert } from './store.ts';
import type { Notifier } from './notify.ts';
import { signToken, verifyToken } from './tokens.ts';

const DAY = 86_400_000;

export interface AlertServiceDeps {
  store: AlertStore;
  notifier: Notifier;
  secret: string;
  webOrigin: string;
  now: () => Date;
}

/** Price alerts with double opt-in, re-notification at most once a day, export and delete. */
export class AlertService {
  constructor(private d: AlertServiceDeps) {}

  async create(input: {
    email: string;
    offer: Offer;
    thresholdPaise: number;
    locale: string;
  }): Promise<Alert> {
    const alert: Alert = {
      id: randomUUID(),
      email: input.email.toLowerCase(),
      offerId: input.offer.id,
      offerTitle: input.offer.title.slice(0, 200),
      thresholdPaise: input.thresholdPaise,
      locale: input.locale,
      verified: false,
      createdAt: this.d.now().toISOString(),
      lastNotifiedAt: null,
    };
    await this.d.store.add(alert);
    const token = signToken(
      { purpose: 'verify', email: alert.email, alertId: alert.id, exp: this.d.now().getTime() + 2 * DAY },
      this.d.secret,
    );
    const link = `${this.d.webOrigin}/${alert.locale}/alerts/verify?token=${encodeURIComponent(token)}`;
    await this.d.notifier.send(
      alert.email,
      'Confirm your price alert',
      `You asked to be told when "${alert.offerTitle}" costs ${formatINR(alert.thresholdPaise)} or less.\n\nConfirm here (link valid for 48 hours):\n${link}\n\nIf this wasn't you, ignore this email and nothing will be stored after it expires.\nThe same link lets you see, export or delete your alerts.`,
    );
    return alert;
  }

  /** Confirms an alert and returns an access token for "my data" (30 days). */
  async verify(token: string): Promise<{ accessToken: string; alert: Alert } | null> {
    const p = verifyToken(token, this.d.secret, 'verify', this.d.now().getTime());
    if (!p?.alertId) return null;
    const alert = await this.d.store.get(p.alertId);
    if (!alert || alert.email !== p.email) return null;
    await this.d.store.verify(alert.id);
    const accessToken = signToken(
      { purpose: 'access', email: alert.email, exp: this.d.now().getTime() + 30 * DAY },
      this.d.secret,
    );
    return { accessToken, alert: { ...alert, verified: true } };
  }

  emailFromAccess(token: string): string | null {
    return verifyToken(token, this.d.secret, 'access', this.d.now().getTime())?.email ?? null;
  }

  async export(email: string) {
    return { email, alerts: await this.d.store.byEmail(email), exportedAt: this.d.now().toISOString() };
  }

  deleteAll(email: string) {
    return this.d.store.deleteByEmail(email);
  }

  deleteOne(id: string, email: string) {
    return this.d.store.deleteOne(id, email);
  }

  /** Called with freshly observed offers. Sends at most one email per alert per day. */
  async check(offers: Offer[]): Promise<number> {
    let sent = 0;
    for (const o of offers) {
      const alerts = await this.d.store.byOffer(o.id);
      if (!alerts.length) continue;
      const total = landedCost(o).totalPaise;
      for (const a of alerts) {
        if (total > a.thresholdPaise) continue;
        if (a.lastNotifiedAt && this.d.now().getTime() - Date.parse(a.lastNotifiedAt) < DAY) continue;
        await this.d.notifier.send(
          a.email,
          `Price alert: ${a.offerTitle.slice(0, 60)}`,
          `Good news: "${a.offerTitle}" is now ${formatINR(total)} (your alert: ${formatINR(a.thresholdPaise)}) on ${o.provenance.sourceName}, checked ${o.provenance.observedAt}.\n${o.provenance.isSample ? 'Note: this is sample data, not a live price.\n' : ''}Prices can change at checkout: ${o.url}\n\nManage or delete your alerts: ${this.d.webOrigin}/${a.locale}/saved`,
        );
        await this.d.store.markNotified(a.id, this.d.now().toISOString());
        sent++;
      }
    }
    return sent;
  }
}
