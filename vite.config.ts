import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Id de este build: va dentro del bundle (__APP_BUILD__) y en /version.json. La app compara
// los dos para enterarse de que hay un despliegue nuevo (ver services/appUpdate.ts).
// AWS_COMMIT_ID lo pone Amplify; el sello de tiempo lo hace único aunque se redespliegue el mismo commit.
const BUILD_ID = `${(process.env.AWS_COMMIT_ID ?? 'local').slice(0, 7)}-${Date.now().toString(36)}`;

// Publica /version.json junto al build (solo en `vite build`).
const versionFile = (): Plugin => ({
  name: 'pmp-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD_ID }) });
  },
});

// Las variables VITE_* se exponen automáticamente vía import.meta.env.
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __APP_BUILD__: JSON.stringify(BUILD_ID) },
});
