import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './msw/server';

// Tests render the whole app with lazily-loaded routes; under a busy machine the first load
// of a route can exceed the default 1s wait.
configure({ asyncUtilTimeout: 3000 });

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

// jsdom lacks HTMLDialogElement.showModal/close.
HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
  this.open = true;
};
HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
  this.open = false;
};

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
