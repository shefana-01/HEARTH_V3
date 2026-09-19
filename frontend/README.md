# Hearth — family care coordination (web frontend)

Hearth helps a family share the work of caring for someone: tasks, schedules,
appointments, nutrition and documents, with a decision engine that spots conflicts
and suggests who could step in.

This is the production-ready React frontend for the Hearth care coordination platform.
It runs on its own with an in-browser mock backend (the default), or against the Hearth backend
(`backend/`): every data call goes through a service layer that does one or the other.

**Anyone can use it.** A new account starts empty and sets up its own family in
onboarding. The Mannan family from the design is only an optional demo
("Explore with sample data").

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
    layout/       AppShell (sidebar, top bar, mobile drawer), public header/footer, logo
    domain/       Shared domain widgets (TaskRow, score pills and breakdowns)
  constants/      Labels, icons and tones for categories, roles, skills, navigation
  features/       One folder per area; each page is a lazily loaded route
    marketing/ auth/ onboarding/ dashboard/ tasks/ schedule/ priority/ whatif/
    caregraph/ appointments/ nutrition/ documents/ family/ notifications/
    activity/ settings/
  hooks/          useAsync / useMutation, useDocumentTitle
  lib/            Pure helpers: dates, validation, formatting, storage, downloads, .ics
  mocks/          Sample workspace + reference food list (only services import these)
  services/       The data layer — see src/services/README.md
  styles/         Global CSS (fonts, base styles, focus ring, reduced motion)
  types/          Domain model (the frontend's contract with the backend)
tools/verify/     Playwright checks: route crawl, new-account crawl, end-to-end flows
```

## Architecture

- **Layers:** `features` (pages) → `services` (typed async API) → the mock store or
  the API gateway, chosen by `VITE_USE_MOCKS`. Pages never touch mock data or `fetch`.
- **Routing:** real URLs for every screen, lazy-loaded per page, with browser
  back/forward, deep links and refresh all working. Guards:
  - `RequireAuth` sends signed-out visitors to `/sign-in?next=…` and returns them
    afterwards. `next` only accepts in-app paths.
  - `RequireFamily` sends accounts without a family to onboarding.
  - `RedirectIfAuthed` keeps signed-in users off the sign-in and sign-up pages.
- **State:** `AuthProvider` holds the session. `FamilyProvider` holds the family and
  members, so any page can resolve names without refetching. Everything else is page
  state loaded through `useAsync` (loading, error and data, stale-response safe,
  `reload()` keeps data visible) and changed through `useMutation` (pending and error;
  `attempt()` for operations with no return value).
- **Decision engine** (`services/decision/engine.ts`): pure, deterministic functions
  that compute conflicts, rankings and priorities from the family's data. Nothing is
  scripted per scenario.
  - *Conflicts:* unassigned, reported unavailable, overlapping commitments, outside
    usual hours.
  - *Candidate Suitability Score:* `w1·Availability + w2·WorkloadCapacity +
    w3·SkillEligibility − w4·ConflictCost`, with weights 0.35 / 0.20 / 0.25 / 0.30,
    normalised to 0–100.
  - *Task Priority Score:* `P = wD·D + wC·C + wI·I + wR·R + wS·S`, with weights
    0.25 / 0.25 / 0.15 / 0.15 / 0.20, each with a plain-language explanation.
  - *What-if simulation:* before/after comparison for moving or reassigning a task.

  Every score in the UI shows its factor breakdown.

## Design system

Tokens live in `tailwind.config.ts`. The pastel palette comes from the landing page:

| Token | Use |
| --- | --- |
| `primary` (powder blue, 50–900; buttons use 600 `#3C739C`) | Actions, links, focus, selected states |
| `rose` (50–700) | Care recipient, circle and people accents, warm highlights |
| `mint` (50–800) | Success, availability, food and nutrition |
| `amber`, `red` | Warnings and errors only |
| `canvas`, `surface.*`, `line.*`, `ink.*` | Page background, cards, borders, text (AA contrast) |

Fonts are Plus Jakarta Sans (UI) and Newsreader (display, via `.font-display`), both
self-hosted. There is one shared focus ring, and motion respects
`prefers-reduced-motion`. Primitives are in `src/components/ui` and exported from
`@/components/ui`.

## Mobile (phones & tablets)

One codebase serves desktop and mobile; below `lg` (1024 px) the shell switches to mobile patterns, following `Hearth_Mobile_Interface.pdf`:

- **Bottom tab bar** on top-level screens — Home · Tasks · Schedule · Family · More. "More" opens a bottom sheet (native `<dialog>`, so focus is trapped and Escape closes it) with every other section.
- **App bar on detail screens** — back button and title instead of the logo; the tab bar is hidden. Each detail route declares its title and logical parent in `src/app/routeMeta.ts`, so Back works from deep links and notifications too.
- **Pinned action bar** (`<ActionBar>`) — primary actions sit at the bottom of the screen within thumb reach on task details, task/appointment forms, time away, reassignment confirmation, candidate review, impact analysis and unsaved availability. It renders inline on desktop and reports its height so content is never hidden behind it.
- **Collapsible sections** (`<CollapsibleCard>`) for secondary detail such as the priority breakdown.
- **Floating "Add task" button** on the task list.
- **Schedule** becomes a day strip plus a vertical timeline; **What-if** gets Current / Proposed / Impact tabs.
- Toasts appear at the top on small screens so they never cover bottom controls; safe-area insets are respected (`viewport-fit=cover`).

Deliberately not taken from the mobile PDF: multiple care recipients, in-app messaging, WhatsApp alerts, "remember this device", @handles and profile photos, task drafts, prescription/dosage items, distances, and security claims (HIPAA, 256-bit AES, end-to-end encryption). These are product or backend decisions, not layout.

## Screens → routes

| PDF screen | Route |
| --- | --- |
| 1 Promotional · 2 Landing | `/` · `/welcome` |
| 3 Sign in · 4 Sign up | `/sign-in` · `/sign-up` |
| Email links (not in the PDF; needed once email exists) | `/verify-email` · `/reset-password` |
| 6 Family onboarding · 7 Join family | `/onboarding` · `/join/:code?` |
| 10 Dashboard · 11 Attention detail + 15 Task conflict (merged) | `/dashboard` · `/tasks/:id/resolve` |
| 12 Create task · 13 Task details · 14 My tasks | `/tasks/new` (`/tasks/:id/edit`) · `/tasks/:id` · `/tasks` |
| 16 Family schedule · 17 My availability · 18 Report unavailability | `/schedule` · `/schedule/availability` · `/schedule/unavailable` |
| Priority Center (sidebar destination) | `/priority` |
| 19 Recommendations · 20 Candidate · 21 Approval · 22 Success | `/priority/requests/:id` · `…/candidates/:memberId` · `…/approve/:memberId` · `…/done` |
| 24 What-if scheduler · 23 Impact analysis | `/what-if` · `/what-if/impact` |
| 25 CareGraph · 26 Entity details | `/caregraph` · `/caregraph/:nodeId` |
| 32 Appointments + 34 Family appointments (merged) · 33 Details | `/appointments` · `/appointments/:id` (+ `/new`, `/:id/edit`) |
| 27 Nutrition goals · 28 Food options · 29 Grocery planning | `/nutrition` · `/nutrition/recommendations` · `/nutrition/groceries` |
| 35 Document vault | `/documents` |
| 8 Family members · 9 Member profile | `/family` · `/family/:memberId` |
| 30 Notifications · 31 Activity & audit | `/notifications` · `/activity` |
| 5 Profile & personal details | `/settings` |

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
- CareGraph is read from Neo4j through `GET /caregraph`; the frontend only adds wording and layout.
- With the backend the decision engine runs on the server. `engine.ts` stays as the
  reference implementation: the backend's test suite checks its Java engine against it.
- Only in the offline demo: the sample family, and "delete data on this device".
- Email: with the backend, sign-up sends a confirmation link (`/verify-email`), invitations are
  emailed, and "Forgot password" sends a reset link (`/reset-password`). An account with an
  unconfirmed address sees a notice with "Send the link again" and cannot join a family yet.
  The offline demo has no email, so none of this appears there.
- Not built on either side yet: changing a password while signed in, email alerts for
  day-to-day changes, WhatsApp/SMS/push.

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

## Verification

```bash
npm run check                       # typecheck + lint + format check + build
npm run build && npm run preview    # then, in another terminal:
cd tools/verify && npm install && npm run all
```

Set `BASE_URL` if the preview isn't on port 4173, and `OUT_DIR` to choose where
screenshots go.

- **`crawl.mjs`** visits all 42 route cases (public, signed-in and not-found) at 1440,
  834 and 390 px. It fails a page on console errors, page errors, horizontal overflow,
  error boundaries, unexpected 404s, or not exactly one `<h1>`.
- **`new-account.mjs`** signs up, completes onboarding and crawls every page with an
  empty family.
- **`flows.mjs`** runs 16 end-to-end journeys, including the reassignment flow, what-if,
  groceries, uploads, appointments, tasks, members, notifications, activity export,
  settings, CareGraph, keyboard and dialog behaviour, and sign-out with a protected
  deep link.

- **`connected/connected.mjs`** tests connected mode (`VITE_USE_MOCKS=false`): sign-up,
  onboarding, every page and ten flows through the API client, including silent token
  renewal. It runs against `connected/stub-api.mjs`, a small stand-in written from the
  backend's contract, or against the real backend. The steps are at the top of the file.

Latest results are in the delivery notes: all suites pass with 0 console errors.

## Known limitations

- There are no unit tests yet. The decision engine is pure and is the best first
  candidate for Vitest.
- The mock store keeps one account per browser in `localStorage`. Clearing site data
  resets it.
- Connected mode keeps the session tokens in `localStorage`. That is simple and works
  across tabs; for a public deployment, move the refresh token to an `HttpOnly` cookie
  set by the gateway and add a Content-Security-Policy.
- Connected mode was tested in a browser against a stand-in API built from the
  backend's contract, not yet against the running backend.
