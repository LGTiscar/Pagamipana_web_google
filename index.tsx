import React from 'react';
import ReactDOM from 'react-dom/client';
import AppShell from './AppShell';
import { UpdateBanner } from './components/UpdateBanner';
import { startUpdateWatcher } from './services/appUpdate';
import './index.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Recarga (o avisa) cuando hay un despliegue nuevo: la webapp del iPhone no lo hace sola.
startUpdateWatcher();

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AppShell />
    <UpdateBanner />
  </React.StrictMode>
);