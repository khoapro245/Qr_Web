import nodemailer, { type Transporter } from 'nodemailer';
import { env, type Env } from '../../config/env.js';
import { deliverToDevOutbox } from '../dev-outbox.js';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailProvider {
  readonly enabled: boolean;
  send(message: EmailMessage): Promise<void>;
}

export type EmailConfig = Pick<
  Env,
  | 'EMAIL_PROVIDER'
  | 'EMAIL_FROM'
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_SECURE'
  | 'SMTP_USER'
  | 'SMTP_PASS'
>;

class ConsoleEmailProvider implements EmailProvider {
  readonly enabled = true;
  send(message: EmailMessage): Promise<void> {
    deliverToDevOutbox({ channel: 'EMAIL', ...message });
    return Promise.resolve();
  }
}

/** Any SMTP service (Gmail Workspace, SES, SendGrid, Mailgun...) without vendor lock-in. */
class SmtpEmailProvider implements EmailProvider {
  readonly enabled = true;
  private readonly from: string;
  private readonly transport: Transporter;

  constructor(config: EmailConfig) {
    this.from = config.EMAIL_FROM;
    this.transport = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      ...(config.SMTP_USER && { auth: { user: config.SMTP_USER, pass: config.SMTP_PASS } }),
    });
  }

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: this.from, ...message });
  }
}

class DisabledEmailProvider implements EmailProvider {
  readonly enabled = false;
  send(): Promise<void> {
    return Promise.reject(new Error('Email delivery is disabled'));
  }
}

export function createEmailProvider(config: EmailConfig): EmailProvider {
  switch (config.EMAIL_PROVIDER) {
    case 'console':
      return new ConsoleEmailProvider();
    case 'smtp':
      return new SmtpEmailProvider(config);
    case 'disabled':
      return new DisabledEmailProvider();
  }
}

export const emailProvider = createEmailProvider(env);
