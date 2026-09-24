import { useEffect } from 'react';

const APP_NAME = 'Hearth';

/** Set a descriptive tab title for the current page. */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} — your day and your family, in one place`;
  }, [title]);
}
