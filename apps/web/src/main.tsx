import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './themes/tokens.css';
import './themes/base.css';
import { App } from './App';
import { applyTheme, loadTheme } from './app/theme';

applyTheme(loadTheme());
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
