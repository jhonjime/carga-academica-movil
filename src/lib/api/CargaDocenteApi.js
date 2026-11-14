import { solicitudHttp, guardarArchivo } from '$lib/movil/plataforma.js';

// URL de la API. Se puede cambiar sin tocar código creando un archivo .env con
// VITE_API_URL=https://mi-api.com (ver .env.example).
const API_URL = (import.meta.env.VITE_API_URL || 'https://api-carga-e4od.onrender.com').replace(/\/+$/, '');

// Claves que el login guarda en el navegador (se usan al cerrar sesión).
const CLAVES_SESION = [
    'usuario',
    'usuario_id',
    'usuario_nombre',
    'usuario_correo',
    'usuario_rol',
    'usuario_role_id',
    'usuario_modulos',
    'token',
    'authToken'
];

// Obtener el token guardado en el navegador.
function obtenerToken() {
    if (typeof window === 'undefined') return null;

    return (
        sessionStorage.getItem('token') ||
        localStorage.getItem('token') ||
        sessionStorage.getItem('authToken') ||
        localStorage.getItem('authToken')
    );
}

// Guardar el token devuelto por el login.
function guardarToken(token) {
    if (typeof window === 'undefined' || !token) return;

    sessionStorage.setItem('token', token);
}

// Petición general a la API.
export async function peticion(endpoint, opciones = {}) {
    const {
        body,
        headers = {},
        raw = false,
        ...config
    } = opciones;

    const esFormData =
        typeof FormData !== 'undefined' && body instanceof FormData;

    const token = obtenerToken();

    let respuesta;

    try {
        respuesta = await solicitudHttp(`${API_URL}${endpoint}`, {
            ...config,
            headers: {
                Accept: 'application/json',
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {}),
                ...(body != null && !esFormData
                    ? { 'Content-Type': 'application/json' }
                    : {}),
                ...headers
            },
            ...(body != null
                ? {
                    body:
                        esFormData || typeof body === 'string'
                            ? body
                            : JSON.stringify(body)
                }
                : {})
        });
    } catch (error) {
        if (error.name === 'AbortError') {
            throw error;
        }

        throw new Error('No se pudo conectar con el servidor.');
    }

    const texto = await respuesta.text();
    let datos = null;

    if (texto) {
        try {
            datos = JSON.parse(texto);
        } catch {
            datos = texto;
        }
    }

    if (!respuesta.ok) {
        const detalle =
            typeof datos === 'object' && datos !== null
                ? datos.detail || datos.mensaje || datos.message
                : datos;

        const mensaje = Array.isArray(detalle)
            ? detalle
                .map((error) =>
                    typeof error === 'object'
                        ? `${(error.loc || [])
                            .filter((x) => x !== 'body')
                            .join(' → ')}: ${
                            error.msg || error.message || 'Error'
                        }`
                        : String(error)
                )
                .join('\n')
            : typeof detalle === 'object' && detalle !== null
                ? JSON.stringify(detalle)
                : detalle || `Error HTTP ${respuesta.status}`;

        // No borrar el token automáticamente ante cualquier 401:
        // primero hay que comprobar si el login está usando el servidor correcto.
        throw new Error(mensaje);
    }

    // Guardar automáticamente el token devuelto por el login.
    if (
        endpoint === '/usuarios/login' &&
        datos &&
        typeof datos === 'object' &&
        datos.token
    ) {
        guardarToken(datos.token);
    }

    if (raw) return datos;

    if (
        datos &&
        typeof datos === 'object' &&
        !Array.isArray(datos) &&
        !('usuario' in datos) &&
        !('token' in datos)
    ) {
        const claves = [
            'data',
            'usuarios',
            'roles',
            'modulos',
            'facultades',
            'modulos_rol',
            'programas_academicos',
            'asignaturas',
            'grupos',
            'carga_docente',
            'horarios',
            'periodos_academicos',
            'evaluaciones',
            'preguntas',
            'preguntas_evaluacion',
            'respuestas'
        ];

        for (const clave of claves) {
            if (datos[clave] != null) {
                return datos[clave];
            }
        }
    }

    return datos;
}

// Petición con reintentos. Render tarda en despertar, así que se reintenta
// solo si el fallo es de conexión o de tiempo. Un 401/404 no se reintenta.
export async function peticionConReintento(endpoint, opciones = {}, intentos = 3) {
    const { timeout = 45000, ...resto } = opciones;

    for (let i = 1; ; i++) {
        try {
            return await peticion(endpoint, {
                ...resto,
                signal: AbortSignal.timeout(timeout)
            });
        } catch (error) {
            const transitorio =
                error?.name === 'TimeoutError' ||
                error?.name === 'AbortError' ||
                /conectar/i.test(error?.message ?? '');

            if (!transitorio || i >= intentos) throw error;

            await new Promise((r) => setTimeout(r, 3000 * i));
        }
    }
}

// Convierte cualquier respuesta de lista en un arreglo.
const comoLista = (d) =>
    Array.isArray(d)
        ? d
        : Object.values(d ?? {}).find(Array.isArray) ??
          (d?.data && comoLista(d.data)) ??
          [];

// CRUD general.
const crud = (ruta) => ({
    listar: () => peticion(`${ruta}/`),

    obtener: (id) => peticion(`${ruta}/${id}`),

    crear: (body) =>
        peticion(`${ruta}/`, {
            method: 'POST',
            body
        }),

    actualizar: (id, body) =>
        peticion(`${ruta}/${id}`, {
            method: 'PUT',
            body
        }),

    eliminar: (id) =>
        peticion(`${ruta}/${id}`, {
            method: 'DELETE'
        })
});

// Inicio y cierre de sesión.
export const autenticacionApi = {
    iniciarSesion: (body) =>
        peticion('/usuarios/login', {
            method: 'POST',
            body
        }),

    // Comprueba una contraseña iniciando sesión con ella.
    // Devuelve true/false; si no hay conexión, lanza el error.
    verificarPassword: async (correo, password) => {
        try {
            await autenticacionApi.iniciarSesion({ correo, password });
            return true;
        } catch (error) {
            if (/conectar/i.test(error?.message ?? '')) throw error;
            return false;
        }
    },

    // Borra la sesión y el token del navegador.
    cerrarSesion: () => {
        if (typeof window === 'undefined') return;

        for (const clave of CLAVES_SESION) {
            sessionStorage.removeItem(clave);
            localStorage.removeItem(clave);
        }

        window.dispatchEvent(new Event('sesionActualizada'));
    }
};

// Usuarios: CRUD + métodos del perfil.
export const usuariosApi = {
    ...crud('/usuarios'),

    // Actualiza los datos de un usuario (PUT /usuarios/{id}).
    actualizarPerfil: (id, body) =>
        peticion(`/usuarios/${encodeURIComponent(id)}`, {
            method: 'PUT',
            body
        }),

    // Busca un usuario por su correo. Devuelve el usuario o null.
    buscarPorCorreo: async (correo) => {
        const buscado = String(correo ?? '').trim().toLowerCase();
        if (!buscado) return null;

        const datos = await peticionConReintento('/usuarios/', { raw: true });

        return (
            comoLista(datos).find(
                (u) =>
                    String(u?.correo ?? u?.email ?? u?.correo_electronico ?? '')
                        .trim()
                        .toLowerCase() === buscado
            ) ?? null
        );
    },

    // Cambia la contraseña: primero verifica la actual y luego guarda la nueva.
    // datosUsuario = el cuerpo completo del usuario (el PUT lo exige completo).
    cambiarPassword: async ({ id, correo, passwordActual, passwordNueva, datosUsuario = {} }) => {
        const correcta = await autenticacionApi.verificarPassword(correo, passwordActual);

        if (!correcta) {
            throw new Error('La contraseña actual no es correcta.');
        }

        return usuariosApi.actualizarPerfil(id, {
            ...datosUsuario,
            contraseña: passwordNueva
        });
    }
};

// Recursos de la API.
export const rolesApi = crud('/roles');
export const modulosApi = crud('/modulos');
export const modulosRolApi = crud('/modulos-rol');
export const facultadesApi = crud('/facultades');
export const periodosAcademicosApi = crud('/periodos-academicos');
export const programasAcademicosApi = crud('/programas-academicos');
export const asignaturasApi = crud('/asignaturas');
export const gruposApi = crud('/grupos');
export const cargaDocenteApi = crud('/carga-docente');
export const horariosApi = crud('/horarios');
export const evaluacionesApi = crud('/evaluaciones');
export const preguntasApi = crud('/preguntas');

// Preguntas asociadas a una evaluación.
export const preguntasEvaluacionApi = {
    ...crud('/preguntas-evaluacion'),

    listarPorEvaluacion: (id) =>
        peticion(`/preguntas-evaluacion/evaluacion/${id}`)
};

// Respuestas.
export const respuestasApi = {
    ...crud('/respuestas'),

    guardarLote: (body) =>
        peticion('/respuestas/lote', {
            method: 'POST',
            body
        })
};

// Evaluación docente.
export const evaluacionDocenteApi = {
    listarEvaluaciones: () =>
        evaluacionesApi.listar(),

    listarMisEvaluaciones: () =>
        peticion('/evaluaciones/mis-evaluaciones'),

    listarPreguntasDeEvaluacion: (id) =>
        preguntasEvaluacionApi.listarPorEvaluacion(id),

    guardar: (body) =>
        respuestasApi.guardarLote(body)
};


// Recupera el ID del usuario autenticado.
export function obtenerUsuarioId() {
    if (typeof window === 'undefined') return null;

    const leer = (valor) => {
        if (!valor) return null;

        // Puede estar guardado directamente como número.
        const directo = Number(valor);
        if (Number.isInteger(directo) && directo > 0) return directo;

        // O puede estar dentro del objeto usuario.
        try {
            const usuario = JSON.parse(valor);
            const id = Number(
                usuario?.usuario_id ??
                usuario?.user_id ??
                usuario?.id
            );

            return Number.isInteger(id) && id > 0 ? id : null;
        } catch {
            return null;
        }
    };

    return (
        leer(sessionStorage.getItem('usuario_id')) ??
        leer(localStorage.getItem('usuario_id')) ??
        leer(sessionStorage.getItem('usuario')) ??
        leer(localStorage.getItem('usuario'))
    );
}


// Descarga un reporte enviado por el backend.
export async function descargarReporte(endpoint, filtros = {}) {
    if (typeof window === 'undefined') {
        throw new Error(
            'La descarga solo está disponible en el navegador.'
        );
    }

    // Obtener el usuario autenticado.
    const usuarioId = obtenerUsuarioId();

    if (!usuarioId) {
        throw new Error(
            'No se encontró el ID del usuario autenticado. Cierra sesión e inicia sesión nuevamente.'
        );
    }

    // Construir parámetros de búsqueda.
    const parametros = new URLSearchParams();

    parametros.set('usuario_id', String(usuarioId));

    for (const [clave, valor] of Object.entries(filtros)) {
        if (
            valor !== undefined &&
            valor !== null &&
            String(valor).trim() !== ''
        ) {
            parametros.set(clave, String(valor).trim());
        }
    }

    // Obtener token de autenticación.
    const token = obtenerToken();

    // Solicitar reporte al backend (en el celular, con el cliente HTTP nativo).
    const respuesta = await solicitudHttp(
        `${API_URL}${endpoint}?${parametros.toString()}`,
        {
            method: 'GET',
            binario: true,
            headers: {
                Accept:
                    'application/pdf, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                ...(token
                    ? { Authorization: `Bearer ${token}` }
                    : {})
            }
        }
    );

    // Manejar errores del backend.
    if (!respuesta.ok) {
        const contenido = await respuesta.text();

        let mensaje =
            `Error al generar el reporte (HTTP ${respuesta.status}).`;

        try {
            const datos = JSON.parse(contenido);

            mensaje =
                datos.detail ||
                datos.mensaje ||
                datos.message ||
                mensaje;
        } catch {
            if (contenido) {
                mensaje = contenido;
            }
        }

        throw new Error(mensaje);
    }

    // Obtener nombre enviado por el backend.
    const disposicion =
        respuesta.headers.get('Content-Disposition') || '';

    const coincidencia =
        disposicion.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);

    const tipo = respuesta.headers.get('Content-Type') || '';
    const extension = /pdf/i.test(tipo) ? '.pdf' : /sheet|excel/i.test(tipo) ? '.xlsx' : '';

    let nombreArchivo = `reporte-${Date.now()}${extension}`;
    if (coincidencia?.[1]) {
        try {
            nombreArchivo = decodeURIComponent(coincidencia[1]);
        } catch {
            nombreArchivo = coincidencia[1];
        }
    }

    // En el celular el archivo llega en base64; en la web como Blob.
    const base64 = respuesta.base64 ?? null;
    const archivo = base64 ? null : await respuesta.blob();

    if (base64 ? !base64.length : !archivo.size) {
        throw new Error(
            'El servidor generó un archivo vacío.'
        );
    }

    // Web: descarga normal. Celular: se guarda y se ofrece Abrir / Compartir.
    await guardarArchivo({ nombre: nombreArchivo, blob: archivo, base64, tipo });

    return true;
}
