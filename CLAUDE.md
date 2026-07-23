# CLAUDE.md — PagaMiPana

App para **dividir cuentas entre amigos**: proyectos persistentes tipo Tricount + **reparto por-ítem
con OCR** (el diferenciador). UI en **español**, mobile-first, empaquetable como app nativa (Capacitor).

## Stack
- **Frontend**: React 18 + TypeScript + **Vite**.
- **Estilos**: **Tailwind CSS build-time** (v3, `darkMode: 'class'`) — NO por CDN. Fuente **Inter** bundleada (`@fontsource/inter`).
- **Backend**: **Supabase** (Postgres + Auth + RLS + RPC). El cliente está en `services/supabaseClient.ts`.
- **OCR**: AWS Lambda externo (endpoint en `services/ocr.ts`). Convive con Supabase; no se sustituye.
- **Nativo**: **Capacitor** (`android/`, `ios/`). Ver `NATIVE_HANDOFF.md`.
- **Realtime legacy**: MQTT (broker público HiveMQ) — solo en el wizard antiguo, ver más abajo.

## Cómo ejecutar
```bash
npm run dev          # Vite dev (http://localhost:5173)
npm run build        # build a dist/
npm run cap:sync     # build + copia a android/ e ios/
npm run cap:android  # cap:sync + abre Android Studio
npm run cap:ios      # cap:sync + abre Xcode (solo en Mac)
```
> Si cambias `tailwind.config.js` / `postcss.config.js`, **reinicia `npm run dev`** (Vite lee la config al arrancar).

## Variables de entorno
`.env.local` (gitignored; plantilla en `.env.example`):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` (clave *publishable*, pública por diseño; va en el frontend)

La clave *secret* de Supabase NUNCA va en el frontend ni en el repo.

## Arquitectura
- **`AppShell.tsx`** (raíz) decide qué se muestra:
  - `?session=…` → `App.tsx` (wizard **legacy** de reparto en vivo por MQTT; solo compat de enlaces viejos).
  - `quickMode` → `QuickSplit` (reparto rápido **sin cuenta ni proyecto**, efímero).
  - sin sesión → `LoginScreen`.
  - `?join=…` → `JoinScreen` (unirse a un proyecto por enlace, pide nombre).
  - resto → `HomeProjects` → `ProjectPeopleStep` (post-crear) / `ProjectDetail`.
- **`hooks/useAuth.ts`**: identidad **híbrida**. Sesión anónima solo si el usuario elige "Probar sin cuenta"
  (`continueAsGuest`). Ascenso a cuenta con Google (`linkGoogle`/`signInGoogle`, con fallback a sign-in si el
  email ya existe) o magic-link (`signInEmail`/`linkEmail`). `saveName`/`profileName`/`displayName` gestionan
  el nombre visible (perfil).
- **`services/`**: `supabaseClient`, `projects`, `expenses`, `ocr`, `itemSplit` (lógica de reparto por
  unidades), `format` (moneda), `currencies` (ISO 4217 vía `Intl`), `imageProcessor` (normaliza/HEIC→JPEG).
- **`components/`** (nuevo diseño): `LoginScreen`, `JoinScreen`, `HomeProjects`, `ProjectDetail`
  (pestañas **Gastos · Balances · Miembros**), `CreateProjectSheet`, `AddExpenseSheet`, `ScanExpenseSheet`
  (OCR), `ItemAssigner` (asignación por línea/unidades, reutilizado en OCR de proyecto y en QuickSplit),
  `InvitePanel` (QR+enlace, reutilizado), `QuickSplit`, `LinkAccountSheet`, `ThemeToggle`, `Button`, `Logo`.
- **Legacy** (no tocar salvo necesidad): `App.tsx`, `components/Step*.tsx`, MQTT, `services/geminiService.ts` (stub).

## Modelo de datos (Supabase)
Tablas: `profiles`, `projects`, `participants` (¡`profile_id` NULL = participante sin cuenta!),
`expenses`, `expense_shares` (canónico para balances), `expense_items` (detalle OCR), `settlements`.
RPCs: `create_project`, `join_project`, `add_expense`, `add_ocr_expense`, `get_balances`,
`list_projects_overview(p_include_archived)`. RLS gira en torno a `is_project_member(project_id)`.
Archivar = `projects.archived_at`.

### Migraciones (`supabase/migrations/`) — se corren A MANO en el SQL Editor de Supabase
`0001` base (profiles/projects/participants + RLS + create_project) · `0002` gastos (expenses/shares +
add_expense/get_balances) · `0003` join_project · `0004` list_projects_overview · `0005` expense_items +
add_ocr_expense · `0006` settlements (+ balances con liquidaciones) · `0007` archivar (overview con
`archived_at` + filtro). **Al crear una migración nueva, recuérdale al usuario que la ejecute.**

## Convenciones
- **Copys en español** (cercano, "entre panas"). Acento de marca amable.
- **Color primario azul** (`blue-600`), pastel per-persona en avatares (`AVATAR_COLORS` en `types.ts`,
  clases arbitrarias `bg-[#...]`). Semántica: azul "te deben", rojo "debes".
- **Modo oscuro** con `dark:` (estrategia `class`): `ThemeToggle` + script temprano en `index.html`.
  ⚠️ Tailwind JIT (build-time) solo genera clases que aparezcan **literales** en el código —
  **nada de** `` `ring-offset-${x}` ``; usa strings estáticos.
- **Layout mobile-first**: columna centrada `max-w-md` sobre fondo, para que en PC no se vea vacío.
- **No definas componentes dentro de componentes** (se remontan y pierden estado; ver `QuickShell` a nivel de módulo).
- **Fidelidad al mockup**: seguir el diseño acordado (ver `DESIGN_HANDOFF.md`).

## Verificación e2e (patrón usado en este repo)
Script Node ESM con `@supabase/supabase-js` contra el proyecto real (login anónimo → RPCs → asserts →
limpieza). Útil para validar migraciones/RLS sin UI. Se escribe temporal y se borra tras correrlo.

## Docs relacionados
- `PLAN_PROYECTOS.md` — producto y fases (1: fundación · 2: gastos · 3: OCR · 4: liquidación+Capacitor).
- `DESIGN_HANDOFF.md` — lenguaje visual.
- `NATIVE_HANDOFF.md` — build y publicación Android/iOS + pendiente de deep-links del login.

## Pendiente / próximos pasos
- **Deep-links del login nativo** (Google/magic-link en la app) — ver `NATIVE_HANDOFF.md`. El modo invitado ya funciona en nativo.
- Iconos/splash nativos (`@capacitor/assets`), cámara nativa opcional (`@capacitor/camera`).
- Limpieza periódica de usuarios anónimos abandonados.
