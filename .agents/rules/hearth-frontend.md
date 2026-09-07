# Hearth Frontend Engineering Rules

## Stack
- React 18+
- TypeScript
- Vite
- Tailwind CSS
- React Router v6
- Axios

## Architecture
- Use feature-oriented component organization.
- Pages must not contain large reusable UI components.
- Reusable UI components belong in `components/ui/` (e.g., Button, Input, Card, Modal, Badge, Avatar, Dropdown, Tabs).
- API communication belongs strictly in `services/` (e.g., `api.ts`, `authService.ts`, `taskService.ts`, `decisionService.ts`).
- Do not put API calls directly inside presentation components.
- Use explicit TypeScript interfaces/types for all data models.

## UI & Styling
- The approved Figma design is the visual source of truth.
- Stitch-generated HTML/CSS is reference material only.
- Convert designs into semantic React components using Tailwind CSS.
- Preserve consistent spacing, typography, hierarchy, responsive behavior, colors, borders, and shadows.
- Avoid generic raw styles; use cohesive Tailwind utility tokens and themes.
- Desktop and mobile layouts must both be supported.
