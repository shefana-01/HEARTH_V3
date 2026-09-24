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
async listTasks(filter: TaskFilter = {}): Promise<Task[]> {
  if (!config.useMocks) return apiRequest<Task[]>(`/tasks${query({ assigneeId: filter.assigneeId })}`);
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
| `family/familyService.ts` | family-service | `/family`, `/family/dependants`, `/members`, `/members/{id}`, `/members/{id}/status`, `/account`, `/invites/{code}`, `/invites/{code}/accept` |
| `tasks/taskService.ts` | task-service | `/tasks`, `/tasks/{id}`, `/tasks/{id}/complete`, `/reopen`, `/assignee` |
| `schedule/eventService.ts` | task-service | `/events`, `/events/{id}` (personal events) |
| `schedule/scheduleService.ts` | decision-, family- and task-service | `/schedule/events`, `/members/{id}/availability`, `/unavailability` |
| `decision/decisionService.ts` | decision-service | `/decisions/my-day`, `/decisions/attention`, `/decisions/tasks/{id}/insight`, `/decisions/tasks/{id}/acknowledge`, `/decisions/candidates/preview`, `/decisions/simulations`, `/decisions/simulations/apply`, `/reassignment-requests…` |
| `care/appointmentService.ts` | care-service | `/appointments`, `/appointments/{id}`, `/appointments/{id}/prep…` |
| `care/healthService.ts` | care-service | `/health/profiles`, `/health/profiles/{personId}`, `/health/suggestions` |
| `care/groceryService.ts` | care-service | `/groceries`, `/groceries/from-food`, `/groceries/{id}`, `/groceries/task` |
| `care/documentService.ts` | care-service | `/documents` (multipart upload), `/documents/{id}/access` |
| `care/careGraphService.ts` | care-service (Neo4j) | `/caregraph` for the nodes and relationships, plus `/decisions/attention` to flag tasks with a clash; wording and layout are added here |
| `chat/chatService.ts` | notification-service | `/messages`, `/messages/read`, `/messages/unread-count`, `/messages/task-counts` (polled) |
| `notifications/notificationService.ts` | notification-service | `/notifications`, `/notifications/unread-count` (polled every 30 s), `/read`, `/read-all` |
| `notifications/reminderService.ts` | – | mock only: raises due reminders while the app is open. With the API, task- and care-service raise them on a timer and they arrive as notifications |
| `audit/auditService.ts` | audit-service | `/audit-events` |

Reporting time away is the one eventually-consistent operation: the API answers at
once, and the handover requests appear a moment later (they are created by a Kafka
consumer). `scheduleService.reportUnavailability` waits up to about 3 seconds for them.

## Who may see what (`mockStore.ts`)

The mock applies the same privacy rules the backend enforces, in three small helpers:

- `canSeeTask` — shared tasks, plus private ones where you are the assignee or wrote them.
- `canSeeAppointment` — shared ones, plus private ones you attend, go along to or created.
- `canSeeHealth` — your own notes; with "medical" access also those of people the family
  looks after and of members who chose to share.

A private task, appointment or "show as busy" event still makes its owner busy for the
decision engine and appears in other people's week view as a plain "Busy" block.
Private things write nothing to the activity log, notifications or the family chat.

## The decision engine (`decision/engine.ts`)

Pure functions with no I/O — clash detection, the Candidate Suitability Score, the Task
Priority Score, the "my day" ranking with its tie-breakers, and what-if simulation. The
weights are exported (`SUITABILITY_WEIGHTS`, `PRIORITY_WEIGHTS`) and shown in the UI next to
each score. Personal events are expanded into concrete busy blocks by `lib/recurrence.ts`
before the engine runs (`mockStore.engineData()`).

With the backend, decision-service owns these calculations (`DecisionEngine.java` and
`Recurrence.java`, line-by-line ports). `engine.ts` remains the **reference
implementation**: it powers the offline demo, and the backend's `DecisionEngineTest`
replays random families through both and requires identical output. If you change a
rule or a weight, change both and regenerate the expected output (backend README).

## How the offline demo differs from the backend

- **One account per browser.** Passwords are checked for strength in the UI but not
  stored or verified. (The backend stores BCrypt hashes and issues signed tokens.)
- **Invitations** only resolve on the same device. (With the backend, the invited
  person signs up with the invited email and enters the family code.)
- **Chat** has nobody to answer, since only one person is signed in. The sample family
  comes with a conversation.
- **Reminders** are raised by the open tab. (The backend raises them on a timer.)
- **Document upload** records the file's details only. (The backend stores the file.)
- **Notifications:** you also see family-wide notifications about your own actions. (The
  backend does not notify people about what they did themselves.)
