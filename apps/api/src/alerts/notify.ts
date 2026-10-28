import nodemailer from 'nodemailer';

/** Alert delivery is behind an interface (brief §6). Email works today; Web Push is a stub. */
export interface Notifier {
  readonly channel: 'email' | 'web-push';
  send(to: string, subject: string, text: string): Promise<void>;
}

export class SmtpNotifier implements Notifier {
  readonly channel = 'email' as const;
  private transport;
  constructor(
    smtpUrl: string,
    private from = 'Chennai Universal Commerce <alerts@chennai-commerce.local>',
  ) {
    this.transport = nodemailer.createTransport(smtpUrl);
  }
  async send(to: string, subject: string, text: string) {
    await this.transport.sendMail({ from: this.from, to, subject, text });
  }
}

/** Keeps messages in memory (tests, and when no SMTP is configured: logged instead of sent). */
export class MemoryNotifier implements Notifier {
  readonly channel = 'email' as const;
  sent: { to: string; subject: string; text: string }[] = [];
  async send(to: string, subject: string, text: string) {
    this.sent.push({ to, subject, text });
  }
}

/** Web Push needs VAPID keys and a subscription store; not configured in this project yet. */
export class WebPushStub implements Notifier {
  readonly channel = 'web-push' as const;
  async send(): Promise<void> {
    throw new Error('web push is not configured');
  }
}
