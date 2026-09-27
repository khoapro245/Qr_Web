import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './msw/server';

// jsdom does not implement matchMedia (used by the theme provider).
vi.stubGlobal(
  'matchMedia',
  vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

beforeEach(() => {
  // The API sets this cookie in real use; MSW responses cannot set cookies in jsdom.
  document.cookie = 'qrc_csrf=test-csrf; path=/';
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => server.close());
