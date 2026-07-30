import nodemailer from 'nodemailer';
import { env } from '@/lib/env';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
}

// Provider-agnostic mailer. SMTP today; a Resend/SES implementation only
// needs to satisfy this interface.
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

export class SmtpMailer implements Mailer {
  private transporter;

  constructor() {
    const { host, port, user, pass } = env.smtp;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user ? { user, pass } : undefined,
    });
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: env.smtp.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
    });
  }
}

export class DryRunMailer implements Mailer {
  // Kept in memory so tests and the admin UI can inspect what would have gone out.
  public sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.sent.push(message);
    console.log(
      `[DRY_RUN] Would send email to=${message.to} subject="${message.subject}" (${message.html.length} bytes html)`,
    );
  }
}

let mailer: Mailer | undefined;

export function getMailer(): Mailer {
  if (!mailer) {
    mailer = env.dryRun ? new DryRunMailer() : new SmtpMailer();
  }
  return mailer;
}

// Test seam: inject a fake mailer.
export function setMailer(m: Mailer | undefined): void {
  mailer = m;
}
