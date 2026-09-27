import { createServer, type Server, type Socket } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app.js';
import { pool } from '../src/db/client.js';
import { clearDevOutbox, devOutbox } from '../src/providers/dev-outbox.js';
import {
  createEmailProvider,
  emailProvider,
  type EmailConfig,
} from '../src/providers/email/index.js';
import { createSmsProvider, smsProvider } from '../src/providers/sms/index.js';
import { createClient, createCustomer } from './helpers/auth.js';
import { resetDatabase } from './helpers/db.js';
import request from 'supertest';

/**
 * A minimal SMTP server that accepts one message and records what it received — enough to
 * prove the SMTP provider speaks real SMTP without needing an external mail service.
 */
function startFakeSmtp(): Promise<{ server: Server; port: number; received: Promise<string> }> {
  return new Promise((resolve) => {
    let deliver: (data: string) => void;
    const received = new Promise<string>((r) => (deliver = r));
    const server = createServer((socket: Socket) => {
      let inData = false;
      let data = '';
      socket.write('220 fake-smtp ready\r\n');
      socket.on('data', (chunk) => {
        const text = chunk.toString('utf8');
        if (inData) {
          data += text;
          if (data.includes('\r\n.\r\n')) {
            inData = false;
            socket.write('250 queued\r\n');
            deliver(data);
          }
          return;
        }
        for (const line of text.split('\r\n').filter(Boolean)) {
          if (/^(EHLO|HELO)/i.test(line)) socket.write('250 fake-smtp\r\n');
          else if (/^DATA/i.test(line)) {
            inData = true;
            socket.write('354 go ahead\r\n');
          } else if (/^QUIT/i.test(line)) socket.end('221 bye\r\n');
          else socket.write('250 ok\r\n');
        }
      });
    });
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, port, received });
    });
  });
}

const baseEmailConfig: EmailConfig = {
  EMAIL_PROVIDER: 'smtp',
  EMAIL_FROM: 'QR Care <no-reply@qrcare.test>',
  SMTP_HOST: '127.0.0.1',
  SMTP_PORT: 25,
  SMTP_SECURE: false,
  SMTP_USER: undefined,
  SMTP_PASS: undefined,
};

describe('email providers', () => {
  it('delivers through a real SMTP conversation', async () => {
    const smtp = await startFakeSmtp();
    try {
      const provider = createEmailProvider({ ...baseEmailConfig, SMTP_PORT: smtp.port });
      expect(provider.enabled).toBe(true);
      await provider.send({
        to: 'lan@example.com',
        subject: 'Mã khôi phục mật khẩu QR Care',
        text: 'Mã xác nhận của bạn là 123456.',
      });
      const message = await smtp.received;
      expect(message).toContain('To: lan@example.com');
      expect(message).toContain('From: QR Care <no-reply@qrcare.test>');
      expect(message).toMatch(/Subject: =\?UTF-8\?/); // Vietnamese subject is MIME-encoded
    } finally {
      smtp.server.close();
    }
  });

  it('reports failure when the SMTP server is unreachable', async () => {
    const provider = createEmailProvider({ ...baseEmailConfig, SMTP_PORT: 1 });
    await expect(provider.send({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toThrow();
  });

  it('console provider writes to the dev outbox; disabled provider refuses', async () => {
    clearDevOutbox();
    await createEmailProvider({ ...baseEmailConfig, EMAIL_PROVIDER: 'console' }).send({
      to: 'a@example.com',
      subject: 's',
      text: 'hello',
    });
    expect(devOutbox()).toHaveLength(1);

    const disabled = createEmailProvider({ ...baseEmailConfig, EMAIL_PROVIDER: 'disabled' });
    expect(disabled.enabled).toBe(false);
    await expect(disabled.send({ to: 'a@example.com', subject: 's', text: 't' })).rejects.toThrow();
  });
});

describe('sms providers', () => {
  it('console provider writes to the dev outbox; disabled provider refuses', async () => {
    clearDevOutbox();
    await createSmsProvider({ SMS_PROVIDER: 'console' }).send('+84912345678', 'hi');
    expect(devOutbox()[0]).toMatchObject({ channel: 'SMS', to: '+84912345678' });

    const disabled = createSmsProvider({ SMS_PROVIDER: 'disabled' });
    expect(disabled.enabled).toBe(false);
    await expect(disabled.send('+84912345678', 'hi')).rejects.toThrow();
  });
});

describe('recovery when a channel is switched off', () => {
  const app = createApp();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['EMAIL', 'lan@example.com', 'EMAIL_UNAVAILABLE'],
    ['SMS', '0912345678', 'SMS_UNAVAILABLE'],
  ] as const)(
    'answers 503 for %s, the same for every account',
    async (channel, identifier, code) => {
      await resetDatabase();
      await createCustomer({ email: 'lan@example.com', phone: '+84912345678' });
      const provider = channel === 'EMAIL' ? emailProvider : smsProvider;
      Object.defineProperty(provider, 'enabled', { value: false, configurable: true });
      try {
        const client = await createClient(app);
        for (const who of [identifier, channel === 'EMAIL' ? 'nobody@example.com' : '0987654321']) {
          const res = await client.post('/api/auth/forgot-password', { identifier: who });
          expect(res.status).toBe(503);
          expect(res.body.code).toBe(code);
        }
      } finally {
        Object.defineProperty(provider, 'enabled', { value: true, configurable: true });
      }
    },
  );
});

describe('health check', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports 503 when the database is unreachable', async () => {
    vi.spyOn(pool, 'query').mockRejectedValueOnce(new Error('connection refused'));
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      success: false,
      data: { status: 'degraded', database: 'down' },
    });
  });
});
