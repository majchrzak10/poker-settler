import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { injectPwaHead } from './pwa';

injectPwaHead();

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
