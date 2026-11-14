
// Módulos del sistema y reglas de visibilidad.
// Lo usan la barra de navegación de escritorio, la barra inferior del celular
// y el menú lateral.

export const normalizar = (v) =>
    String(v ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

export const MODULOS = [
    {
        ruta: '/inicio',
        texto: 'Inicio',
        corto: 'Inicio',
        icono: 'bi-house-door',
        iconoActivo: 'bi-house-door-fill',
        siempre: true
    },
    {
        ruta: '/usuario',
        texto: 'Usuarios',
        corto: 'Usuarios',
        icono: 'bi-people',
        iconoActivo: 'bi-people-fill',
        modulos: ['Usuario', 'Usuarios']
    },
    {
        ruta: '/rol',
        texto: 'Rol',
        corto: 'Roles',
        icono: 'bi-shield-lock',
        iconoActivo: 'bi-shield-lock-fill',
        modulos: ['Rol', 'Roles']
    },
    {
        ruta: '/carga_docente',
        texto: 'Carga Docente',
        corto: 'Carga',
        icono: 'bi-journal-bookmark',
        iconoActivo: 'bi-journal-bookmark-fill',
        modulos: ['Carga Docente']
    },
    {
        ruta: '/Estructura_Académica',
        texto: 'Estructura Académica',
        corto: 'Estructura',
        icono: 'bi-diagram-3',
        iconoActivo: 'bi-diagram-3-fill',
        modulos: ['Estructura Académica']
    },
    {
        ruta: '/Grupos_Horarios',
        texto: 'Grupos',
        corto: 'Grupos',
        icono: 'bi-calendar3-range',
        iconoActivo: 'bi-calendar3-range-fill',
        modulos: ['Horarios Grupos']
    },
    {
        ruta: '/Evaluación_Desempeño',
        texto: 'Evaluación Docente',
        corto: 'Evaluar',
        icono: 'bi-star',
        iconoActivo: 'bi-star-fill',
        modulos: ['Evaluación Docente']
    },
    {
        ruta: '/asignar_evaluacion',
        texto: 'Asignar Evaluación',
        corto: 'Asignar',
        icono: 'bi-clipboard-check',
        iconoActivo: 'bi-clipboard-check-fill',
        permiso: 'asignar'
    },
    {
        ruta: '/Analitica',
        texto: 'Analítica',
        corto: 'Analítica',
        icono: 'bi-bar-chart',
        iconoActivo: 'bi-bar-chart-fill',
        modulos: ['Analítica']
    },

    // TABLERO: exclusivo para Dirección Académica y Jefe de Departamento.
    {
        ruta: '/tablero',
        texto: 'Tablero',
        corto: 'Tablero',
        icono: 'bi-speedometer2',
        iconoActivo: 'bi-speedometer2',
        permiso: 'tablero'
    },

    {
        ruta: '/exportaciones',
        texto: 'Exportaciones',
        corto: 'Reportes',
        icono: 'bi-file-earmark-arrow-down',
        iconoActivo: 'bi-file-earmark-arrow-down-fill',
        permiso: 'exportar'
    }
];

/**
 * Lee de la sesión los módulos y el rol del usuario.
 */
export function leerSesion() {
    if (typeof window === 'undefined') {
        return { modulos: [], rol: '' };
    }

    let modulos = [];

    try {
        const m = JSON.parse(
            sessionStorage.getItem('usuario_modulos') || '[]'
        );

        modulos = Array.isArray(m) ? m : [];
    } catch {
        modulos = [];
    }

    let rol = sessionStorage.getItem('usuario_rol') ?? '';

    if (!rol) {
        try {
            const u = JSON.parse(
                sessionStorage.getItem('usuario') || '{}'
            ) ?? {};

            rol =
                u.nombre_rol ??
                u.rol_nombre ??
                (typeof u.rol === 'string'
                    ? u.rol
                    : u.rol?.nombre_rol) ??
                '';
        } catch {
            rol = '';
        }
    }

    return { modulos, rol };
}

const puedeVer = (v) =>
    v === true ||
    v === 1 ||
    v === '1' ||
    v === 'true';

/**
 * Devuelve los módulos que el usuario actual puede ver.
 */
export function modulosVisibles({ modulos = [], rol = '' }) {
    const r = normalizar(rol);

    const esDireccionAcademica = r.includes('direccion academica');
    const esJefeDepartamento = r.includes('jefe de departamento');

    const permisos = {
        asignar:
            r.includes('jefe') ||
            r.includes('direccion'),

        exportar:
            esDireccionAcademica ||
            esJefeDepartamento,

        tablero:
            esDireccionAcademica ||
            esJefeDepartamento
    };

    const tiene = (nombre) =>
        modulos.some(
            (m) =>
                normalizar(
                    m.nombre || m.nombre_modulo || ''
                ) === normalizar(nombre) &&
                puedeVer(m.puede_ver)
        );

    return MODULOS.filter(
        (m) =>
            m.siempre ||
            (
                m.permiso
                    ? permisos[m.permiso]
                    : m.modulos.some(tiene)
            )
    );
}

/**
 * ¿La ruta actual corresponde a este módulo?
 * Tolera tildes y codificación.
 */
export function esRutaActiva(pathname, ruta) {
    const limpiar = (x) => {
        let s = x;

        try {
            s = decodeURIComponent(x);
        } catch {}

        return normalizar(s).replace(/\/+$/, '');
    };

    const actual = limpiar(pathname);
    const buscada = limpiar(ruta);

    return (
        actual === buscada ||
        actual.startsWith(buscada + '/')
    );
}
