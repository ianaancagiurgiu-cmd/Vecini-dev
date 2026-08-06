import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from './state/store.jsx';
import App from './App.jsx';
import { installViewportHeightFix } from './lib/viewport.js';
import './styles/global.css';

installViewportHeightFix();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
);
