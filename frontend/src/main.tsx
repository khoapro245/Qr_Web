import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AppProviders } from './app/AppProviders';
import { createQueryClient } from './app/query-client';
import { routes } from './app/routes';
import { initMedicalContentSync } from './features/medical-content/medical-content.storage';
import './styles/index.css';

void initMedicalContentSync();

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

const router = createBrowserRouter(routes);
const queryClient = createQueryClient();

createRoot(root).render(
  <StrictMode>
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
);
