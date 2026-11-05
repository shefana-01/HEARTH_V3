import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/app/AuthProvider';
import { FamilyProvider } from '@/app/FamilyProvider';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui';
import { startDisplayPrefs } from '@/lib/prefs';
import { startServiceWorker } from '@/services/pwa/serviceWorker';
import { UpdatePrompt } from '@/components/layout/UpdatePrompt';
import { I18nProvider } from '@/i18n';
import '@/styles/index.css';

startDisplayPrefs();
startServiceWorker();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <AuthProvider>
        <FamilyProvider>
          <ToastProvider>
            <RouterProvider router={router} />
            <UpdatePrompt />
          </ToastProvider>
        </FamilyProvider>
      </AuthProvider>
    </I18nProvider>
  </StrictMode>,
);
