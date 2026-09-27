import { useEffect } from 'react';

/** Sets the document title so screen-reader users and tabs know which page is open. */
export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · QR Care`;
  }, [title]);
}
