import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/plus-jakarta-sans/400.css';
import '@fontsource/plus-jakarta-sans/500.css';
import '@fontsource/plus-jakarta-sans/600.css';
import '@fontsource/plus-jakarta-sans/700.css';
import '@fontsource/plus-jakarta-sans/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';

import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import {
  markOfflineReady,
  markServiceWorkerNeedsRefresh,
  registerSwUpdater,
} from './hooks/usePWAInstall.ts';
import './index.css';

// Only register the Service Worker in web/PWA environments, not inside native Capacitor APK shells
if (!('Capacitor' in window)) {
  const updateSW = registerSW({
    immediate: true,
    onOfflineReady() {
      markOfflineReady(true);
    },
    onNeedRefresh() {
      markServiceWorkerNeedsRefresh(true, updateSW);
    },
  });
  registerSwUpdater(updateSW);
}

createRoot(document.getElementById('root')!).render(<App />);
