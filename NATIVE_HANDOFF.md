# NATIVE_HANDOFF.md — Android e iOS (Capacitor)

Guía para compilar, ejecutar y publicar PagaMiPana como app nativa. Capacitor **envuelve el build web**
(`dist/`) en un WebView nativo; no es un reescritura, es la misma app React.

- **appId**: `com.pagamipana.app` · **appName**: `PagaMiPana` · **webDir**: `dist`
- Config: `capacitor.config.ts`. Plataformas: `android/`, `ios/` (commitear ambas).
- Plugins iOS vía **Swift Package Manager** (sin CocoaPods).

## Flujo de trabajo (cada vez que cambias el código web)
```bash
npm run cap:sync        # = npm run build + cap sync  (copia dist a android/ e ios/)
# luego abre y ejecuta:
npm run cap:android     # abre Android Studio
npm run cap:ios         # abre Xcode (solo macOS)
```
Regla de oro: **la app nativa sirve el `dist/` empaquetado**, así que cualquier cambio requiere
`build` + `sync`. Las variables `VITE_*` de `.env.local` se **incrustan en el build** (la publishable key
es pública, no pasa nada). Asegúrate de tener `.env.local` presente al hacer el build para nativo.

---

## Android
### Requisitos
- **Android Studio** (incluye SDK y JDK). Es el camino soportado (también en Linux).

### Ejecutar en desarrollo
1. `npm run cap:android` → abre Android Studio.
2. Selecciona un emulador o un dispositivo (con *Depuración USB* activada).
3. **Run** (▶).

### Permisos (antes de usar cámara en release)
- `android/app/src/main/AndroidManifest.xml`: el `<input capture>` del WebView suele funcionar sin permiso
  explícito, pero para captura fiable añade `<uses-permission android:name="android.permission.CAMERA"/>`.

### Release (Google Play)
- Genera un **keystore** de firma y configúralo en `android/app/build.gradle` (signingConfigs) o en Android Studio (Build → Generate Signed Bundle/APK → **AAB**).
- Sube el **.aab** a Google Play Console (cuenta de desarrollador, pago único ~25 $).

---

## iOS (en tu Mac)
### Requisitos
- **macOS + Xcode**. Nada de CocoaPods (SPM resuelve los plugins al abrir).

### Ejecutar en desarrollo
1. `npm install` (dependencias del repo recién descargado).
2. `npm run cap:ios` → abre Xcode.
3. En Xcode: proyecto **App** → **Signing & Capabilities** → elige tu **Team** (Apple ID) para firmar.
4. Elige simulador o iPhone (con modo desarrollador) → **Run** (▶).

### Permisos (antes de usar cámara en release)
- `ios/App/App/Info.plist`: añade `NSCameraUsageDescription` y `NSPhotoLibraryUsageDescription` con un texto
  explicativo (Apple rechaza sin ello).

### Release (App Store)
- Cuenta **Apple Developer** (~99 $/año). En Xcode: Product → Archive → distribuir a **TestFlight**/App Store.

---

## ⚠️ Pendiente clave: deep-links para el login nativo
En navegador, el login con **Google** y **magic-link** redirigen a `window.location.origin` y vuelven solos.
En **app nativa** el origin es `http://localhost` (o `capacitor://localhost`), así que el redirect de OAuth
**no vuelve a la app**. Hay que configurar **deep-links**. Mientras tanto, en nativo funciona el modo
**invitado** (`signInAnonymously`) y todo el reparto/proyectos en ese modo.

### Plan para implementarlo
1. **Instalar** `@capacitor/app` (y opcionalmente `@capacitor/browser`).
2. **Esquema/deep-link**:
   - Android: intent-filter con un esquema propio (p. ej. `com.pagamipana.app://auth`) o **App Links** (https verificado) en `AndroidManifest.xml`.
   - iOS: **URL Types** (Custom URL Scheme) en Xcode, o **Universal Links** (Associated Domains).
3. **Supabase → Authentication → URL Configuration**: añade el/los redirect nativos a *Redirect URLs*
   (además de `http://localhost:5173` y `https://www.pagamipana.com` que ya están).
4. **En `useAuth`** (detectar nativo con `Capacitor.isNativePlatform()`):
   - Pasar `redirectTo` = el esquema nativo en `signInWithOAuth` / `signInEmail`.
   - Escuchar `App.addListener('appUrlOpen', ...)`; al volver, extraer el `code`/tokens de la URL y completar
     la sesión (`supabase.auth.exchangeCodeForSession(url)` con el flujo PKCE).
5. **Google en nativo**: registrar las huellas (Android SHA-1/256) y el *reversed client id* (iOS URL type)
   en Google Cloud, o valorar `@capacitor/google-auth` / el flujo nativo de Supabase.
6. Para **magic-link** en móvil, considerar **OTP de 6 dígitos** (`verifyOtp`) en vez del enlace, que es más
   robusto que depender de que el enlace abra la app.

> Cuando se aborde, verificar en dispositivo real (los deep-links no siempre van en emulador/simulador).

---

## Otros pendientes nativos
- **Iconos y splash**: generar con `@capacitor/assets` a partir de un logo de origen.
- **Cámara nativa** (opcional): migrar el OCR de `<input capture>` a `@capacitor/camera` para mejor UX.
- **Barra de estado / safe areas**: revisar `@capacitor/status-bar` y paddings en notch.
