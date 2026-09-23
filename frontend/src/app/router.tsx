import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { PageSkeleton } from '@/components/ui';
import { RedirectIfAuthed, RequireAuth, RequireFamily } from './guards';
import { RouteError } from './RouteError';
import { detail } from './routeMeta';

/** Code-split each page and show a skeleton while its chunk loads. */
function page(factory: () => Promise<{ default: ComponentType }>) {
  const Page: LazyExoticComponent<ComponentType> = lazy(factory);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Page />
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      // Public
      { path: '/', element: page(() => import('@/features/marketing/PromoPage')) },
      { path: '/welcome', element: page(() => import('@/features/marketing/LandingPage')) },
      { path: '/sign-in', element: <RedirectIfAuthed>{page(() => import('@/features/auth/SignInPage'))}</RedirectIfAuthed> },
      { path: '/sign-up', element: <RedirectIfAuthed>{page(() => import('@/features/auth/SignUpPage'))}</RedirectIfAuthed> },
      { path: '/verify-email', element: page(() => import('@/features/auth/VerifyEmailPage')) },
      { path: '/reset-password', element: page(() => import('@/features/auth/ResetPasswordPage')) },
      { path: '/join/:code?', element: page(() => import('@/features/onboarding/JoinFamilyPage')) },
      { path: '/onboarding', element: <RequireAuth>{page(() => import('@/features/onboarding/OnboardingPage'))}</RequireAuth> },

      // Signed-in app
      {
        element: (
          <RequireAuth>
            <RequireFamily>
              <AppShell />
            </RequireFamily>
          </RequireAuth>
        ),
        children: [
          // Me
          { path: '/today', element: page(() => import('@/features/today/MyDayPage')) },
          { path: '/dashboard', element: <Navigate to="/today" replace /> },

          { path: '/tasks', element: page(() => import('@/features/tasks/TasksPage')) },
          { path: '/tasks/new', ...detail('New task', '/tasks'), element: page(() => import('@/features/tasks/TaskFormPage')) },
          { path: '/tasks/:taskId', ...detail('Task', '/tasks'), element: page(() => import('@/features/tasks/TaskDetailPage')) },
          { path: '/tasks/:taskId/edit', ...detail('Edit task', (p) => `/tasks/${p.taskId}`), element: page(() => import('@/features/tasks/TaskFormPage')) },
          { path: '/tasks/:taskId/resolve', ...detail('Sort out a clash', (p) => `/tasks/${p.taskId}`), element: page(() => import('@/features/tasks/ConflictPage')) },

          { path: '/schedule', element: page(() => import('@/features/schedule/SchedulePage')) },
          { path: '/schedule/events/new', ...detail('Add to my schedule', '/schedule'), element: page(() => import('@/features/schedule/EventFormPage')) },
          { path: '/schedule/events/:eventId', ...detail('Edit event', '/schedule'), element: page(() => import('@/features/schedule/EventFormPage')) },
          { path: '/schedule/availability', ...detail('When I’m free', '/schedule'), element: page(() => import('@/features/schedule/AvailabilityPage')) },
          { path: '/schedule/unavailable', ...detail('I can’t make it', '/schedule'), element: page(() => import('@/features/schedule/ReportUnavailabilityPage')) },

          { path: '/health', element: page(() => import('@/features/health/HealthPage')) },
          { path: '/health/suggestions', ...detail('Food suggestions', '/health'), element: page(() => import('@/features/health/FoodSuggestionsPage')) },
          { path: '/health/:personId', ...detail('Health notes', '/health'), element: page(() => import('@/features/health/HealthProfilePage')) },
          { path: '/nutrition/*', element: <Navigate to="/health" replace /> },

          // Family
          { path: '/family', element: page(() => import('@/features/family/FamilyPage')) },
          { path: '/family/:memberId', ...detail('Member', '/family'), element: page(() => import('@/features/family/MemberPage')) },

          { path: '/chat', element: page(() => import('@/features/chat/ChatPage')) },

          { path: '/priority', element: page(() => import('@/features/priority/PriorityCenterPage')) },
          { path: '/priority/requests/:requestId', ...detail('Who can take it?', '/priority'), element: page(() => import('@/features/priority/RecommendationsPage')) },
          {
            path: '/priority/requests/:requestId/candidates/:memberId',
            ...detail('Candidate', (p) => `/priority/requests/${p.requestId}`),
            element: page(() => import('@/features/priority/CandidatePage')),
          },
          {
            path: '/priority/requests/:requestId/approve/:memberId',
            ...detail('Confirm handover', (p) => `/priority/requests/${p.requestId}/candidates/${p.memberId}`),
            element: page(() => import('@/features/priority/ApprovalPage')),
          },
          { path: '/priority/requests/:requestId/done', ...detail('Handed over', '/priority'), element: page(() => import('@/features/priority/SuccessPage')) },

          { path: '/groceries', element: page(() => import('@/features/health/ShoppingListPage')) },

          { path: '/appointments', element: page(() => import('@/features/appointments/AppointmentsPage')) },
          { path: '/appointments/new', ...detail('New appointment', '/appointments'), element: page(() => import('@/features/appointments/AppointmentFormPage')) },
          { path: '/appointments/:appointmentId', ...detail('Appointment', '/appointments'), element: page(() => import('@/features/appointments/AppointmentDetailPage')) },
          {
            path: '/appointments/:appointmentId/edit',
            ...detail('Edit appointment', (p) => `/appointments/${p.appointmentId}`),
            element: page(() => import('@/features/appointments/AppointmentFormPage')),
          },

          { path: '/documents', element: page(() => import('@/features/documents/DocumentsPage')) },

          // More
          { path: '/what-if', element: page(() => import('@/features/whatif/SimulatorPage')) },
          { path: '/what-if/impact', ...detail('Impact', (_p, search) => `/what-if${search}`), element: page(() => import('@/features/whatif/ImpactPage')) },

          { path: '/caregraph', element: page(() => import('@/features/caregraph/CareGraphPage')) },
          { path: '/caregraph/:nodeId', ...detail('Family map', '/caregraph'), element: page(() => import('@/features/caregraph/EntityPage')) },

          { path: '/notifications', element: page(() => import('@/features/notifications/NotificationsPage')) },
          { path: '/activity', element: page(() => import('@/features/activity/ActivityPage')) },
          { path: '/settings', element: page(() => import('@/features/settings/SettingsPage')) },
          { path: '/settings/*', element: <Navigate to="/settings" replace /> },
        ],
      },

      { path: '*', element: page(() => import('./NotFoundPage')) },
    ],
  },
]);
