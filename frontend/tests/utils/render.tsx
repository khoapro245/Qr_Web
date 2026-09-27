import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { AppProviders } from '../../src/app/AppProviders';
import { createQueryClient } from '../../src/app/query-client';
import { routes } from '../../src/app/routes';

interface RenderOptions {
  /** false lets a test pick files the input's `accept` would filter out (a crafted upload). */
  applyAccept?: boolean;
}

/** Renders the whole app (real routes, guards and providers) at the given path. */
export function renderApp(path: string, options: RenderOptions = {}) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createQueryClient();
  const user = userEvent.setup({ applyAccept: options.applyAccept ?? true });
  render(
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>,
  );
  return { router, user };
}
