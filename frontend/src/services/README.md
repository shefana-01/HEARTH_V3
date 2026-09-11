# Services — the only place the UI gets data

Pages and components never read mock data or call `fetch` directly. They call the
service objects in this folder, which return typed promises (`src/types/domain.ts`).
That makes the backend swap a change inside this folder only.

```
UI (features/*)  →  services/*Service.ts  →  mock store (today)
                                          ↘  apiRequest() → API gateway (later)
```

## How a service method is shaped today

```ts
async listTasks(filter: TaskFilter = {}): Promise<CareTask[]> {
  if (!config.useMocks) return backendNotConnected('task-service', 'listTasks');
  // …mock implementation against the in-browser workspace…
  return respond(result);   // simulated latency + structuredClone
}
```

- `config.useMocks` comes from `VITE_USE_MOCKS` (default `true`).
- With mocks off, every method throws `ApiError(501)` naming the service and
  operation, so an unconnected screen shows a clear error state instead of fake data.
- Errors from mocks use the same `ApiError`/`ServiceError` shape the UI already
  handles (`message` shown to the user, `status` for logic).

## Connecting an endpoint

1. Agree the REST contract with the backend team. None are defined yet, so no
   URLs are guessed here.
2. Replace the `backendNotConnected(...)` line with the real call:
   ```ts
   if (!config.useMocks) return apiRequest<CareTask[]>(`/tasks?assigneeId=${filter.assigneeId ?? ''}`);
   ```
3. If the backend's payload differs from the domain type, map it in the service —
   never in a component.
4. Set `VITE_API_BASE_URL` and `VITE_USE_MOCKS=false` in `.env.local`.

`api/client.ts` → `apiRequest()` already handles the base URL, JSON, a bearer token
from the saved session, and non-2xx responses (`ApiError` with status and body).

## Service map

| File | Target backend service | Operations |
| --- | --- | --- |
| `auth/authService.ts` | family-service / identity provider (OIDC) | getSession, signIn, signUp, signOut, requestPasswordReset · mock-only: startSample, deleteLocalData |
| `family/familyService.ts` | family-service | getFamily, createFamily, updateFamily, listMembers, getMember, inviteMember, updateMember, removeMember, getAccount, updateAccount, lookupInvite |
| `schedule/scheduleService.ts` | task-service + family-service | getWeek, getAvailability, saveAvailability, listUnavailability, reportUnavailability, removeUnavailability |
| `tasks/taskService.ts` | task-service | listTasks, getTask, createTask, updateTask, completeTask, reopenTask, cancelTask, assignTask |
| `decision/decisionService.ts` | decision-service | listAttention, getTaskInsight, previewCandidates, requestReassignment, listRequests, getRequest, approveRequest, cancelRequest, acknowledgeConflict, simulate, applySimulation |
| `care/appointmentService.ts` | care-service | list, get, create, update, remove, togglePrep, addPrep, removePrep |
| `care/documentService.ts` | care-service + file storage | list, upload, updateAccess, remove |
| `care/nutritionService.ts` | care-service | getPlan, savePlan, getFoodMatches, listGroceries, addFoodToList, addCustomItem, updateGroceryItem, removeGroceryItem, createGroceryTask |
| `care/careGraphService.ts` | care-service (graph store) | getGraph |
| `notifications/notificationService.ts` | notification-service (+ push channel) | list, markRead, markAllRead, dismiss, subscribe (unread count) |
| `audit/auditService.ts` | audit read model across services | list |

## The decision engine (`decision/engine.ts`)

Pure functions with no I/O — conflict detection, the Candidate Suitability Score,
the Task Priority Score and what-if simulation. The weights are exported
(`SUITABILITY_WEIGHTS`, `PRIORITY_WEIGHTS`) and shown in the UI next to each score.

When decision-service exists it should own these calculations. Two options:

- **Server-side (recommended):** the service returns scores and explanations; keep
  `engine.ts` only for instant previews (e.g. the "who is free?" hint while typing a
  new task), or delete it.
- **Shared:** keep the engine on both sides, but treat the server result as the
  source of truth when they differ.

## Things that are mock-only on purpose

- **One account per browser.** Passwords are checked for strength in the UI but not
  stored or verified — real credentials belong to the identity provider.
- **Invitations** are recorded but no email is sent; codes only resolve on the same device.
- **Document upload** stores metadata only (title, type, size, access); the file itself
  is not kept until file storage exists. The UI says so.
- **Sample data** (`src/mocks/sampleWorkspace.ts`) is an optional demo, regenerated
  daily so its times stay current. It is never mixed with a real account's data.
