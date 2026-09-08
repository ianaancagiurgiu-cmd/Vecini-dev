import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from './state/store.jsx';
import App from './App.jsx';
import { installViewportHeightFix } from './lib/viewport.js';
import { installKeyboardScrollLock } from './lib/keyboardScroll.js';
import { installViewportDebug } from './lib/viewportDebug.js';
import './styles/global.css';

installViewportHeightFix();
installKeyboardScrollLock();
installViewportDebug(); // TEMPORARY — see viewportDebug.js. Remove once the keyboard-gap fix is confirmed.

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
);
