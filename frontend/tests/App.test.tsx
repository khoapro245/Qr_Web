import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the API as healthy when /api/health responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
    render(<App />);
    expect(screen.getByRole('heading', { name: 'QR Care' })).toBeInTheDocument();
    expect(await screen.findByText('Hoạt động')).toBeInTheDocument();
  });

  it('shows an error state when the API is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<App />);
    expect(await screen.findByText('Không kết nối được')).toBeInTheDocument();
  });
});
