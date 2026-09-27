import { appendFileSync } from 'node:fs';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

export interface OutboxMessage {
  channel: 'EMAIL' | 'SMS';
  to: string;
  subject?: string;
  text: string;
  sentAt: Date;
}

const MAX_MESSAGES = 50;
const messages: OutboxMessage[] = [];

/**
 * Development/test stand-in for real delivery: keeps recent messages in memory and prints
 * them to the local server log so OTPs can be tested without an email or SMS account.
 * The console providers that use this are refused in production (see config/env.ts).
 */
export function deliverToDevOutbox(message: Omit<OutboxMessage, 'sentAt'>): void {
  const entry = { ...message, sentAt: new Date() };
  messages.push(entry);
  if (messages.length > MAX_MESSAGES) messages.shift();
  // End-to-end tests read OTPs from here (the setting is refused in production).
  if (env.DEV_OUTBOX_FILE) appendFileSync(env.DEV_OUTBOX_FILE, `${JSON.stringify(entry)}\n`);
  logger.warn(
    { devOutbox: { channel: message.channel, to: message.to, subject: message.subject } },
    `[DEV ${message.channel}] ${message.text}`,
  );
}

export function devOutbox(): readonly OutboxMessage[] {
  return messages;
}

export function clearDevOutbox(): void {
  messages.length = 0;
}
