import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import { ServicesProvider } from './services';
import type { Services } from './services';

export function startApp(container: HTMLElement, services: Services): Root {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <ServicesProvider services={services}>
          <App />
        </ServicesProvider>
      </ErrorBoundary>
    </StrictMode>,
  );
  return root;
}
