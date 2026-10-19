import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from '@/app/AuthProvider';
import { FamilyProvider } from '@/app/FamilyProvider';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/ui';
import { applyDisplayPrefs } from '@/lib/prefs';
import '@/styles/index.css';

applyDisplayPrefs();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <FamilyProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </FamilyProvider>
    </AuthProvider>
  </StrictMode>,
);
