export const customerKeys = {
  all: ['admin'] as const,
  list: (params: object) => ['admin', 'customers', params] as const,
  lists: ['admin', 'customers'] as const,
  detail: (id: string) => ['admin', 'customer', id] as const,
  qr: (id: string) => ['admin', 'customer', id, 'qr'] as const,
  dashboard: ['admin', 'dashboard'] as const,
  ownProfile: ['me', 'profile'] as const,
};
