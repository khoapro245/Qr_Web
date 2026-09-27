import { env, type Env } from '../../config/env.js';
import { deliverToDevOutbox } from '../dev-outbox.js';

export interface SmsProvider {
  readonly enabled: boolean;
  /** `to` is an E.164 number such as +84912345678. */
  send(to: string, text: string): Promise<void>;
}

class ConsoleSmsProvider implements SmsProvider {
  readonly enabled = true;
  send(to: string, text: string): Promise<void> {
    deliverToDevOutbox({ channel: 'SMS', to, text });
    return Promise.resolve();
  }
}

class DisabledSmsProvider implements SmsProvider {
  readonly enabled = false;
  send(): Promise<void> {
    return Promise.reject(new Error('SMS delivery is disabled'));
  }
}

// A production gateway (e.g. a Vietnamese brandname SMS provider) is added here as another
// SmsProvider once it has been chosen.
export function createSmsProvider(config: Pick<Env, 'SMS_PROVIDER'>): SmsProvider {
  switch (config.SMS_PROVIDER) {
    case 'console':
      return new ConsoleSmsProvider();
    case 'disabled':
      return new DisabledSmsProvider();
  }
}

export const smsProvider = createSmsProvider(env);
