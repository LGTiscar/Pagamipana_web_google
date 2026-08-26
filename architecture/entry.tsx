import React from 'react';
import { createRoot } from 'react-dom/client';
import ArchitectureMap from './components/ArchitectureMap';
import { ARCHITECTURE } from './graph';

// Entrada del mapa autocontenido (architecture.html). No entra en el bundle de
// la app: nada de src/ importa este fichero, y el HTML se genera aparte con
// scripts/architecture-html.mjs.
const el = document.getElementById('root');
if (el) createRoot(el).render(<ArchitectureMap data={ARCHITECTURE} />);
