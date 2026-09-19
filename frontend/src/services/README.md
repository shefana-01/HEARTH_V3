# Services — the only place the UI gets data

Pages and components never read mock data or call `fetch` directly. They call the
service objects in this folder, which return typed promises (`src/types/domain.ts`).
That makes the backend swap a change inside this folder only.

```
UI (features/*)  →  services/*Service.ts  →  mock store (today)
                                          ↘  apiRequest() → API gateway (later)
```

## How a service method is shaped

```ts
async listTasks(filter: TaskFilter = {}): Promise<CareTask[]> {
  if (!config.useMocks) return apiRequest<CareTask[]>(`/tasks${query({ assigneeId: filter.assigneeId })}`);
  // …mock implementation against the in-browser workspace…
  return respond(result);   // simulated latency + structuredClone
}
```

- `config.useMocks` comes from `VITE_USE_MOCKS` (default `true`).
- Both paths return the same domain types and throw errors with a user-readable
  `message` and a `status`, so pages cannot tell them apart.
- If the backend's payload ever differs from the domain type, map it in the service
  (see `api/mappers.ts`) — never in a component.

## The API client (`api/client.ts`)

- `apiRequest<T>(path, { method, body, anonymous })` — JSON in and out; a `FormData`
  body is sent as a file upload; `204` becomes `undefined`.
- Attaches `Authorization: Bearer <token>` unless `anonymous` (sign-in, sign-up).
- On `401` it uses the refresh token once, stores the new pair and repeats the request.
  Concurrent requests share one refresh. If that fails, the tokens are cleared and
  `AuthProvider` returns the user to sign-in.
- Error responses are RFC 7807 documents; their `detail` becomes `ApiError.message`.
- `withNulls(patch)` for PATCH bodies: the API reads `null` as "clear this field",
  and JSON would silently drop `undefined`.

## Service map

| File | Backend service | Endpoints (under `/api/v1`) |
| --- | --- | --- |
| `auth/authService.ts` | family-service | `/auth/sign-up`, `/auth/sign-in`, `/auth/session`, `/auth/sign-out`, `/auth/verify-email`, `/auth/verify-email/resend`, `/auth/password-reset`, `/auth/password-reset/confirm` (`/auth/refresh` is used by the client itself) · mock-only: startSample, deleteLocalData |
| `family/familyService.ts` | family-service | `/family`, `/members`, `/members/{id}`, `/account`, `/invites/{code}`, `/invites/{code}/accept` |
| `schedule/scheduleService.ts` | decision-, family- and task-service | `/schedule/events`, `/members/{id}/availability`, `/unavailability` |
| `tasks/taskService.ts` | task-service | `/tasks`, `/tasks/{id}`, `/tasks/{id}/complete`, `/reopen`, `/assignee` |
| `decision/decisionService.ts` | decision-service | `/decisions/attention`, `/decisions/tasks/{id}/insight`, `/decisions/tasks/{id}/acknowledge`, `/decisions/candidates/preview`, `/decisions/simulations`, `/decisions/simulations/apply`, `/reassignment-requests…` |
| `care/appointmentService.ts` | care-service | `/appointments`, `/appointments/{id}`, `/appointments/{id}/prep…` |
| `care/documentService.ts` | care-service | `/documents` (multipart upload), `/documents/{id}/access` |
| `care/nutritionService.ts` | care-service | `/nutrition/plan`, `/nutrition/food-matches`, `/groceries…` |
| `care/careGraphService.ts` | care-service (Neo4j) | `/caregraph` for the nodes and relationships, plus `/decisions/attention` to flag tasks in conflict; wording and layout are added here |
| `notifications/notificationService.ts` | notification-service | `/notifications`, `/notifications/unread-count` (polled every 30 s), `/read`, `/read-all` |
| `audit/auditService.ts` | audit-service | `/audit-events` |

Reporting time away is the one eventually-consistent operation: the API answers at
once, and the reassignment requests appear a moment later (they are created by a Kafka
consumer). `scheduleService.reportUnavailability` waits up to about 3 seconds for them.

## The decision engine (`decision/engine.ts`)

Pure functions with no I/O — conflict detection, the Candidate Suitability Score,
the Task Priority Score and what-if simulation. The weights are exported
(`SUITABILITY_WEIGHTS`, `PRIORITY_WEIGHTS`) and shown in the UI next to each score.

With the backend, decision-service owns these calculations
(`DecisionEngine.java`, a line-by-line port). `engine.ts` remains the **reference
implementation**: it powers the offline demo, and the backend's `DecisionEngineTest`
replays random families through both and requires identical output. If you change a
rule or a weight, change both and regenerate the expected output (backend README).

## How the offline demo differs from the backend

- **One account per browser.** Passwords are checked for strength in the UI but not
  stored or verified. (The backend stores BCrypt hashes and issues signed tokens.)
- **Invitations** only resolve on the same device. (With the backend, the invited
  person signs up with the invited email and enters the family code.)
- **Document upload** records the file's details only. (The backend stores the file.)
- **Notifications** are one shared list. (The backend keeps read state per member and
  does not notify people about their own actions.)
- **Sample data** (`src/mocks/sampleWorkspace.ts`) is an optional demo, regenerated
  daily so its times stay current. It exists only in the demo.
