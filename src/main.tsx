import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './context/ThemeContext.tsx';
import { ToastProvider } from './context/ToastContext.tsx';
import './index.css';

// Fix: Suppress "Cannot redefine property: ethereum" errors
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('Cannot redefine property: ethereum')) {
    event.stopImmediatePropagation();
    event.preventDefault();
    console.warn('Suppressed error: Cannot redefine property: ethereum');
  }
});

// Auto-recover from stale chunk preloads on deployments
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

