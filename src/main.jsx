import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { AppProvider } from './state/store.jsx';
import App from './App.jsx';
import { installViewportHeightFix } from './lib/viewport.js';
import { revealFocusedFieldAboveKeyboard } from './lib/keyboardScroll.js';
/*
  The two typefaces, served from our own domain rather than Google's.

  Loading them from fonts.googleapis.com handed every visitor's IP address to
  Google on every open, which the privacy policy would have had to list as a
  recipient — for fonts. Bundled, they come with the app and nobody else hears
  about it. Only the character ranges a page actually uses are downloaded.
*/
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/hanken-grotesk';
import './styles/global.css';

installViewportHeightFix();
revealFocusedFieldAboveKeyboard();

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <AppProvider>
        <App />
      </AppProvider>
    </HashRouter>
  </React.StrictMode>
);
