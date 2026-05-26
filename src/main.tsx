import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App';
import { initClientTelemetry } from './sync/telemetry';

initClientTelemetry();
registerSW({ immediate: true });

declare global {
  interface Window {
    POKER_APP_VERSION?: string | null;
  }
}

window.POKER_APP_VERSION = import.meta.env.VITE_COMMIT_HASH ?? import.meta.env.MODE ?? null;

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
