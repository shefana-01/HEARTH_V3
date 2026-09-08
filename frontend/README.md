# Hearth Frontend

The web application for Hearth, built with React 18, TypeScript, Vite, and Tailwind CSS.

## Getting Started

### Prerequisites
- Node.js (v18+ or v24 LTS)
- npm (v10+)

### Setup & Run
1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

3. Build for production:
   ```bash
   npm run build
   ```

## Architecture
- **Pages**: Feature views located in `src/pages/`
- **UI Components**: Reusable components located in `src/components/ui/`
- **Services**: API HTTP client and typed endpoints in `src/services/`
- **Types**: Domain data types in `src/types/`
- **Routing**: Client-side routes managed in `src/routes/AppRoutes.tsx`
