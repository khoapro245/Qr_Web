import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';
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
  private readonly transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    ...(env.SMTP_USER && { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }),
  });

  async send(message: EmailMessage): Promise<void> {
    await this.transport.sendMail({ from: env.EMAIL_FROM, ...message });
  }
}

class DisabledEmailProvider implements EmailProvider {
  readonly enabled = false;
  send(): Promise<void> {
    return Promise.reject(new Error('Email delivery is disabled'));
  }
}

function createEmailProvider(): EmailProvider {
  switch (env.EMAIL_PROVIDER) {
    case 'console':
      return new ConsoleEmailProvider();
    case 'smtp':
      return new SmtpEmailProvider();
    case 'disabled':
      return new DisabledEmailProvider();
  }
}

export const emailProvider = createEmailProvider();
