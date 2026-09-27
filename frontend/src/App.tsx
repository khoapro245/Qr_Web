import { useEffect, useState } from 'react';

type ApiStatus = 'checking' | 'ok' | 'down';

// Temporary landing page for Milestone 1: proves the SPA, Tailwind and the /api proxy work.
// Replaced by the router in Milestone 3.
export function App() {
  const [status, setStatus] = useState<ApiStatus>('checking');

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/health', { signal: controller.signal })
      .then((res) => setStatus(res.ok ? 'ok' : 'down'))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setStatus('down');
      });
    return () => controller.abort();
  }, []);

  const label = { checking: 'Đang kiểm tra…', ok: 'Hoạt động', down: 'Không kết nối được' }[status];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-4 text-slate-900">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <h1 className="text-2xl font-semibold text-teal-700">QR Care</h1>
        <p className="mt-2 text-sm text-slate-600">
          API: <span role="status">{label}</span>
        </p>
      </div>
    </main>
  );
}
