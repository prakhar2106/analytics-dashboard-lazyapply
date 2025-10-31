# Analytics Dashboard

A modern analytics dashboard built with React, TypeScript, and Material-UI (MUI).

## Tech Stack

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Material-UI (MUI)** - Component library and design system
- **Emotion** - CSS-in-JS styling (required by MUI)

## Getting Started

### Prerequisites

- Node.js (v18.18.0 or higher recommended)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

### Backend Integration

The project is configured to proxy API requests to your backend. The backend (`node-extension-backend`) should be running separately.

- Frontend runs on: `http://localhost:3000`
- Backend proxy: API requests to `/api/*` are proxied to `http://localhost:5000`

To change the backend port, update `vite.config.ts`:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:YOUR_BACKEND_PORT',
    changeOrigin: true,
  },
}
```

## Project Structure

```
src/
  ├── App.tsx          # Main application component
  ├── main.tsx         # Application entry point
  ├── theme.ts         # MUI theme configuration
  └── index.css        # Global styles
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Features

- ✅ Responsive layout with sidebar navigation
- ✅ Material-UI theming
- ✅ Mobile-friendly drawer navigation
- ✅ Dashboard overview with stat cards
- ✅ Ready for chart integration

## Next Steps

1. Integrate your backend API endpoints
2. Add charting library (e.g., Recharts, Chart.js, or Victory)
3. Implement authentication if needed
4. Add real data fetching and state management
5. Customize theme colors and branding

## License

Private project
