# Plan: PagaMiPana → Proyectos (Tricount + reparto por-ítem)

> Evolución de "reparto puntual de un ticket" a "producto con proyectos persistentes tipo Tricount",
> conservando como diferenciador la joya actual: el **reparto por-ítem concurrente con OCR**.

---

## 0. Decisiones tomadas y pendientes

| Decisión | Estado |
|---|---|
| Modelo de identidad | ✅ **Híbrido anónimo→cuenta** (anónimo real desde el segundo uno, ascendible a cuenta permanente sin perder datos) |
| Método de login (al ascender) | ✅ **Google + magic-link** (gratis; el teléfono/SMS queda descartado por coste) |
| Backend / persistencia | ✅ **Supabase** (ver comparativa de coste más abajo) |
| OCR backend Python (Lambda) | ✅ **Se mantiene tal cual**, convive con Supabase |
| Estrategia móvil | ✅ **Web-first en React + Capacitor** para App Store/Play (mismo código). Ionic opcional más adelante si se quiere más tacto nativo |
| Futuro del realtime MQTT | ⏳ **Abierto**: migrar a Supabase Realtime vs mantener MQTT solo en la pantalla de asignación (se decide en Fase 3) |

---

## 1. Comparativa de coste backend (Supabase vs propio)

- **El Lambda de Python de OCR NO se sustituye.** Supabase aporta lo que hoy no existe
  (DB, auth, realtime seguro, storage). El OCR sigue en Python.
- **Supabase:** 0 €/mes en free tier (500 MB DB, 50k usuarios auth, realtime, 1 GB storage) →
  25 €/mes (plan Pro) cuando haya tracción.
- **Backend propio:** ~5–10 €/mes de hosting, pero **semanas** de trabajo reimplementando auth,
  autorización, realtime, storage y backups — superficie de seguridad enorme en una app con dinero.
- **Decisión: Supabase.** El hosting es lo barato; el tiempo y el riesgo de seguridad es lo caro.

---

## 2. Arquitectura objetivo

```
┌─────────────────────────┐         ┌──────────────────────────┐
│  React SPA (Vite)        │         │  AWS Lambda (Python)      │
│  - Auth (Supabase JS)    │────────▶│  OCR de tickets           │  (se mantiene)
│  - Proyectos / gastos    │         └──────────────────────────┘
│  - Reparto por-ítem      │
└──────────┬──────────────┘
           │  (Supabase JS client)
           ▼
┌──────────────────────────────────────────────────────────────┐
│  Supabase                                                      │
│  - Postgres (proyectos, gastos, balances)  + Row Level Security│
│  - Auth (cuenta obligatoria)                                   │
│  - Realtime (sustituye/complementa MQTT, ya autenticado)       │
│  - Storage (fotos de tickets, hoy en base64 en memoria)        │
└──────────────────────────────────────────────────────────────┘
```

Se retira el broker **HiveMQ público** como fuente de verdad (hoy datos financieros viajan por un
broker sin auth ni privacidad). Supabase Realtime pasa a ser el canal seguro.

### Identidad híbrida (anónimo → cuenta)
- Al abrir la app: `supabase.auth.signInAnonymously()` → usuario **real** con `auth.uid()` y JWT al
  instante, sin pedir nada. Fricción cero, como ahora. Puede crear proyectos y repartir ya.
- Cuando quiere persistencia entre dispositivos / que le encuentren: `linkIdentity()` con
  **Google o magic-link** → **mismo `auth.uid()`**, ahora permanente. No hay migración ni pérdida de datos.
- La RLS y el modelo son **idénticos** para anónimos y verificados (ambos tienen `auth.uid()`).
- Mantenimiento: limpieza periódica de anónimos abandonados + rate-limiting anti-abuso.

### Estrategia móvil (web-first + Capacitor)
- La feature se construye en **React web** (reutiliza todo lo actual). La web sirve además el
  **link viral** de "únete a este reparto" (un no-usuario lo abre al instante en el navegador).
- **Capacitor** empaqueta esa misma web como app iOS/Android para las tiendas → **un solo frontend**.
  Supabase JS funciona igual dentro de Capacitor; se ganan cámara/push nativos.
- Se empaqueta al **estabilizar** (fin de Fase 2/3), no antes. Hasta entonces sigue siendo PWA instalable.
- **Ionic** (componentes/transiciones de aspecto nativo) es un añadido **opcional posterior** si el
  tacto web puro no basta — conservando el código React. React Native queda descartado por ahora
  (obligaría a reescribir la UI y a mantener dos frontends, web + nativo).

---

## 3. Modelo de datos (concreto)

Idea clave que respeta tu feature actual: **un "participante" NO es necesariamente un usuario
registrado** (como en Tricount puedes añadir a alguien que no tiene la app). El reparto de un ticket
pasa a ser **un gasto (`expense`) de tipo `ocr`** dentro de un proyecto.

```
profiles                      -- 1:1 con auth.users de Supabase
  id            uuid PK  (= auth.users.id)
  display_name  text
  avatar_color  text
  created_at    timestamptz

projects                      -- el "Tricount": contenedor persistente
  id            uuid PK
  name          text
  type          text          -- trip | couple | friends | event | other (cosmético)
  currency      text default 'EUR'
  created_by    uuid FK profiles
  created_at    timestamptz
  archived_at   timestamptz null

participants                  -- gente entre la que se reparte (puede NO tener cuenta)
  id            uuid PK
  project_id    uuid FK projects
  profile_id    uuid FK profiles NULL   -- null = participante "virtual" sin cuenta
  display_name  text
  color         text
  -- Acceso al proyecto = existe un participante con profile_id = auth.uid()

expenses                      -- un gasto: manual O ticket con OCR
  id            uuid PK
  project_id    uuid FK projects
  description   text
  amount_total  numeric(12,2)
  currency      text
  paid_by       uuid FK participants     -- quién adelantó el dinero
  split_type    text          -- equal | shares | exact | percent | by_item
  source        text          -- manual | ocr
  receipt_path  text null     -- ruta en Supabase Storage (fotos)
  created_by    uuid FK profiles
  created_at    timestamptz

expense_shares                -- cuánto debe cada participante de ESTE gasto (canónico)
  id            uuid PK
  expense_id    uuid FK expenses
  participant_id uuid FK participants
  amount        numeric(12,2) -- importe resuelto que debe este participante

expense_items                 -- SOLO gastos source=ocr: líneas del ticket
  id            uuid PK
  expense_id    uuid FK expenses
  description   text
  quantity      numeric
  price_total   numeric(12,2)

item_assignments              -- la asignación por-ítem concurrente (tu feature actual)
  id                uuid PK
  expense_item_id   uuid FK expense_items
  participant_id    uuid FK participants
  -- Al consolidar el ticket, esto se resuelve en filas de expense_shares

settlements                   -- pagos registrados ("X pagó Y €10")  [fase posterior]
  id            uuid PK
  project_id    uuid FK projects
  from_participant uuid FK participants
  to_participant   uuid FK participants
  amount        numeric(12,2)
  created_at    timestamptz
```

**Balances (calculados, no almacenados):**
- neto(participante) = Σ(gastos que pagó) − Σ(shares que debe) + Σ(settlements)
- "Quién debe a quién" = algoritmo de **minimización de transferencias** sobre los netos.

**RLS (permisos):** puedes leer/escribir un proyecto si existe un `participant` de ese proyecto con
`profile_id = auth.uid()`. Todo lo demás cuelga de ahí.

---

## 4. Fases de implementación

### Fase 1 — Fundación: auth híbrido + esquema + RLS
- Crear proyecto Supabase; integrar `supabase-js` en el SPA.
- **Sesión anónima automática** al arrancar (`signInAnonymously`), sin fricción.
- Flujo de **ascenso a cuenta** con Google + magic-link (`linkIdentity`), conservando el `auth.uid()`.
- Tablas `profiles`, `projects`, `participants` + trigger de alta de perfil + políticas RLS.
- UI: "Mis proyectos" (crear proyecto, añadir participantes) + banner/CTA para vincular cuenta.
- Sin gastos todavía. Objetivo: cruzar de "efímero" a "persistente y con identidad".

### Fase 2 — Gasto manual (core de Tricount)
- Tablas `expenses` + `expense_shares`.
- Formulario de gasto manual: importe, quién pagó, tipo de reparto (igual / exacto / % / partes).
- Lista de gastos del proyecto + **balance neto** + vista "quién debe a quién".
- A partir de aquí ya es un Tricount funcional.

### Fase 3 — Integrar el OCR como un gasto del proyecto (LA diferenciación)
- Reutilizar `StepUpload` + Lambda OCR → crear `expense` con `source=ocr` y sus `expense_items`.
- Reutilizar `StepAssign` (reparto por-ítem concurrente) → `item_assignments`.
- Consolidar: al cerrar el reparto, `item_assignments` → filas de `expense_shares` → suma al balance.
- **Decisión de realtime:** migrar el live de asignación a Supabase Realtime (seguro, unificado)
  o mantener MQTT solo en esa pantalla a corto plazo (ya es robusto con deltas), con topic por
  token no adivinable. Recomendación: acabar en Supabase Realtime.

### Fase 4 — Liquidación y pulido
- `settlements` ("marcar como pagado") + algoritmo de mínimas transferencias.
- Fotos de tickets a Supabase Storage (hoy base64 en memoria).
- Exportar/compartir, mejoras PWA, invitaciones a proyecto por link.

---

## 5. Riesgos y decisiones abiertas

1. **Migración del realtime** (a decidir en Fase 3): MQTT público → Supabase Realtime, o mantener
   MQTT solo en la pantalla de asignación en vivo con topic por token no adivinable.
2. **Higiene de usuarios anónimos**: limpieza periódica de anónimos abandonados + rate-limiting
   anti-abuso (Supabase lo permite; poca cosa pero hay que dejarlo montado).
3. **Retención**: el salto de herramienta puntual a producto vive o muere en la Fase 2–3;
   conviene medir uso real antes de invertir en Fase 4 y en el empaquetado con Capacitor.
4. **Coste Supabase**: 0 € en free tier hasta tener tracción → 25 €/mes (Pro) después.
