// ───────────────────────────────────────────────────────────────────────────
//  Integración con Capacitor (Android)
//
//  Este módulo concentra todo lo que es "nativo" en la app móvil:
//    • Peticiones HTTP nativas (CapacitorHttp) → evitan problemas de CORS
//      entre el WebView (https://localhost) y la API en Render.
//    • Guardar y abrir/compartir reportes PDF o Excel en el celular.
//    • Barra de estado, splash, teclado y botón "Atrás" de Android.
//
//  En el navegador (npm run dev) todo cae de forma transparente a las APIs
//  web normales, así que la misma base de código sirve para web y móvil.
// ───────────────────────────────────────────────────────────────────────────

import { Capacitor, CapacitorHttp, SystemBars, SystemBarsStyle } from '@capacitor/core';

/** ¿Se está ejecutando dentro del APK (Android/iOS)? */
export const esNativo = () => Capacitor.isNativePlatform();

/** Plataforma actual: 'android' | 'ios' | 'web' */
export const plataforma = () => Capacitor.getPlatform();

// ── HTTP ───────────────────────────────────────────────────────────────────

function aBlob(base64, tipo = 'application/octet-stream') {
    const binario = atob(base64);
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
}

function esperarAborto(signal) {
    return new Promise((_, rechazar) => {
        if (!signal) return;
        const abortar = () =>
            rechazar(signal.reason ?? new DOMException('Operación cancelada', 'AbortError'));
        if (signal.aborted) abortar();
        else signal.addEventListener('abort', abortar, { once: true });
    });
}

/**
 * Igual que fetch(), pero en el celular usa el cliente HTTP nativo.
 * Devuelve un objeto compatible con lo que usa CargaDocenteApi.js:
 * { ok, status, headers.get(), text(), blob(), base64 }.
 *
 * @param {string} url
 * @param {RequestInit & { binario?: boolean }} opciones
 */
export async function solicitudHttp(url, opciones = {}) {
    const { method = 'GET', headers = {}, body, signal, binario = false } = opciones;

    const esFormData = typeof FormData !== 'undefined' && body instanceof FormData;

    if (!esNativo() || esFormData) {
        return fetch(url, { method, headers, body, signal });
    }

    let data;
    if (body != null) {
        if (typeof body === 'string') {
            try {
                data = JSON.parse(body);
            } catch {
                data = body;
            }
        } else {
            data = body;
        }
    }

    let respuesta;
    try {
        respuesta = await Promise.race([
            CapacitorHttp.request({
                url,
                method,
                headers,
                data,
                responseType: binario ? 'blob' : 'text',
                connectTimeout: 60000,
                readTimeout: 60000
            }),
            esperarAborto(signal)
        ]);
    } catch (error) {
        if (error?.name === 'AbortError' || error?.name === 'TimeoutError') throw error;
        // Mismo comportamiento que fetch() cuando no hay red.
        throw new TypeError(error?.message || 'Failed to fetch');
    }

    const cabeceras = {};
    for (const [k, v] of Object.entries(respuesta.headers ?? {})) {
        cabeceras[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
    }

    const crudo = respuesta.data;
    const texto =
        crudo == null ? '' : typeof crudo === 'string' ? crudo : JSON.stringify(crudo);

    return {
        ok: respuesta.status >= 200 && respuesta.status < 300,
        status: respuesta.status,
        headers: { get: (nombre) => cabeceras[String(nombre).toLowerCase()] ?? null },
        base64: binario && typeof crudo === 'string' ? crudo : null,
        text: async () => (binario && typeof crudo === 'string' ? atob(crudo) : texto),
        blob: async () =>
            binario && typeof crudo === 'string'
                ? aBlob(crudo, cabeceras['content-type'])
                : new Blob([texto], { type: cabeceras['content-type'] || 'text/plain' })
    };
}

// ── Archivos (reportes) ────────────────────────────────────────────────────

function blobABase64(blob) {
    return new Promise((resolver, rechazar) => {
        const lector = new FileReader();
        lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '');
        lector.onerror = () => rechazar(lector.error);
        lector.readAsDataURL(blob);
    });
}

/**
 * Guarda un archivo en el celular y ofrece abrirlo o compartirlo.
 * En la web hace la descarga clásica del navegador.
 *
 * @param {{ nombre: string, blob?: Blob, base64?: string | null, tipo?: string }} archivo
 */
export async function guardarArchivo({ nombre, blob, base64, tipo }) {
    if (!esNativo()) {
        const url = URL.createObjectURL(blob ?? aBlob(base64, tipo));
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = nombre;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return;
    }

    const [{ Filesystem, Directory }, { Share }, { FileViewer }, Swal] = await Promise.all([
        import('@capacitor/filesystem'),
        import('@capacitor/share'),
        import('@capacitor/file-viewer'),
        import('sweetalert2').then((m) => m.default)
    ]);

    const datos = base64 ?? (await blobABase64(blob));
    const limpio = nombre.replace(/[\\/:*?"<>|]+/g, '_');

    const { uri } = await Filesystem.writeFile({
        path: `reportes/${limpio}`,
        data: datos,
        directory: Directory.Cache,
        recursive: true
    });

    const esPdf = /\.pdf$/i.test(limpio);

    const r = await Swal.fire({
        icon: 'success',
        title: 'Reporte listo',
        html: `<div class="text-muted small">${limpio.replace(/[<>&]/g, '')}</div>`,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-box-arrow-up-right me-1"></i> Abrir',
        denyButtonText: '<i class="bi bi-share me-1"></i> Compartir',
        cancelButtonText: 'Cerrar',
        confirmButtonColor: '#0f3460',
        denyButtonColor: '#1d5aa8',
        reverseButtons: false,
        customClass: { popup: 'rounded-4' }
    });

    // Si la persona cancela el diálogo de compartir no es un error del reporte.
    try {
        if (r.isConfirmed) {
            try {
                await FileViewer.openDocumentFromLocalPath({ path: uri });
            } catch {
                // Si no hay app para abrirlo (p. ej. un .xlsx sin Excel), se ofrece compartir.
                await Share.share({ title: limpio, files: [uri], dialogTitle: 'Abrir con…' });
            }
        } else if (r.isDenied) {
            await Share.share({
                title: limpio,
                text: esPdf ? 'Reporte PDF – Carga Académica' : 'Reporte – Carga Académica',
                files: [uri],
                dialogTitle: 'Compartir reporte'
            });
        }
    } catch (e) {
        console.warn('Acción sobre el reporte cancelada:', e);
    }
}

// ── Arranque de la app nativa ──────────────────────────────────────────────

let iniciada = false;
let ultimoAtras = 0;

/**
 * Configura la experiencia nativa. Se llama una sola vez desde +layout.svelte.
 * @param {{ navegar: (ruta: string) => any, ruta: () => string, alAtras?: () => boolean }} ctx
 */
export async function iniciarAppNativa({ navegar, ruta, alAtras }) {
    if (iniciada || !esNativo()) return;
    iniciada = true;

    document.documentElement.classList.add('es-nativo', `plataforma-${plataforma()}`);

    // Íconos claros sobre la cabecera azul institucional.
    Promise.resolve()
        .then(() => SystemBars.setStyle({ style: SystemBarsStyle.Dark }))
        .catch(() => {});

    const [{ App }, { SplashScreen }, { Keyboard }, Swal] = await Promise.all([
        import('@capacitor/app'),
        import('@capacitor/splash-screen'),
        import('@capacitor/keyboard'),
        import('sweetalert2').then((m) => m.default)
    ]);

    // Ocultar la barra inferior cuando el teclado está abierto.
    Keyboard.addListener('keyboardWillShow', () =>
        document.documentElement.classList.add('teclado-abierto')
    );
    Keyboard.addListener('keyboardWillHide', () =>
        document.documentElement.classList.remove('teclado-abierto')
    );

    // Botón "Atrás" de Android: cierra lo que esté abierto, navega hacia atrás
    // o, en la pantalla principal, pide una segunda pulsación para salir.
    App.addListener('backButton', () => {
        if (alAtras?.()) return;

        // (el aviso "presiona otra vez para salir" no cuenta como ventana abierta)
        const esAvisoSalir = Swal.getPopup()?.classList.contains('toast-salir');
        if (Swal.isVisible() && !esAvisoSalir) {
            Swal.close();
            return;
        }

        const cerrarModal = document.querySelector(
            '.modal.show .btn-close, [data-cerrar-con-atras]'
        );
        if (cerrarModal) {
            cerrarModal.click();
            return;
        }

        const actual = decodeURIComponent(ruta()).toLowerCase();
        if (actual === '/inicio' || actual === '/login' || actual === '/') {
            const ahora = Date.now();
            if (ahora - ultimoAtras < 2000) {
                App.exitApp();
                return;
            }
            ultimoAtras = ahora;
            Swal.fire({
                toast: true,
                position: 'bottom',
                showConfirmButton: false,
                timer: 2000,
                title: 'Presiona atrás otra vez para salir',
                customClass: { popup: 'toast-salir' }
            });
            return;
        }

        if (window.history.length > 1) window.history.back();
        else navegar('/inicio');
    });

    // Pequeña pausa para que el primer render pinte antes de quitar el splash.
    setTimeout(() => SplashScreen.hide({ fadeOutDuration: 250 }).catch(() => {}), 150);
}
