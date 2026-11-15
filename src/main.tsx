import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

// Only register the Service Worker in web/PWA environments, not inside native Capacitor APK shells
if (!('Capacitor' in window)) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById('root')!).render(<App />);
