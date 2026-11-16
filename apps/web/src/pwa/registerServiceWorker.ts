export type ServiceWorkerRegistrationOutcome =
  'registered' | 'skipped-dev' | 'unsupported' | 'failed';

export interface ServiceWorkerEnvironment {
  production: boolean;
  isSecureContext: boolean;
  container: Pick<ServiceWorkerContainer, 'register'> | undefined;
  scriptUrl: string;
}

// Some browsers skip the automatic update check on navigation, so ask for one explicitly.
// It is a conditional request for sw.js; a changed worker installs in the background.
function checkForUpdate(registration: Pick<ServiceWorkerRegistration, 'update'>): void {
  try {
    registration.update().catch(() => undefined);
  } catch {
    // The update check is best effort.
  }
}

// Registers the app-shell worker. Never throws: offline reload is an enhancement, not a requirement.
export async function registerServiceWorker(
  env: ServiceWorkerEnvironment,
): Promise<ServiceWorkerRegistrationOutcome> {
  if (!env.production) return 'skipped-dev';
  if (!env.isSecureContext || env.container === undefined) return 'unsupported';
  try {
    const registration = await env.container.register(env.scriptUrl);
    checkForUpdate(registration);
    return 'registered';
  } catch {
    return 'failed';
  }
}

// Waits for the window load event so registration does not compete with the first render.
export function registerServiceWorkerAfterLoad(): void {
  const start = () => {
    try {
      void registerServiceWorker({
        production: import.meta.env.PROD,
        isSecureContext: window.isSecureContext,
        // Reading navigator.serviceWorker can throw when the browser blocks site data.
        container: 'serviceWorker' in navigator ? navigator.serviceWorker : undefined,
        scriptUrl: `${import.meta.env.BASE_URL}sw.js`,
      });
    } catch {
      // Unsupported or blocked: the app runs without offline reload.
    }
  };
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
