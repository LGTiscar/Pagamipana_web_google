import type { Archetype, ArchetypeParams } from './core/archetypes'
import type { Footprint } from './core/iso'
import { deriveArchetype, deriveHeight, deriveSize, type LayoutInput, type Measure, packLayout } from './core/layout'
import type { ArchEdge, ArchFlow, ArchNode, Group } from './core/types'
import type { ArchitectureData } from './components/ArchitectureMap'
import { MEASURED, UNCLAIMED } from './measured.generated'

/**
 * El contenido del mapa: los barrios, los módulos, los caminos reales entre
 * ellos y los flujos que se pueden reproducir.
 *
 * Aquí se escribe a mano lo que ningún escáner puede saber — qué es cada cosa,
 * para qué está y por dónde viaja el dinero. La geometría (forma, altura y
 * sitio de cada edificio) sale de la medición del repo, así que el skyline se
 * reproporciona solo cuando el código se mueve.
 */

export const GROUPS: Group[] = [
  {
    id: 'entry', label: 'Entrada y sesión',
    blurb:
      'Todo lo que pasa antes de ver un gasto: quién eres, cómo entras y por dónde. Aquí vive la ' +
      'decisión de que se pueda [[entrar sin cuenta]] y ascender después, que es la que explica media ' +
      'app — participantes sin perfil incluidos.',
  },
  {
    id: 'app', label: 'Pantallas',
    blurb:
      'La interfaz: la lista de proyectos, el proyecto abierto con sus tres pestañas, el escáner de ' +
      'tickets y el reparto rápido. Ninguna habla con la red directamente; todas pasan por los ' +
      'servicios del cliente.',
  },
  {
    id: 'svc', label: 'Servicios del cliente',
    blurb:
      'La capa que traduce lo que quiere una pantalla en una llamada concreta. Es el único sitio que ' +
      'sabe que detrás hay Supabase y un Lambda, y el único que decide qué hacer cuando algo falla.',
  },
  {
    id: 'db', label: 'Supabase: RPCs y datos',
    blurb:
      'El backend: funciones que escriben en una transacción y políticas que deciden quién ve qué. ' +
      'La lógica sensible vive aquí a propósito — [[el cliente no escribe tablas]] —, así que el ' +
      'esquema y las migraciones son parte del diseño, no un detalle de infraestructura.',
  },
  {
    id: 'out', label: 'Fuera de casa',
    blurb:
      'Lo que no es código de este repo pero sin lo cual la app no funciona: el OCR en Lambda, los ' +
      'proveedores de acceso, el captcha y la entrega. Son planchas bajas porque no se miden en ' +
      'líneas: se configuran en consolas ajenas, así que su estado no se puede leer en este repo.',
  },
]

/** Lo autorado. La geometría se rellena abajo salvo que aquí se fije a mano. */
type Authored = Omit<ArchNode, 'archetype' | 'params' | 'footprint' | 'height' | 'count' | 'loc'> & {
  archetype?: Archetype
  params?: ArchetypeParams
  footprint?: Footprint
  height?: number
}

const AUTHORED: Authored[] = [
  {
    id: 'shell', code: 'SH', name: 'AppShell', role: 'el portero del estado', group: 'entry',
    whatItDoes:
      'Decide qué pantalla ve el usuario. No hay router: unos pocos estados — modo rápido, ' +
      'sesión, invitación pendiente, proyecto abierto — se resuelven en cascada y se pinta el ' +
      'primero que encaja.',
    howItsBuilt:
      'La invitación de `?join=` se guarda en [[sessionStorage]] antes de cualquier login, porque ' +
      'el redirect de OAuth se lleva la query por delante y sin eso el enlace se perdía justo al ' +
      'crear la cuenta.',
    files: ['AppShell.tsx', 'index.tsx'],
    stack: ['React 18', 'Vite', 'TypeScript'],
  },
  {
    id: 'auth', code: 'AU', name: 'Identidad híbrida', role: 'la puerta de la sesión', group: 'entry',
    whatItDoes:
      'Un solo hook con toda la identidad: entrar como invitado, ascender a cuenta con Google, ' +
      'Apple o magic-link, y fijar el nombre visible.',
    howItsBuilt:
      'El invitado es un usuario anónimo de verdad, así que ascender es [[linkIdentity]] y no una ' +
      'migración de datos. Si ese email ya tenía cuenta, en vez de fallar al vincular inicia ' +
      'sesión en ella.',
    files: ['hooks/useAuth.ts'],
    stack: ['supabase-js', 'Supabase Auth'],
  },
  {
    id: 'login', code: 'LI', name: 'Acceso y ascenso', role: 'el mostrador de entrada', group: 'entry',
    whatItDoes:
      'La pantalla de entrada — Google, Apple, magic-link o probar sin cuenta — y la hoja que ' +
      'invita a un invitado a dejar de serlo.',
    howItsBuilt:
      'El captcha está [[env-gated]]: sin VITE_TURNSTILE_SITE_KEY el widget no se renderiza y la auth ' +
      'sigue funcionando, para que un entorno sin claves no se quede sin login. En producción la clave ' +
      'está puesta, así que ahí sí se exige.',
    files: ['components/LoginScreen.tsx', 'components/Turnstile.tsx', 'components/LinkAccountSheet.tsx'],
    stack: ['Cloudflare Turnstile'],
  },
  {
    id: 'join', code: 'JN', name: 'Invitación y unión', role: 'el enlace que te mete', group: 'entry',
    whatItDoes:
      'Genera el QR y el enlace del proyecto, y al otro lado recibe a quien lo abre: puede ' +
      'reclamar un participante que ya existía sin cuenta, o entrar como alguien nuevo.',
    howItsBuilt:
      'Reclamar existe porque medio grupo se apunta sin cuenta: [[claim_participant]] vincula tu ' +
      'perfil a esa fila en vez de duplicar a la persona con otro nombre y partir sus deudas en dos.',
    files: ['components/JoinScreen.tsx', 'components/InvitePanel.tsx'],
    stack: ['qrcode.react'],
  },
  {
    id: 'home', code: 'HO', name: 'Mis proyectos', role: 'la lista y el alta', group: 'app',
    whatItDoes:
      'La portada: cada proyecto con su saldo, su gente y sus avatares, más el alta de uno nuevo y ' +
      'el paso siguiente para meter a los panas.',
    howItsBuilt:
      'Pide un [[resumen]] por RPC en vez de traerse los gastos y calcular en el cliente, así que ' +
      'un proyecto de mil gastos pesa lo mismo en la portada que uno de tres.',
    files: ['components/HomeProjects.tsx', 'components/CreateProjectSheet.tsx', 'components/ProjectPeopleStep.tsx'],
  },
  {
    id: 'project', code: 'PR', name: 'El proyecto abierto', role: 'donde se mete el dinero', group: 'app',
    whatItDoes:
      'Tres pestañas — Gastos, Balances y Miembros — y la hoja para añadir o editar un gasto con ' +
      'su reparto.',
    howItsBuilt:
      'Las tres pestañas viven en un componente porque comparten la misma carga (participantes, ' +
      'gastos y balances); separarlas obligaba a recargar en cada salto. Es el fichero más gordo ' +
      'del repo y se nota: el mapa lo dibuja alto por eso.',
    files: ['components/ProjectDetail.tsx', 'components/AddExpenseSheet.tsx'],
  },
  {
    id: 'quick', code: 'QS', name: 'Reparto rápido', role: 'el modo sin cuenta', group: 'app',
    whatItDoes:
      'Reparte un ticket entre amigos sin cuenta, sin proyecto y sin guardar nada: foto, asignar y ' +
      'compartir el resultado como texto.',
    howItsBuilt:
      'Es [[efímero]] a propósito — vive en el estado del componente y no toca Supabase — porque ' +
      'es el escaparate: se enseña lo que hace la app antes de pedirle a nadie que se registre.',
    files: ['components/QuickSplit.tsx'],
  },
  {
    id: 'scanner', code: 'SC', name: 'Escáner y asignador', role: 'el reparto por ítem', group: 'app',
    whatItDoes:
      'Toma la foto del ticket y deja repartirlo línea a línea, o unidad a unidad: dos de las tres ' +
      'cervezas son mías. También corrige lo que el OCR entendió mal — nombre, cantidad, precio, ' +
      'borrar y añadir líneas.',
    howItsBuilt:
      'El asignador trabaja sobre [[unidades]] y no sobre líneas: cada unidad lleva su propia lista ' +
      'de dueños, que es lo que permite ser fiel a "dos de tres" sin inventarse precios unitarios.',
    files: ['components/ScanExpenseSheet.tsx', 'components/ItemAssigner.tsx'],
  },
  {
    id: 'kit', code: 'UI', name: 'Piezas compartidas', role: 'el cajón común', group: 'app',
    whatItDoes:
      'El interruptor de tema con su hook y el logo de Apple, que se esconde solo si el proveedor ' +
      'no está configurado.',
    howItsBuilt:
      '[[Button.tsx y Logo.tsx no los importa nadie]]: quedaron del diseño anterior. El mapa los ' +
      'enseña precisamente para que no se olvide que sobran.',
    files: ['components/ThemeToggle.tsx', 'hooks/useTheme.ts', 'components/AppleLogo.tsx', 'components/Button.tsx', 'components/Logo.tsx'],
  },
  {
    id: 'client', code: 'CL', name: 'Cliente Supabase', role: 'el transporte', group: 'svc',
    whatItDoes:
      'Crea el cliente que usa toda la app y envuelve cada llamada para que un JWT en mal momento ' +
      'no deje la pantalla vacía.',
    howItsBuilt:
      '[[withJwtRetry]] separa dos fallos que se parecen: si el iat del token va por delante del ' +
      'reloj que lo valida, espera y reintenta el mismo token (refrescarlo lo empeoraría); si está ' +
      'caducado, pide uno nuevo y reintenta.',
    files: ['services/supabaseClient.ts'],
    stack: ['supabase-js'],
  },
  {
    id: 'projectsSvc', code: 'PJ', name: 'API de proyectos', role: 'proyectos y gente', group: 'svc',
    whatItDoes:
      'Todo lo que se pide sobre proyectos y participantes: el resumen de la portada, crear, ' +
      'unirse, reclamar, salir y archivar.',
    howItsBuilt:
      'Nada escribe tablas a pelo: cada operación es un [[RPC]] atómico. Crear un proyecto sin ' +
      'añadir al creador como participante dejaría un proyecto que su propio dueño no puede ver, ' +
      'porque RLS mira la tabla de participantes.',
    files: ['services/projects.ts'],
  },
  {
    id: 'expensesSvc', code: 'EG', name: 'API de gastos', role: 'gastos y saldos', group: 'svc',
    whatItDoes:
      'Gastos, partes, líneas de ticket, balances y liquidaciones. También propone quién paga a ' +
      'quién con el mínimo de transferencias.',
    howItsBuilt:
      'Ese reparto mínimo ([[computeSettlements]]) se calcula en el cliente con un greedy: es ' +
      'aritmética sobre cuatro saldos, no merece un viaje al servidor.',
    files: ['services/expenses.ts'],
  },
  {
    id: 'ocrPipeline', code: 'OC', name: 'Foto a texto', role: 'el puente con el OCR', group: 'svc',
    whatItDoes:
      'Normaliza la foto del ticket y la manda al servicio de OCR: HEIC a JPEG, reescalado y ' +
      'base64; de vuelta, las líneas del ticket.',
    howItsBuilt:
      'heic2any se carga con [[import dinámico]] solo cuando la foto lo pide, y hay plan B: si la ' +
      'conversión falla se intenta la decodificación nativa, que en Safari funciona.',
    files: ['services/ocr.ts', 'services/imageProcessor.ts'],
    stack: ['heic2any', 'AWS Lambda'],
  },
  {
    id: 'split', code: 'SP', name: 'Reparto por unidades', role: 'la aritmética del reparto', group: 'svc',
    whatItDoes:
      'Cuánto le toca a cada uno cuando una línea del ticket se parte en unidades con dueños ' +
      'distintos, y qué queda sin asignar.',
    howItsBuilt:
      'Es un módulo [[puro]], sin React ni red, reutilizado por el escáner, la edición de un ' +
      'ticket y el reparto rápido: los tres reparten igual porque reparten aquí.',
    files: ['services/itemSplit.ts'],
  },
  {
    id: 'model', code: 'MD', name: 'Tipos y formato', role: 'el vocabulario común', group: 'svc',
    whatItDoes:
      'Los tipos que cruzan toda la app, el formato del dinero y la lista de monedas.',
    howItsBuilt:
      'Las monedas salen de [[Intl]] (ISO 4217) en vez de una lista a mano, y los colores de avatar ' +
      'son clases literales porque Tailwind solo genera lo que ve escrito en el código.',
    files: ['types.ts', 'services/format.ts', 'services/currencies.ts'],
  },
  {
    id: 'gotrue', code: 'GT', name: 'Supabase Auth', role: 'quien firma el JWT', group: 'db',
    whatItDoes:
      'Emite el token con el que viaja todo lo demás: usuarios anónimos, Google, Apple y ' +
      'magic-link, y lo refresca en segundo plano.',
    howItsBuilt:
      'No es código de este repo. Lo único propio que cuelga de él es el trigger ' +
      '[[on_auth_user_created]], que crea el perfil en cuanto aparece el usuario para que ninguna ' +
      'pantalla tenga que comprobar si existe.',
    files: [],
    stack: ['Supabase Auth (GoTrue)'],
  },
  {
    id: 'schema', code: 'DB', name: 'Esquema y RLS', role: 'las reglas de quién ve qué', group: 'db',
    whatItDoes:
      'Las tablas base — perfiles, proyectos y participantes — y las políticas que deciden quién ' +
      'puede ver y tocar cada fila.',
    howItsBuilt:
      'Todas las políticas cuelgan de [[is_project_member]], una función SECURITY DEFINER: sin ' +
      'ella, la política de participantes tendría que consultar la propia tabla de participantes y ' +
      'RLS se muerde la cola.',
    files: ['supabase/migrations/0001_init.sql'],
    stack: ['Postgres', 'RLS'],
  },
  {
    id: 'expensesRpc', code: 'RG', name: 'RPCs de gastos', role: 'la escritura atómica', group: 'db',
    whatItDoes:
      'Crear, editar y borrar gastos con sus partes y las líneas del ticket, cada cosa en una sola ' +
      'transacción.',
    howItsBuilt:
      'expense_shares es la fuente canónica de los balances y se regenera entera al editar. Las ' +
      '[[units jsonb]] guardan el reparto fiel por unidad y son retrocompatibles: los tickets ' +
      'viejos las tienen a NULL y siguen cuadrando.',
    files: [
      'supabase/migrations/0002_expenses.sql',
      'supabase/migrations/0005_expense_items.sql',
      'supabase/migrations/0009_edit_expense.sql',
      'supabase/migrations/0010_item_units.sql',
    ],
  },
  {
    id: 'membership', code: 'ME', name: 'Miembros e invitaciones', role: 'entrar, salir y nombrarse', group: 'db',
    whatItDoes:
      'Unirse por enlace, reclamar un participante sin cuenta, salir del proyecto y cambiar el ' +
      'nombre visible en todos los proyectos a la vez.',
    howItsBuilt:
      'Salir solo se permite [[sin huella económica]] y a quien no creó el proyecto: si alguien pagó ' +
      'algo o tiene partes, quitarlo descuadraría las cuentas de los demás. Borrar el proyecto es ' +
      'cosa del creador, y eso lo impone RLS.',
    files: [
      'supabase/migrations/0003_join.sql',
      'supabase/migrations/0011_claim_participant.sql',
      'supabase/migrations/0012_leave_and_personal_archive.sql',
      'supabase/migrations/0013_update_my_name.sql',
    ],
  },
  {
    id: 'balances', code: 'BA', name: 'Resumen y balances', role: 'los números que se leen', group: 'db',
    whatItDoes:
      'El resumen por proyecto de la portada, los saldos por persona y las liquidaciones que ' +
      'reducen la deuda.',
    howItsBuilt:
      'Archivar es [[personal]]: una fila por (proyecto, usuario) en vez de una columna en el ' +
      'proyecto, porque un pana quiere quitarse un viaje de la vista sin esconderlo a los demás. ' +
      'La columna vieja quedó obsoleta.',
    files: [
      'supabase/migrations/0004_overview.sql',
      'supabase/migrations/0006_settlements.sql',
      'supabase/migrations/0007_archive.sql',
    ],
  },
  {
    id: 'cron', code: 'CR', name: 'Limpieza programada', role: 'el barrendero', group: 'db',
    whatItDoes:
      'Un trabajo diario a las tres de la mañana que borra los invitados anónimos que no dejaron ' +
      'nada detrás.',
    howItsBuilt:
      'Vive en [[pg_cron]], dentro de la propia base, así que no hay servidor que mantener ni nadie a ' +
      'quien despertar: la tarea está programada y corriendo en producción.',
    files: ['supabase/migrations/0008_cleanup_anon.sql'],
    stack: ['pg_cron'],
  },
  {
    id: 'lambda', code: 'LB', name: 'OCR en Lambda', role: 'quien lee el ticket', group: 'out',
    whatItDoes:
      'Recibe la foto en base64 y devuelve las líneas del ticket: descripción, cantidad y precio.',
    howItsBuilt:
      'Convive con Supabase en vez de ser una Edge Function porque ya existía y lee tickets bien. ' +
      'Ya no es un endpoint abierto: [[verifica el JWT]] que la app le manda en la cabecera contra el ' +
      'JWKS de Supabase, así que solo responde a sesiones reales — las de invitado incluidas.',
    files: ['SECURITY.md'],
    stack: ['AWS Lambda', 'eu-north-1'],
  },
  {
    id: 'oauth', code: 'OA', name: 'Google y Apple', role: 'los proveedores', group: 'out',
    whatItDoes:
      'El acceso con cuenta de Google o de Apple, y la vuelta a la app con la sesión ya hecha.',
    howItsBuilt:
      'La vuelta apunta a [[window.location.origin]], que empaquetado todavía no resuelve a la app: ' +
      'falta el deep-link en Android e iOS, y por eso en nativo el modo invitado es el que funciona.',
    files: ['NATIVE_HANDOFF.md'],
  },
  {
    id: 'captcha', code: 'CF', name: 'Turnstile', role: 'el filtro de abuso', group: 'out',
    whatItDoes:
      'El captcha de Cloudflare que se interpone en las dos vías baratas de crear cuentas: ' +
      'invitado y magic-link.',
    howItsBuilt:
      'Está activo: el token viaja dentro de la llamada de auth y lo valida Supabase con la secret ' +
      'key, así que el navegador nunca ve ese secreto. Apple queda fuera a propósito, como vía a ' +
      'prueba de bloqueadores.',
    files: ['SECURITY.md'],
    stack: ['Cloudflare Turnstile'],
  },
  {
    id: 'delivery', code: 'DL', name: 'Entrega', role: 'cómo llega a la gente', group: 'out',
    whatItDoes:
      'El mismo build servido de dos maneras: la web en AWS Amplify y la app empaquetada con ' +
      'Capacitor para Android e iOS.',
    howItsBuilt:
      '[[dist/ es el único artefacto]]: Capacitor copia esa misma carpeta al proyecto nativo, así ' +
      'que no hay dos versiones de la interfaz que mantener a la vez.',
    files: ['capacitor.config.ts', 'vite.config.ts'],
    stack: ['AWS Amplify', 'Capacitor 8', 'Vite'],
  },
]

/* ------------------------------------------------------- geometría medida */

const measureOf = (id: string): Measure => MEASURED[id] ?? { count: 0, loc: 0 }

const shaped = AUTHORED.map((node) => {
  const measure = measureOf(node.id)
  const shape = node.archetype
    ? { archetype: node.archetype, params: node.params }
    : deriveArchetype(measure)
  return { node, measure, ...shape }
})

const packed = packLayout<string>(
  shaped.map<LayoutInput<string>>(({ node, measure, archetype, params }) => ({
    item: node.id,
    group: node.group,
    size: deriveSize(archetype, params, measure),
  })),
  GROUPS.map((g) => g.id),
)

export const NODES: ArchNode[] = shaped.map(({ node, measure, archetype, params }) => ({
  ...node,
  archetype,
  params,
  // Si alguien afinó a mano un sitio o una altura, gana sobre lo derivado.
  footprint: node.footprint ?? packed.get(node.id)!,
  height: node.height ?? deriveHeight(measure),
  count: measure.count,
  loc: measure.loc,
}))

/* ------------------------------------------------------------- caminos */

// Solo caminos que existen en el código: cada arista se puede señalar con el
// dedo en un import o en una llamada. Los `via` son pasillos a media celda —
// las fachadas caen en enteros — para que ninguna línea atraviese un edificio
// que no es ni su origen ni su destino.

export const EDGES: ArchEdge[] = [
  { id: 'dl-shell', from: 'delivery', to: 'shell', kind: 'support', label: 'bundle de dist/', via: [{ gx: 3.5, gy: 2.5 }], flowIds: [] },
  { id: 'shell-auth', from: 'shell', to: 'auth', kind: 'call', label: 'sesión actual', flowIds: [] },
  { id: 'shell-login', from: 'shell', to: 'login', kind: 'call', label: 'sin sesión', flowIds: ['entrar'] },
  { id: 'login-captcha', from: 'login', to: 'captcha', kind: 'call', label: 'token de captcha', via: [{ gx: -0.5, gy: 28.5 }], flowIds: ['entrar'] },
  { id: 'login-auth', from: 'login', to: 'auth', kind: 'call', label: 'credenciales', via: [{ gx: 1.5, gy: 2.5 }], flowIds: ['entrar'] },
  { id: 'auth-gotrue', from: 'auth', to: 'gotrue', kind: 'call', label: 'alta o acceso', via: [{ gx: 5.5, gy: 5.5 }], flowIds: ['entrar'] },
  { id: 'gotrue-schema', from: 'gotrue', to: 'schema', kind: 'data', label: 'perfil nuevo', flowIds: ['entrar'] },
  { id: 'auth-oauth', from: 'auth', to: 'oauth', kind: 'call', label: 'redirect y vuelta', flowIds: [] },
  { id: 'auth-client', from: 'auth', to: 'client', kind: 'support', label: 'cliente y JWT', via: [{ gx: 2.5, gy: 5.5 }], flowIds: [] },
  { id: 'auth-membership', from: 'auth', to: 'membership', kind: 'call', label: 'update_my_name', flowIds: [] },
  { id: 'shell-home', from: 'shell', to: 'home', kind: 'call', label: 'con sesión', flowIds: ['proyectos'] },
  { id: 'home-projects', from: 'home', to: 'projectsSvc', kind: 'call', label: 'listProjectsOverview', via: [{ gx: 5.5, gy: 5.5 }], flowIds: ['proyectos'] },
  { id: 'projects-client', from: 'projectsSvc', to: 'client', kind: 'support', label: 'withJwtRetry', flowIds: ['proyectos'] },
  { id: 'projects-balances', from: 'projectsSvc', to: 'balances', kind: 'call', label: 'resumen por proyecto', via: [{ gx: 5.5, gy: 17.5 }], flowIds: ['proyectos'] },
  { id: 'projects-schema', from: 'projectsSvc', to: 'schema', kind: 'call', label: 'create_project · participantes', flowIds: [] },
  { id: 'projects-membership', from: 'projectsSvc', to: 'membership', kind: 'call', label: 'unirse · reclamar · salir', flowIds: ['unirse'] },
  { id: 'home-kit', from: 'home', to: 'kit', kind: 'support', label: 'interruptor de tema', flowIds: [] },
  { id: 'login-kit', from: 'login', to: 'kit', kind: 'support', label: 'logo de Apple', flowIds: [] },
  { id: 'home-model', from: 'home', to: 'model', kind: 'support', label: 'monedas ISO', via: [{ gx: 9.5, gy: 13.5 }], flowIds: [] },
  { id: 'shell-project', from: 'shell', to: 'project', kind: 'call', label: 'proyecto abierto', flowIds: ['saldos'] },
  { id: 'project-expenses', from: 'project', to: 'expensesSvc', kind: 'call', label: 'gastos y balances', flowIds: ['saldos'] },
  { id: 'project-projects', from: 'project', to: 'projectsSvc', kind: 'call', label: 'participantes', via: [{ gx: 5.5, gy: 5.5 }], flowIds: [] },
  { id: 'project-model', from: 'project', to: 'model', kind: 'support', label: 'moneda y tipos', via: [{ gx: 9.5, gy: 13.5 }], flowIds: [] },
  { id: 'expenses-client', from: 'expensesSvc', to: 'client', kind: 'support', label: 'withJwtRetry', flowIds: [] },
  { id: 'expenses-balances', from: 'expensesSvc', to: 'balances', kind: 'call', label: 'get_balances · liquidar', via: [{ gx: 9.5, gy: 17.5 }], flowIds: ['saldos'] },
  { id: 'expenses-rpc', from: 'expensesSvc', to: 'expensesRpc', kind: 'call', label: 'add_expense · add_ocr_expense', flowIds: ['ticket'] },
  { id: 'project-scanner', from: 'project', to: 'scanner', kind: 'call', label: 'abrir el escáner', flowIds: ['ticket'] },
  { id: 'project-join', from: 'project', to: 'join', kind: 'call', label: 'invitar (QR y enlace)', flowIds: ['unirse'] },
  { id: 'shell-join', from: 'shell', to: 'join', kind: 'call', label: 'invitación pendiente', flowIds: ['unirse'] },
  { id: 'join-projects', from: 'join', to: 'projectsSvc', kind: 'call', label: 'unirse o reclamar', flowIds: ['unirse'] },
  { id: 'scanner-ocr', from: 'scanner', to: 'ocrPipeline', kind: 'call', label: 'foto del ticket', via: [{ gx: 2.5, gy: 13.5 }], flowIds: ['ticket'] },
  { id: 'ocr-lambda', from: 'ocrPipeline', to: 'lambda', kind: 'call', label: 'JPEG en base64 + JWT', flowIds: ['ticket', 'rapido'] },
  { id: 'ocr-client', from: 'ocrPipeline', to: 'client', kind: 'support', label: 'access_token', flowIds: [] },
  { id: 'scanner-split', from: 'scanner', to: 'split', kind: 'call', label: 'unidades y partes', via: [{ gx: 5.5, gy: 13.5 }], flowIds: ['ticket'] },
  { id: 'scanner-expenses', from: 'scanner', to: 'expensesSvc', kind: 'call', label: 'addOcrExpense', flowIds: ['ticket'] },
  { id: 'shell-quick', from: 'shell', to: 'quick', kind: 'call', label: 'modo sin cuenta', flowIds: ['rapido'] },
  { id: 'quick-scanner', from: 'quick', to: 'scanner', kind: 'support', label: 'reutiliza el asignador', flowIds: ['rapido'] },
  { id: 'quick-ocr', from: 'quick', to: 'ocrPipeline', kind: 'call', label: 'foto del ticket', via: [{ gx: 2.5, gy: 13.5 }], flowIds: ['rapido'] },
  { id: 'quick-split', from: 'quick', to: 'split', kind: 'call', label: 'reparto y totales', via: [{ gx: 5.5, gy: 13.5 }], flowIds: ['rapido'] },
  { id: 'cron-schema', from: 'cron', to: 'schema', kind: 'data', label: 'invitados huérfanos', flowIds: [] },
]

/* ------------------------------------------------------------- flujos */

export const FLOWS: ArchFlow[] = [
  {
    id: 'entrar', name: 'Entrar', payload: 'sesión',
    summary: 'De la pantalla de acceso a tener token y perfil, sea como invitado o con cuenta.',
    route: ['shell-login', 'login-captcha', 'login-auth', 'auth-gotrue', 'gotrue-schema'],
  },
  {
    id: 'proyectos', name: 'Ver mis proyectos', payload: 'resumen de proyectos',
    summary: 'Lo que ocurre al abrir la portada — y el camino donde se notó el fallo del JWT.',
    route: ['shell-home', 'home-projects', 'projects-client', 'projects-balances'],
  },
  {
    id: 'ticket', name: 'Escanear un ticket', payload: 'líneas del ticket',
    summary: 'Una foto acaba siendo un gasto repartido unidad por unidad.',
    route: ['project-scanner', 'scanner-ocr', 'ocr-lambda', 'scanner-split', 'scanner-expenses', 'expenses-rpc'],
  },
  {
    id: 'saldos', name: 'Cuadrar cuentas', payload: 'saldo por persona',
    summary: 'Quién debe a quién, y el pago que borra la deuda.',
    route: ['shell-project', 'project-expenses', 'expenses-balances'],
  },
  {
    id: 'unirse', name: 'Invitar a un pana', payload: 'invitación',
    summary: 'Un enlace o un QR mete a alguien al proyecto, incluso si ya estaba como participante sin cuenta.',
    route: ['project-join', 'shell-join', 'join-projects', 'projects-membership'],
  },
  {
    id: 'rapido', name: 'Reparto rápido', payload: 'reparto efímero',
    summary: 'Repartir un ticket sin cuenta, sin proyecto y sin guardar nada.',
    route: ['shell-quick', 'quick-ocr', 'ocr-lambda', 'quick-scanner', 'quick-split'],
  },
]

export const INTRO = {
  title: 'PagaMiPana',
  lede: 'Dividir cuentas entre panas: proyectos persistentes y reparto por ítem con OCR.',
  whatItDoes:
    'Una SPA de React que guarda todo en Supabase y llama a un OCR propio para leer tickets. ' +
    'Cada proyecto es un grupo de gente con gastos, y lo que la distingue de un Tricount es que ' +
    'un ticket se puede repartir unidad por unidad.',
  howItsBuilt:
    'Dos decisiones explican casi todo el mapa. Una: el cliente no escribe tablas, llama a RPCs ' +
    'atómicos y RLS decide quién ve qué, así que la lógica sensible vive en la base. Dos: la ' +
    'identidad es híbrida — se entra sin cuenta y se asciende después sin perder nada — y de ahí ' +
    'salen los participantes sin perfil, reclamar por enlace y la limpieza nocturna de invitados.',
}

export const ARCHITECTURE: ArchitectureData = {
  groups: GROUPS,
  nodes: NODES,
  edges: EDGES,
  flows: FLOWS,
  intro: INTRO,
  unmapped: UNCLAIMED,
  repo: 'pagamipana',
}
