import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';

/**
 * Single-page apps change content without a page load, so screen readers do not notice a
 * navigation. This live region announces the new page title after each route change.
 */
function RouteAnnouncer() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState('');
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    // Give the new page (possibly lazily loaded) time to set its title.
    const timer = setTimeout(() => {
      setMessage(`Đã chuyển tới trang ${document.title.replace(/ · QR Care$/, '')}`);
    }, 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
}

export function RootLayout() {
  return (
    <>
      <RouteAnnouncer />
      <Outlet />
    </>
  );
}
