# Hearth — your day and your family, in one place (web frontend)

Hearth is a personal organiser that extends into the family. Each person keeps their own
schedule (classes, work) and tasks, some of them private, and shares the rest with their family:
tasks that can be handed over when someone can’t make it, a family chat, a shopping list fed by
health notes, appointments and documents. A decision engine says what to do first and who is
free to step in.

This is the React frontend. It runs on its own with an in-browser mock backend (the default), or
against the Hearth backend (`backend/`): every data call goes through a service layer that does
one or the other.

**Anyone can use it.** A new account starts empty and sets up its own family space in
onboarding, alone or with others. The Mannan family is only an optional demo ("Explore with a
sample family").

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

Node 18.18+ (tested on Node 22).

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Type-check, then production build to `dist/` |
| `npm run preview` | Serve the production build (http://localhost:4173) |
| `npm run typecheck` | TypeScript only |
| `npm run lint` | ESLint (TypeScript, React Hooks, jsx-a11y) |
| `npm run format` / `format:check` | Prettier (config in `.prettierrc.json`) |
| `npm run check` | typecheck + lint + format check + build — run before every merge |

### Environment

Copy `.env.example` to `.env.local`:

| Variable | Default | Meaning |
| --- | --- | --- |
| `VITE_USE_MOCKS` | `true` | `true`: offline demo, data in this browser. `false`: use the Hearth backend. |
| `VITE_API_BASE_URL` | *(empty)* | API gateway base URL, e.g. `http://localhost:8080/api/v1`. |
| `VITE_MOCK_LATENCY_MS` | `350` | Simulated network delay, so loading states are visible. |
| `VITE_CURRENCY` | `BDT` | Currency code for shopping-list prices and the weekly budget. |

## Stack

React 18 · TypeScript (strict) · Vite 5 · Tailwind CSS 3 · React Router 6 (data
router, lazy routes) · lucide-react icons · self-hosted variable fonts (Plus Jakarta
Sans, Newsreader). No state-management or UI-kit library is needed at this size.

## Project structure

```
src/
  app/            Providers (Auth, Family), route guards, router, 404, route error
  components/
    ui/           Design-system primitives (Button, FormField, Dialog, Tabs, Toast…)
    layout/       AppShell (sidebar, top bar, bottom tabs), public header/footer, logo
    domain/       Shared domain widgets (TaskRow, score pills, PersonSelect, VisibilityField)
  constants/      Labels and icons for categories, roles, skills; the health-note list; navigation
  features/       One folder per area; each page is a lazily loaded route
    today/ tasks/ schedule/ health/            ← "Me"
    family/ chat/ priority/ appointments/ documents/   ← "Family"
    whatif/ caregraph/ notifications/ activity/ settings/
    marketing/ auth/ onboarding/
  hooks/          useAsync / useMutation, useDocumentTitle, useReminders
  lib/            Pure helpers: dates, recurrence (weekly events), formatting, display
                  preferences, validation, storage, downloads, .ics
  mocks/          Sample family + reference food list (only services import these)
  services/       The data layer — see src/services/README.md
  styles/         Global CSS (fonts, text-size and contrast settings, focus ring, reduced motion)
  types/          Domain model (the frontend's contract with the backend)
tools/verify/     Playwright checks: route crawl, new-account crawl, end-to-end flows
```

## How the product is organised

| Idea | Where it lives |
| --- | --- |
| **My own schedule.** Classes, work shifts and anything else as personal events, once or weekly. Family sees them, or only "Busy". | `/schedule`, `features/schedule/EventFormPage`, `services/schedule/eventService`, `lib/recurrence` |
| **My tasks, shared or private.** A private task is visible only to its owner; others see that time as busy. | `Task.visibility`, `components/domain/People` (`VisibilityField`), privacy helpers in `services/mockStore` |
| **What should I do first?** Open tasks in order: due within two hours, later today, can wait; inside each group by Priority Score, with stated tie-breakers. | `/today`, `engine.rankTasks`, `decisionService.getMyDay` |
| **I can’t make it → hand over.** Report time away; shared tasks in that time get a handover request and candidates ranked by who is free. | `/schedule/unavailable`, `/priority/…`, `engine.scoreCandidates` |
| **People we look after.** A child or grandparent who does not use the app: tasks, appointments, documents and health notes can be about them. Optional. | `Family.dependants`, `/family` |
| **Family chat, status lines, task comments.** | `/chat`, `services/chat/chatService`, `familyService.setStatus` |
| **Health notes → food suggestions → shopping list.** A person ticks what a doctor has told them from a fixed list; matching everyday foods can be added to the family list. Notes are private unless shared. Nothing is diagnosed and no document is read. | `/health`, `/groceries`, `constants/conditions`, `services/care/healthService` |
| **Documents** about a person or the household, for the family, chosen people or only me. | `/documents` |
| **Reminders** 15 minutes before a task, an hour before an appointment. | `hooks/useReminders` (demo), server timers (backend) |
| **For every age.** Text size and stronger contrast in Settings; every size in the app is in rem so it all scales. | `lib/prefs`, `styles/index.css` |

## Architecture

- **Layers:** `features` (pages) → `services` (typed async API) → the mock store or
  the API gateway, chosen by `VITE_USE_MOCKS`. Pages never touch mock data or `fetch`.
- **Routing:** real URLs for every screen, lazy-loaded per page, with browser
  back/forward, deep links and refresh all working. Guards:
  - `RequireAuth` sends signed-out visitors to `/sign-in?next=…` and returns them
    afterwards. `next` only accepts in-app paths.
  - `RequireFamily` sends accounts without a family space to onboarding.
  - `RedirectIfAuthed` keeps signed-in users off the sign-in and sign-up pages.
- **State:** `AuthProvider` holds the session. `FamilyProvider` holds the family, its
  members and the people it looks after, so any page can resolve names without
  refetching. Everything else is page state loaded through `useAsync` (loading, error
  and data, stale-response safe, `reload()` keeps data visible) and changed through
  `useMutation` (pending and error; `attempt()` for operations with no return value).
- **Privacy** is applied in the service layer (and on the server with the backend):
  private tasks and appointments are only returned to the people involved, a "show as
  busy" event loses its title for everyone else, and health notes are returned to others
  only when shared. Private things never reach the activity log, notifications or chat.
- **Decision engine** (`services/decision/engine.ts`): pure, deterministic functions.
  Nothing is scripted per scenario.
  - *Clashes:* nobody has the task, the person said they are away, it overlaps another
    commitment (a task, an appointment or a personal event), or it is outside the hours
    they said they are free.
  - *Candidate Suitability Score:* `w1·Availability + w2·WorkloadCapacity +
    w3·SkillEligibility − w4·ConflictCost`, with weights 0.35 / 0.20 / 0.25 / 0.30,
    normalised to 0–100. Classes and work make someone busy but do not count as workload.
  - *Task Priority Score:* `P = wD·D + wC·C + wI·I + wR·R + wS·S`, with weights
    0.25 / 0.25 / 0.15 / 0.15 / 0.20, each with a plain-language explanation.
  - *My day:* time first (now / later today / can wait), then the Priority Score, then
    the tie-breakers in order — due sooner, more depends on it, harder to hand over,
    matters more, quicker — and the sentence that says which one decided.
  - *What-if:* before/after comparison for moving a task or giving it to someone else.

  Every score in the UI shows its factor breakdown.

## Design system

Tokens live in `tailwind.config.ts`. The pastel palette comes from the landing page:

| Token | Use |
| --- | --- |
| `primary` (powder blue, 50–900; buttons use 600 `#3C739C`) | Actions, links, focus, selected states |
| `rose` (50–700) | People accents, warm highlights |
| `mint` (50–800) | Success, availability, health and food |
| `amber`, `red` | Warnings and errors only |
| `canvas`, `surface.*`, `line.*`, `ink.*` | Page background, cards, borders, text (AA contrast). `line` and `ink` are CSS variables so the "stronger contrast" setting can darken them. |

Fonts are Plus Jakarta Sans (UI) and Newsreader (display, via `.font-display`), both
self-hosted. There is one shared focus ring, and motion respects
`prefers-reduced-motion`. Primitives are in `src/components/ui` and exported from
`@/components/ui`.

## Mobile (phones & tablets)

One codebase serves desktop and mobile; below `lg` (1024 px) the shell switches to mobile patterns:

- **Bottom tab bar** on top-level screens — My day · Tasks · Schedule · Family · More. "More" opens a bottom sheet (native `<dialog>`, so focus is trapped and Escape closes it) with every other section.
- **App bar on detail screens** — back button and title instead of the logo; the tab bar is hidden. Each detail route declares its title and logical parent in `src/app/routeMeta.ts`, so Back works from deep links and notifications too.
- **Pinned action bar** (`<ActionBar>`) — primary actions sit at the bottom of the screen within thumb reach on forms and confirmation screens. It renders inline on desktop and reports its height so content is never hidden behind it.
- **Collapsible sections** (`<CollapsibleCard>`) for secondary detail such as the priority breakdown.
- **Schedule** becomes a day strip plus a vertical timeline; **What-if** gets Current / Proposed / Impact tabs; the **chat** composer stays above the tab bar.
- Toasts appear at the top on small screens so they never cover bottom controls; safe-area insets are respected (`viewport-fit=cover`).

## Screens → routes

| Area | Screen | Route |
| --- | --- | --- |
| Public | Home · Welcome | `/` · `/welcome` |
| | Sign in · Sign up · Email links | `/sign-in` · `/sign-up` · `/verify-email` · `/reset-password` |
| | Set up a family space · Join one | `/onboarding` · `/join/:code?` |
| Me | My day | `/today` |
| | Tasks · New / edit · Detail (with comments) · Sort out a clash | `/tasks` · `/tasks/new` (`/tasks/:id/edit`) · `/tasks/:id` · `/tasks/:id/resolve` |
| | Schedule · Add / edit a personal event | `/schedule` · `/schedule/events/new` · `/schedule/events/:id` |
| | When I’m free · I can’t make it | `/schedule/availability` · `/schedule/unavailable` |
| | Health & food · One person’s notes · Food suggestions | `/health` · `/health/:personId` · `/health/suggestions` |
| Family | Family hub · Member profile | `/family` · `/family/:memberId` |
| | Family chat | `/chat` |
| | Handovers · Who can take it? · Candidate · Confirm · Done | `/priority` · `/priority/requests/:id` · `…/candidates/:memberId` · `…/approve/:memberId` · `…/done` |
| | Shopping list | `/groceries` |
| | Appointments | `/appointments` · `/appointments/:id` (+ `/new`, `/:id/edit`) |
| | Documents | `/documents` |
| More | What-if planner · Impact | `/what-if` · `/what-if/impact` |
| | Family map · Node details | `/caregraph` · `/caregraph/:nodeId` |
| | Notifications · Activity | `/notifications` · `/activity` |
| | Settings (profile, display, family, alerts, exports) | `/settings` |

Old addresses still work: `/dashboard` goes to `/today` and `/nutrition/*` to `/health`.

## Backend integration

The backend lives in `backend/` (see its README). To use it:

```
# .env.local
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

- Every service operation has two paths: the mock one and one `apiRequest(...)` call.
  `src/services/README.md` lists which endpoint each operation uses.
- `apiRequest()` (`src/services/api/client.ts`) handles the base URL, JSON, file
  uploads, the bearer token, renewing an expired token once and silently, and turning
  the API's error documents into the message the UI shows.
- The family map is read from Neo4j through `GET /caregraph`; the frontend only adds wording and layout.
- The family chat is polled every few seconds; reminders are raised by the server and arrive as notifications.
- With the backend the decision engine runs on the server. `engine.ts` stays as the
  reference implementation: the backend's test suite checks its Java engine against it.
- Only in the offline demo: the sample family, "delete data on this device", and reminders raised by
  the open tab. In the demo there is one account per browser, so nobody answers in the chat.
- Email: with the backend, sign-up sends a confirmation link (`/verify-email`), invitations are
  emailed, and "Forgot password" sends a reset link (`/reset-password`). An account with an
  unconfirmed address sees a notice with "Send the link again" and cannot join a family yet.
  The offline demo has no email, so none of this appears there.
- Not built on either side yet: one-to-one chats, live (push) chat, recurring tasks, changing a
  password while signed in, email alerts for day-to-day changes, WhatsApp/SMS/push, a Bangla interface.

## Accessibility

- Semantic landmarks, a skip link, and one `<h1>` per page (checked by the crawl).
- Page titles update on navigation.
- Every form control is labelled. Errors are linked with `aria-describedby` and
  `aria-invalid` and announced; forms don't submit invalid data.
- Keyboard support throughout:
  - Tabs use the WAI-ARIA pattern with arrow keys.
  - Menus are keyboard-operable.
  - Dialogs are native `<dialog>`: focus moves in, is trapped, Escape closes, and focus
    returns afterwards.
  - Switches use `role="switch"`.
- A visible focus ring on every interactive element.
- Colour is never the only signal: statuses carry text or icons. Text meets AA contrast.
- `prefers-reduced-motion` is respected.
- **Settings → Display:** three text sizes (the whole interface scales, not only the text) and a
  stronger-contrast option, remembered on the device.

## Verification

```bash
npm run check                       # typecheck + lint + format check + build
npm run build && npm run preview    # then, in another terminal:
cd tools/verify && npm install && npm run all
```

Set `BASE_URL` if the preview isn't on port 4173, and `OUT_DIR` to choose where
screenshots go.

- **`crawl.mjs`** visits all 58 route cases (public, signed-in, redirects and not-found) at
  1440, 834 and 390 px. It fails a page on console errors, page errors, horizontal overflow,
  error boundaries, unexpected 404s, or not exactly one `<h1>`.
- **`new-account.mjs`** signs up, completes onboarding (someone to look after, one regular
  commitment, nobody invited), checks what was saved and crawls every page of the new family.
- **`flows.mjs`** runs 17 end-to-end journeys: my day and marking done, the status line, a weekly
  event causing a clash, private tasks staying private, a handover that reaches the chat, "I can’t
  make it", the chat and task comments, health notes → suggestions → shopping list (private notes
  stay unnamed), a shopping task, people we look after, an appointment for someone with someone
  going along, a private upload, larger text, a reminder, what-if, and sign-out with a protected
  deep link.
- **`catalogue-parity.mjs`** checks that the health-note and food lists are the same as the
  backend's copies.
- **`connected/connected.mjs`** tests connected mode (`VITE_USE_MOCKS=false`) with **two people
  signed in at once**: sign-up and onboarding, all 21 top-level screens, and 23 journeys through
  the API client — tasks and comments, my day, a personal event, health note → shopping list, a
  multipart upload, the email links, joining by invitation, that one person never receives the
  other's private task and sees their private time only as "Busy", a handover from one to the
  other that reaches the chat, chat delivery by polling, personal notifications, password reset
  and silent token renewal. It runs against `connected/stub-api.mjs`, a stand-in written from
  the backend's contract that answers decisions with the reference engine, or against the real
  backend. The steps are at the top of the file.

## Known limitations

- There are no unit tests yet. The decision engine is pure and is the best first
  candidate for Vitest (the backend already replays it against its Java port).
- The mock store keeps one account per browser in `localStorage` (key
  `hearth.workspace.v3`). Clearing site data resets it. Data saved by the earlier version
  of the app (`…v2`) is not carried over.
- Connected mode keeps the session tokens in `localStorage`. That is simple and works
  across tabs; for a public deployment, move the refresh token to an `HttpOnly` cookie
  set by the gateway and add a Content-Security-Policy.
- Connected mode was tested in a browser against a stand-in API built from the backend's
  contract, not yet against the running backend.
- Food prices are rough Dhaka estimates in taka, only for a running total.
- The interface is in English.
