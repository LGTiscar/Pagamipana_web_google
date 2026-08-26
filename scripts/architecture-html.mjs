#!/usr/bin/env node
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { build } from 'esbuild';

/**
 * Empaqueta el mapa de arquitectura en UN solo fichero: architecture.html.
 *
 * Es una página de herramienta interna que se abre a mano desde el repo y que
 * NO se despliega: vive en la raíz, fuera de dist/, así que ni Vite ni Amplify
 * la ven. Todo va embebido —JS, CSS y la fuente Inter en base64— para que
 * funcione con doble clic y sin red.
 *
 * Los tokens --pmp-* son el único sitio donde el mapa toca el sistema de
 * diseño de la app: los define esta cáscara, en los dos temas, y el mismo
 * script temprano que index.html decide cuál se aplica.
 */

const ROOT = new URL('..', import.meta.url);
const read = (p) => readFileSync(new URL(p, ROOT));

const bundle = await build({
  entryPoints: [new URL('architecture/entry.tsx', ROOT).pathname],
  bundle: true,
  minify: true,
  format: 'iife',
  jsx: 'automatic',
  target: ['es2020'],
  define: { 'process.env.NODE_ENV': '"production"' },
  write: false,
  logLevel: 'warning',
});

const js = bundle.outputFiles[0].text.split('</script>').join('<\\/script>');
const keyframes = read('architecture/components/keyframes.css').toString();
const font = (weight) =>
  read(`node_modules/@fontsource/inter/files/inter-latin-${weight}-normal.woff2`).toString('base64');

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>Arquitectura · PagaMiPana</title>
<style>
@font-face{font-family:Inter;font-style:normal;font-weight:400;font-display:swap;src:url(data:font/woff2;base64,${font(400)}) format('woff2')}
@font-face{font-family:Inter;font-style:normal;font-weight:600;font-display:swap;src:url(data:font/woff2;base64,${font(600)}) format('woff2')}

/* Paleta de PagaMiPana: Inter, azul-600 de acento y la escala zinc. */
:root{
  --pmp-surface:#ffffff;
  --pmp-border:#e4e4e7;
  --pmp-structure:#a1a1aa;
  --pmp-ink-1:#18181b;
  --pmp-ink-2:#52525b;
  --pmp-ink-3:#a1a1aa;
  --pmp-accent:#2563eb;
  --pmp-accent-wash:#dbeafe;
  --pmp-font:Inter,system-ui,sans-serif;
  --pmp-font-mono:ui-monospace,SFMono-Regular,Menlo,monospace;
}
html.dark{
  --pmp-surface:#18181b;
  --pmp-border:#3f3f46;
  --pmp-structure:#71717a;
  --pmp-ink-1:#fafafa;
  --pmp-ink-2:#d4d4d8;
  --pmp-ink-3:#a1a1aa;
  --pmp-accent:#60a5fa;
  --pmp-accent-wash:#1e3a8a;
}
html,body{margin:0;height:100%;background:var(--pmp-surface);color:var(--pmp-ink-1)}
body{font-family:var(--pmp-font);-webkit-font-smoothing:antialiased}

${keyframes}
</style>
</head>
<body>
<div id="root"></div>
<script>
// El mismo tema que la app: 'pmp-theme' en localStorage, clase en <html>.
(function () {
  try {
    var t = localStorage.getItem('pmp-theme') || 'system';
    var dark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
</script>
<script>${js}</script>
</body>
</html>
`;

const out = new URL('architecture.html', ROOT);
writeFileSync(out, html);
const kb = (statSync(out).size / 1024).toFixed(0);
console.log(`architecture — architecture.html (${kb} kB, autocontenido)`);
