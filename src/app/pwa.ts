import { registerSW } from 'virtual:pwa-register';

// Marks the page as ready to work offline. Not visible to the user; browser tests
// wait for it before going offline.
function markOfflineReady(): void {
  document.documentElement.dataset.offlineReady = 'true';
}

// Registers the service worker. The page is marked offline-ready only once a
// worker has installed with its full precache: either now (first visit) or on an
// earlier visit (an active worker already exists). A failed install leaves the
// already-loaded game working online and is never shown as success.
export function registerPwa(): void {
  if (!('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onOfflineReady: markOfflineReady,
    onRegisteredSW: (_url, registration) => {
      if (registration?.active) markOfflineReady();
    },
    onRegisterError: () => {
      // Nothing to do: the game keeps working online.
    },
    // onNeedRefresh is intentionally not handled: the new version loads on the next visit.
  });
}
