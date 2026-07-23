# Design Handoff — PagaMiPana (Proyectos + reparto por-ítem)

Handoff visual para el mockup de la evolución a "proyectos tipo Tricount + reparto por-ítem con OCR".
Mobile-first (destino Capacitor → iOS/Android). Ver `PLAN_PROYECTOS.md` para producto/arquitectura.

---

## 1. Personalidad de marca
- **Fintech amable, no banco frío.** El nombre es cercano y con guasa: cercano, redondeado, con aire,
  pero fiable (maneja dinero).
- Tono directo y en español coloquial ("Te deben", "Le debes a Ana", "Saldar cuentas").

## 2. Lenguaje visual
- **Color primario:** verde-teal fresco (dinero/positivo). Ej. `#0EA57A` (ajustable).
- **Tinta / texto:** casi-negro cálido `#1A1D1A`; secundario `#6B7280`.
- **Fondos:** blanco `#FFFFFF` + gris muy claro `#F5F6F5` para tarjetas/secciones.
- **Semántica de saldo:** "te deben" = verde primario; "debes" = coral/naranja cálido `#F0663F`.
- **Color por persona:** paleta de avatares (ya existe en la app) — es seña de identidad, se mantiene
  y se usa en ítems, gastos y balances.
- **Tipografía:** sans geométrica moderna (Inter / system-ui). Titulares en 600–700, cuerpo 400–500.
- **Forma:** radios generosos (12–20px en tarjetas, botones tipo pill), sombras suaves, mucho espacio.
- **Modo oscuro:** contemplar desde el diseño (tinta ↔ fondo se invierten).

## 3. Navegación
- **Nivel app:** pantalla "Mis proyectos" como home.
- **Nivel proyecto:** barra inferior nativa con: **Gastos** · **Balances** · **Ajustes**.
- Acción principal: **FAB "+"** que despliega dos vías: **Gasto manual** / **Escanear ticket**.

## 4. Pantallas del mockup
1. **Mis proyectos (home):** tarjetas por proyecto (nombre, tipo, stack de avatares, **tu saldo**
   grande y con color). Cabecera con avatar/CTA "Vincular cuenta" si el usuario es anónimo. FAB "Nuevo proyecto".
2. **Proyecto — Gastos:** cabecera con nombre + avatares; banda de balance ("En total te deben 24€");
   feed cronológico de gastos. Cada fila: icono **manual (✎)** o **ticket (🧾)**, descripción, importe,
   "pagó X", y mini-preview del reparto. FAB "+".
3. **Añadir gasto manual:** importe protagonista, descripción, selector "quién pagó", selector de
   reparto segmentado (**Igual · Partes · % · Exacto**), lista de participantes con su parte.
4. **Escanear ticket → reparto por-ítem:** lista de ítems del ticket; al tocar un ítem se asignan
   avatares de quién lo consumió (en vivo, concurrente). Contador de "sin asignar". Es el diferenciador
   → protagonismo visual. Al cerrar, se consolida en un gasto del proyecto.
5. **Saldar cuentas (Balances):** saldo neto por persona (barras/color), y lista optimizada
   "Ana paga a Luis 12€" con botón "Marcar como pagado".

## 5. Componentes reutilizables a mostrar
- Avatar (inicial + color por persona) y stack de avatares.
- Tarjeta de proyecto · fila de gasto · fila de ítem asignable · chip de reparto · píldora de saldo.
- Botón primario (pill), botón secundario/ghost, FAB, barra de navegación inferior.

## 6. Notas
- Todos los colores/marca son un punto de partida, fáciles de ajustar tras ver el mockup.
- El mockup es HTML autocontenido (Artifact) para poder tocarlo; no es el código final de producción.
