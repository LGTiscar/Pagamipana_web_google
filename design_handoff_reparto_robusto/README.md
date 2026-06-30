# Handoff: Reparto por unidades con invalidación + sync por deltas

> **Repo destino:** `LGTiscar/Pagamipana_web_google` (React + TypeScript, Tailwind vía CDN, MQTT sobre `mqtt.js`, iconos `lucide-react`).
> **Tarea:** integrar un refactor de la pantalla de reparto (`StepAssign`) y de la capa de sincronización, partiendo de los archivos `.tsx`/`.ts` de este bundle.

---

## Naturaleza de este handoff (léelo primero)

A diferencia de un handoff de diseño típico, **este bundle NO contiene prototipos HTML para recrear**. Contiene **código TypeScript/React de producción ya adaptado a la arquitectura del repo destino**, escrito contra sus tipos, su componente `Button`, su paleta `AVATAR_COLORS` y su capa MQTT.

Tu trabajo como agente:
1. Aplicar los 3 archivos sobre el repo (reemplazo directo).
2. Verificar que compila (`tsc`) y resolver cualquier desajuste de tipos/props contra el código real del repo.
3. Hacer una prueba de humo de concurrencia.
4. Crear rama + commit + PR.

El archivo `prototipo_Reparto_en_vivo.dc.html` se incluye **solo como referencia visual/interactiva** del comportamiento esperado (estados, copys, layout). No se porta; es para que veas cómo debe verse y comportarse el resultado.

---

## Objetivo funcional

La pantalla de reparto debe resolver de forma robusta todas las casuísticas de división de una cuenta leída por OCR:
- Una persona consume un item de varios iguales (ej. 1 de 4 cañas).
- Un item compartido entre varios (a partes iguales).
- **Caso clave:** varias unidades del mismo item con reparto distinto — p. ej. `2× Pizza` donde **una se la come una persona entera y la otra la comparten dos**.

Además, los participantes editan **en vivo y en concurrencia** (varios móviles sobre la misma sesión MQTT); ediciones a líneas distintas no deben pisarse entre sí.

---

## Archivos a aplicar

| Archivo del bundle | Ruta destino en el repo | Acción |
|---|---|---|
| `StepAssign.tsx` | `components/StepAssign.tsx` | **Reemplazar** |
| `App.tsx` | `App.tsx` (raíz) | **Reemplazar** |
| `types.ts` | `types.ts` (raíz) | **Reemplazar** |

**No tocar:** `components/StepResults.tsx`, `components/StepPeople.tsx`, `components/StepUpload.tsx`, `components/Button.tsx`, `components/Logo.tsx`, `index.html`, `index.tsx`, `services/`.

> Si el repo ha divergido desde la base de este handoff, **no sobrescribas a ciegas**: aplica los cambios descritos en las secciones siguientes como un merge manual, preservando cualquier lógica nueva de esos archivos.

---

## Qué cambia y por qué

### A. Modelo de reparto unidad-a-dueños (en `StepAssign.tsx`)

El repo ya aplana los items por unidad: `flattenItems()` convierte `2× Pizza` en dos `SplitItem` con ids `pizza_0`, `pizza_1`, y `Assignment` es `{ [splitItemId]: string[] }`. **No se cambia ese modelo** — se construye encima:

- **Agrupar** las unidades por `originalReceiptItemId` (un "grupo" = una línea del ticket).
- **Uniforme**: todas las unidades del grupo tienen exactamente los mismos dueños (`ownersKey()` = lista ordenada y serializada). → Se muestra el **selector simple** (chips de persona). Tocar un chip añade/quita a esa persona en **todas** las unidades del grupo → reparto a partes iguales de la línea entera.
- **Divergente**: las unidades difieren (`pizza_0=[Lucas]`, `pizza_1=[Marta,Iván]`). → El selector simple se **bloquea** (no se renderiza) y aparece un resumen de solo lectura **"🔒 Por unidades · L 11,00 € · M 5,50 € · I 5,50 €"** (avatar + importe por persona). La edición ocurre en el **editor por unidades** (expandible).
- **Restablecer**: vacía todas las unidades del grupo → vuelve al estado uniforme y reactiva el selector simple.

Esto resuelve el caso pizza sin estado nuevo: solo cambia *quién* está en el array de cada unidad. `StepResults.calculateTotals()` ya divide `item.price / owners.length` por unidad, así que los totales finales salen correctos sin tocar Results.

### B. Sincronización por deltas (en `App.tsx` y `types.ts`)

**Antes:** un `useEffect([assignments, step])` difundía el objeto `assignments` **completo** en cada cambio (`UPDATE_ASSIGNMENTS`). Dos personas editando líneas distintas casi a la vez → el último mensaje pisaba el cambio del otro.

**Ahora:**
- Nuevo tipo en `SyncPayload` (`types.ts`): `{ type: 'PATCH_ASSIGNMENT'; payload: Assignment }`.
- `App.tsx` expone `patchAssignments(delta)`:
  ```ts
  const patchAssignments = (delta: Assignment) => {
    setAssignments(prev => ({ ...prev, ...delta })); // aplica local
    broadcast({ type: 'PATCH_ASSIGNMENT', payload: delta }); // difunde SOLO lo cambiado
  };
  ```
- Al recibir, hace **merge** (no replace):
  ```ts
  } else if (msg.type === 'PATCH_ASSIGNMENT') {
    isRemoteUpdate.current = true;
    setAssignments(prev => ({ ...prev, ...msg.payload }));
    setTimeout(() => isRemoteUpdate.current = false, 100);
  }
  ```
- El `useEffect` que difundía el objeto completo **se elimina**.
- `StepAssign` recibe la prop `patchAssignments` **en vez de** `setAssignments`. Todas las mutaciones (`toggleSimple`, `toggleUnit`, `resetGroup`) la usan, enviando solo las claves de unidad afectadas.
- Los que se unen a la sesión siguen recibiendo el estado completo vía `REQUEST_SYNC → SYNC_STATE` (sin cambios).

**Resultado:** líneas distintas editadas a la vez no se pisan; misma línea sigue siendo último-gana (decisión de producto aceptada).

### Cambio de firma de `StepAssign` (importante)

```tsx
// ANTES
setAssignments: React.Dispatch<React.SetStateAction<Assignment>>;
// AHORA
patchAssignments: (delta: Assignment) => void;
```

`App.tsx` ya monta `StepAssign` con la nueva prop:
```tsx
<StepAssign
  items={splitItems}
  setItems={setSplitItems}
  people={people}
  assignments={assignments}
  patchAssignments={patchAssignments}
  onNext={() => setStep(AppStep.RESULTS)}
  sessionId={sessionId}
  peerCount={peerCount}
/>
```

---

## Consistencia visual (ya alineada con el resto de steps)

El refactor reutiliza el lenguaje visual existente — **no introduce tokens ni colores nuevos**:
- **Paleta monocroma:** negro (`bg-black`/`text-black`), grises `zinc-*`, y los pasteles de `AVATAR_COLORS` solo en avatares. El banner de bloqueo usa `bg-zinc-100 / border-zinc-200 / text-zinc-500` (se corrigió una versión previa que usaba violeta fuera de marca).
- **Header sticky** con `bg-white/90 backdrop-blur-md border-b border-zinc-100`, barra de progreso negra — igual patrón que `StepPeople`/`StepUpload`.
- **Avatares:** `person.color` (clase Tailwind tipo `bg-[#ffadad] text-zinc-900`), iniciales con `getInitials(name)` (2 chars, mayúsculas).
- **Botón final:** componente `Button` compartido, deshabilitado hasta asignar todas las unidades.
- **Animaciones/utilidades:** `animate-fade-in` y `no-scrollbar` ya definidas en `index.html`.

### Estados de UI por item
- Punto de estado: verde (`bg-green-500`) = todas las unidades asignadas; ámbar (`bg-amber-400`) = parcial; gris (`bg-zinc-300`) = sin asignar.
- Desglose por persona del total: **colapsado por defecto** tras "Ver desglose por persona ▾" (evita ruido visual). Al desplegar, lista vertical avatar · nombre · importe.
- Indicador `{peerCount} online` (verde, con punto `animate-pulse`) cuando hay más de un participante.
- Botón **Invitar** (negro) con estado `Copiado!` al copiar el enlace `?session=...`.

---

## Verificación (pasos para el agente)

1. **Instala y compila:**
   ```bash
   npm install
   npx tsc --noEmit
   ```
   Resuelve errores de tipo contra el `types.ts` real del repo.

2. **Comprueba dependencias:**
   - `lucide-react` debe exportar: `Check, Users, ChevronDown, ChevronUp, Lock, Layers, CheckCircle, Share, Edit2, RotateCcw`. (En 0.460, presente en el importmap del repo, están todos.)
   - Confirma que `components/Button.tsx` acepta `className` y `disabled`. Si tu `Button` usa `fullWidth` (como en `StepUpload`), unifica: cambia `className="w-full h-14 text-base"` por `fullWidth` + clases de altura, según convención del repo.

3. **Prueba de humo de concurrencia** (`npm run dev`):
   - Sube un ticket → añade personas → llega al paso **Asignar**.
   - Copia la URL (`?session=XXXXX`) y ábrela en una **segunda pestaña**.
   - Asigna **líneas distintas** en cada pestaña a la vez → ambas deben persistir (no se pisan).
   - Caso pizza: en un item con cantidad > 1, abre "Repartir por unidades", asigna una unidad a una persona y otra a dos → el selector simple se bloquea y aparece "🔒 Por unidades" con los importes correctos.
   - Avanza a **Resultados** → verifica que los totales por persona cuadran.

4. **PR:**
   ```bash
   git checkout -b feature/reparto-robusto-deltas
   git add components/StepAssign.tsx App.tsx types.ts
   git commit -m "feat: reparto por unidades con invalidación + sincronización por deltas"
   git push -u origin feature/reparto-robusto-deltas
   ```
   Abre el PR contra `main` con un resumen que incluya las secciones A y B de este README.

---

## Archivos en este bundle

- `StepAssign.tsx` — componente de reparto refactorizado (producción).
- `App.tsx` — orquestador con `patchAssignments` + handler `PATCH_ASSIGNMENT` + broadcast del objeto completo eliminado.
- `types.ts` — `SyncPayload` con `PATCH_ASSIGNMENT`.
- `prototipo_Reparto_en_vivo.dc.html` — **referencia visual/interactiva** del comportamiento esperado (no se porta).
