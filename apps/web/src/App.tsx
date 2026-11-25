import { AppShell } from './app/AppShell';
import { Router } from './app/router';
import { routes } from './app/routes';
import { ServicesProvider } from './app/services';

export function App() {
  return (
    <ServicesProvider>
      <AppShell>
        <Router routes={routes} fallback={<p className="gs-empty">Page not found.</p>} />
      </AppShell>
    </ServicesProvider>
  );
}
