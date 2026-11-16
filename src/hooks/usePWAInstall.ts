import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type OfflineSnapshot = {
  offlineReady: boolean;
  needRefresh: boolean;
  isNativeShell: boolean;
};

let offlineSnapshot: OfflineSnapshot = {
  offlineReady: typeof window !== 'undefined' && 'Capacitor' in window,
  needRefresh: false,
  isNativeShell: typeof window !== 'undefined' && 'Capacitor' in window,
};

let updateSwCallback: ((reloadPage?: boolean) => Promise<void>) | null = null;
const offlineListeners = new Set<(snap: OfflineSnapshot) => void>();

function notifyOfflineListeners() {
  for (const listener of offlineListeners) {
    listener(offlineSnapshot);
  }
}

export function markOfflineReady(ready: boolean) {
  if (offlineSnapshot.offlineReady === ready) return;
  offlineSnapshot = { ...offlineSnapshot, offlineReady: ready };
  notifyOfflineListeners();
}

export function markServiceWorkerNeedsRefresh(
  needRefresh: boolean,
  updater?: (reloadPage?: boolean) => Promise<void>
) {
  if (updater) {
    updateSwCallback = updater;
  }
  if (offlineSnapshot.needRefresh === needRefresh) return;
  offlineSnapshot = { ...offlineSnapshot, needRefresh };
  notifyOfflineListeners();
}

export function registerSwUpdater(updater: (reloadPage?: boolean) => Promise<void>) {
  updateSwCallback = updater;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function useOfflineCapability() {
  const [snapshot, setSnapshot] = useState<OfflineSnapshot>(offlineSnapshot);

  useEffect(() => {
    offlineListeners.add(setSnapshot);

    // On subsequent visits, Workbox already cached assets previously; verify SW ready + cache storage
    if (!offlineSnapshot.offlineReady && typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(async (reg) => {
          if (!reg.active) return;
          if (typeof caches !== 'undefined') {
            const keys = await caches.keys();
            if (keys.some((k) => k.includes('workbox') || k.includes('precache') || k.includes('flow-offline'))) {
              markOfflineReady(true);
            }
          } else {
            markOfflineReady(true);
          }
        })
        .catch(() => {
          // Ignore environments without SW cache inspection support
        });
    }

    return () => {
      offlineListeners.delete(setSnapshot);
    };
  }, []);

  const applyOfflineUpdate = async () => {
    if (updateSwCallback) {
      await updateSwCallback(true);
    }
  };

  return {
    ...snapshot,
    supportsServiceWorker:
      typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !snapshot.isNativeShell,
    applyOfflineUpdate,
  };
}
