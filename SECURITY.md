# SECURITY.md — Endurecimiento

Estado de las medidas de seguridad. Lo marcado **[código]** ya está en el repo; lo marcado
**[tú]** requiere acción en una consola externa (Supabase / Cloudflare / AWS Lambda).

---

## 1. OCR Lambda autenticado con el JWT de Supabase
**[código]** `services/ocr.ts` ahora envía `Authorization: Bearer <access_token>` (token de la sesión
Supabase actual) en la petición al Lambda.

**[tú]** El Lambda (Python, en AWS) debe **verificar** ese token y rechazar (401) si falta o es inválido,
para que deje de ser un endpoint abierto. Ejemplo con PyJWT (verificación por JWKS, válida para las
claves asimétricas actuales de Supabase):

```python
import os, jwt
from jwt import PyJWKClient

SUPABASE_URL = os.environ["SUPABASE_URL"]          # https://jrosaurwxncfjpvquzzy.supabase.co
_jwks = PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")

def verify_supabase_jwt(auth_header: str) -> dict:
    if not auth_header or not auth_header.lower().startswith("bearer "):
        raise PermissionError("missing token")
    token = auth_header.split(" ", 1)[1]
    key = _jwks.get_signing_key_from_jwt(token).key
    # aud='authenticated' cubre también a los usuarios anónimos (es lo que queremos:
    # solo exigir un token válido emitido por Supabase, no bloquear invitados).
    # leeway=30: margen de reloj. PyJWT valida `iat`/`exp` sin tolerancia y un
    # desfase de segundos entre el reloj de Supabase y el del Lambda tumbaría
    # tokens recién emitidos (ImmatureSignatureError, "The token is not yet valid").
    return jwt.decode(
        token, key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
        leeway=30,
    )

# Si tu proyecto aún usa el secreto JWT clásico (HS256), en vez de lo anterior:
#   jwt.decode(token, os.environ["SUPABASE_JWT_SECRET"], algorithms=["HS256"],
#              audience="authenticated", leeway=30)
```
- En el handler: lee la cabecera `Authorization`, llama a `verify_supabase_jwt`; si lanza, responde **401**.
- Variables del Lambda: `SUPABASE_URL` (y `SUPABASE_JWT_SECRET` solo si usas HS256). **Nunca** en el frontend.
- **Margen de reloj**: mantén `leeway=30` (y no lo bajes). Sin margen, cualquier desfase entre el
  reloj del Lambda y el de Supabase rechaza tokens válidos justo después del login — el mismo
  fallo que PostgREST reporta como `JWT issued at future` (mitigado en el cliente con
  `withJwtRetry` en `services/supabaseClient.ts`).
- **CORS**: restringe a `https://www.pagamipana.com` y `http://localhost:5173` (en vez de `*`).
- Opcional: límite de tamaño de imagen y throttling en el Lambda.

---

## 2. CAPTCHA (Cloudflare Turnstile)
**[código]** Integrado y **env-gated** por `VITE_TURNSTILE_SITE_KEY` (`components/Turnstile.tsx`,
usado en `LoginScreen` para *invitado* y *magic-link*). Si no hay clave, no se renderiza y la auth va sin
captcha. `useAuth.continueAsGuest`/`signInEmail` aceptan y envían `captchaToken`.

**[tú]** Activarlo:
1. **Cloudflare** → Turnstile → crea un widget → obtén **Site Key** y **Secret Key**.
2. **Frontend**: pon `VITE_TURNSTILE_SITE_KEY=<site key>` en `.env.production` (y en `.env.local` para dev
   — puedes usar la *test key* de Cloudflare `1x00000000000000000000AA`, que siempre pasa).
3. **Supabase** → Authentication → *Bot & Abuse Protection* (CAPTCHA) → habilita, proveedor **Turnstile**,
   pega la **Secret Key**.
> ⚠️ Dev y prod comparten el mismo proyecto Supabase: al activar CAPTCHA se exige **también en dev**, por eso
> conviene tener una site key (aunque sea de prueba) en `.env.local`.
> Cubre invitado + magic-link. Google (OAuth) no usa captchaToken (redirige al proveedor).

---

## 3. Rate limits (Supabase)
**[tú]** Supabase → Authentication → **Rate Limits**: ajusta los límites por hora (OTP/magic-link, signups,
anónimos, refresh de token). Hay valores por defecto; endurécelos según el tráfico esperado.

---

## 4. Limpieza de usuarios anónimos
**[código]** Migración `supabase/migrations/0008_cleanup_anon.sql`: función `cleanup_anonymous_users()`
que borra anónimos de >30 días **sin datos** (0 proyectos, 0 participaciones) + tarea diaria con `pg_cron`.

**[tú]** Ejecuta la `0008` en el SQL Editor (si `create extension pg_cron` falla, actívalo antes en
Dashboard → Database → Extensions). Prueba manual: `select public.cleanup_anonymous_users();`

---

## 5. Flujo legacy retirado
**[código]** Eliminados `App.tsx`, `components/Step*.tsx`, `services/geminiService.ts`, y las dependencias
`mqtt` y `@google/genai`. Ya **no** hay datos financieros viajando por el broker público de HiveMQ.

---

## Base ya sólida (recordatorio)
- **RLS** por membresía (`is_project_member`) aísla los datos entre proyectos.
- Solo la **publishable key** (pública) va en el frontend; la *secret* nunca está en el repo.
- RPCs `SECURITY DEFINER` validan `auth.uid()`/membresía; los de lectura son `INVOKER` (respetan RLS).
- Sin XSS (React escapa; no hay `dangerouslySetInnerHTML`). OAuth con PKCE y redirect URLs en lista blanca.

## Endurecimiento opcional (futuro)
- Cabeceras de seguridad en CloudFront/host (CSP, `X-Content-Type-Options`, `Referrer-Policy`).
- Roles en proyectos (solo-lectura / admin) y poder expulsar miembros o rotar el enlace de invitación.
