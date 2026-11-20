# Carga Académica · Versión móvil (Android)

Sistema de carga y evaluación docente desarrollado con **SvelteKit 5** y empaquetado como
aplicación nativa de Android con el framework **Capacitor 8**.

| Requisito del docente | Cómo se cumple |
| --- | --- |
| Versión móvil | Interfaz rediseñada para celular: barra superior tipo app, barra de navegación inferior, menú lateral, tablas convertidas en tarjetas, formularios como hoja inferior (bottom sheet), zonas seguras (notch / barra de gestos). |
| Mediante el framework Capacitor | `@capacitor/core`, `@capacitor/cli` y `@capacitor/android` v8 + plugins oficiales (`app`, `splash-screen`, `keyboard`, `filesystem`, `share`, `file-viewer`). Configuración en `capacitor.config.json`, proyecto nativo en `android/`. |
| Debe generar un APK | `npm run android:apk` (local) o automáticamente con GitHub Actions (`.github/workflows/android-apk.yml`). |
| Instalado en el celular al probar | Ver la sección **Instalar el APK en el celular**. |

---

## ¿Qué tiene la app móvil?

- **Pantalla de inicio de sesión** con diseño de app (cabecera institucional + tarjeta).
- **Inicio personalizado**: saludo según la hora, rol del usuario y módulos en cuadrícula.
- **Barra inferior** con los accesos más usados según los permisos del rol, y botón **Menú**.
- **Menú lateral** con todos los módulos permitidos, perfil y cierre de sesión.
- **Tablas → tarjetas** en el celular (Usuarios, Carga docente, Estructura académica, Grupos).
- **Formularios** que se abren desde abajo como en las apps nativas.
- **Botón Atrás de Android**: cierra menús/ventanas, regresa de pantalla y, en el inicio,
  pide una segunda pulsación para salir.
- **Reportes PDF/Excel**: se guardan en el celular y se pueden **Abrir** o **Compartir**
  (WhatsApp, correo, Drive…).
- **Peticiones HTTP nativas** (CapacitorHttp): la app se conecta a la API sin problemas de CORS.
- **Splash screen e ícono** con el escudo institucional.
- **Protección de rutas**: sin sesión iniciada, cualquier pantalla redirige al login.
- La **versión web de escritorio se conserva** igual que antes.

---

## Requisitos (para compilar en tu computador)

1. **Node.js 22** o superior → https://nodejs.org
2. **Android Studio** (última versión) → https://developer.android.com/studio
   Incluye el Android SDK y Java 21, que es lo que pide Capacitor 8.

---

## Opción A · Generar el APK con Android Studio (recomendada)

```bash
# 1. Instalar dependencias (solo la primera vez)
npm install

# 2. Compilar la web y copiarla al proyecto Android
npm run cap:sync

# 3. Abrir el proyecto en Android Studio
npm run cap:open
```

En Android Studio:

1. Espera a que termine la sincronización de Gradle (barra inferior). La primera vez tarda unos minutos.
2. Menú **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
3. Cuando termine, haz clic en **locate** en la notificación.
   El archivo queda en: `android/app/build/outputs/apk/debug/app-debug.apk`

> Si tienes el celular conectado por USB con la *depuración USB* activada, también puedes
> presionar el botón ▶ **Run** y la app se instala directamente.

## Opción B · Por línea de comandos

```bash
npm install
npm run android:apk        # macOS / Linux
npm run android:apk:win    # Windows
```

El APK queda en `android/app/build/outputs/apk/release/app-release.apk`.

## Opción C · Automático en la nube con GitHub (sin instalar Android Studio)

1. Sube este proyecto a un repositorio de GitHub.
2. Ve a la pestaña **Actions** → **Generar APK Android** → **Run workflow**
   (también se ejecuta solo con cada `push` a `main`).
3. Al terminar (≈ 5 min), entra a la ejecución y descarga **CargaAcademica-APK** en *Artifacts*.
4. Descomprime el `.zip` descargado: adentro está `CargaAcademica.apk`.

---

## Instalar el APK en el celular

1. Pasa el archivo `.apk` al celular (cable USB, Google Drive, WhatsApp, correo…).
2. Ábrelo desde el celular. Android pedirá permiso para **instalar apps de origen desconocido**:
   acéptalo para la app desde la que abriste el archivo (Archivos, Drive, Chrome…).
3. Pulsa **Instalar**. La app aparecerá como **Carga Académica** con el escudo de la CUL.

> Aviso de Play Protect: como la app no viene de Play Store puede salir
> "App no reconocida". Elige **Más detalles → Instalar de todas formas**.

---

## Firma del APK

El APK se firma con la clave `android/app/carga-academica.keystore` (datos en
`android/keystore.properties`). Usar siempre la misma clave permite instalar versiones nuevas
encima de la anterior sin desinstalar.

## Desarrollo

```bash
npm run dev        # versión web en http://localhost:5173
npm run build      # genera la app estática en /build
npm run cap:sync   # build + copia a Android
npm run cap:run    # build + instala y abre en un celular/emulador conectado
```

La URL de la API se puede cambiar creando un archivo `.env` (ver `.env.example`).

> **Nota:** la API está en Render (plan gratuito). Si lleva un rato sin uso, la primera
> petición puede tardar unos 30–50 segundos mientras el servidor "despierta".

## Estructura relevante

```
├── android/                     Proyecto nativo Android generado por Capacitor
├── capacitor.config.json        Configuración de Capacitor (id, nombre, splash, barras…)
├── resources/                   Imágenes fuente del ícono y del splash
├── src/
│   ├── app.css                  Estilos globales y adaptaciones móviles
│   ├── lib/
│   │   ├── movil/plataforma.js  Integración nativa: HTTP, archivos, botón atrás, teclado
│   │   ├── movil/ui.svelte.js   Estado del menú lateral
│   │   ├── navegacion.js        Módulos y permisos (compartido por todos los menús)
│   │   └── components/          Header, navbar (barra inferior + menú), tablas, modales…
│   └── routes/                  Pantallas de la aplicación
└── .github/workflows/           Generación automática del APK
```

## Tecnologías

SvelteKit 5 · Svelte 5 (runes) · Vite · Bootstrap 5 · Bootstrap Icons · DataTables ·
SweetAlert2 · **Capacitor 8** (Android).

## Publicar en Netlify

Este proyecto está configurado como una SPA estática. Para publicarlo desde un repositorio Git en Netlify:

1. Selecciona como **Base directory**: `CargaAcademica-Movil/carga-academica-movil` (si esa es la estructura que conserva el repositorio).
2. **Build command**: `npm run build`.
3. **Publish directory**: `build`.
4. Usa Node.js 22; esta versión también está indicada en `netlify.toml`.

Si subes únicamente la carpeta `carga-academica-movil` como raíz del repositorio, deja **Base directory** vacío. No publiques el código fuente mediante arrastrar el ZIP a Deploys: ese método requiere subir el contenido ya compilado de `build/`. Para que Netlify instale las dependencias, el repositorio debe incluir `package.json` y `package-lock.json`; no es necesario subir `node_modules`.

La configuración de `adapter-static` genera `build/index.html` como fallback para las rutas de la SPA. El archivo `static/_redirects` también se copia al resultado publicado. La carpeta Android y `capacitor.config.json` se mantienen; Capacitor continúa usando `build` como `webDir`.
