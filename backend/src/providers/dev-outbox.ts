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
  messages.push({ ...message, sentAt: new Date() });
  if (messages.length > MAX_MESSAGES) messages.shift();
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
