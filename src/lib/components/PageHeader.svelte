
<script module>
    
    export const SECCIONES = {
        '/inicio': {
            titulo: 'Inicio',
            descripcion: 'Resumen general del sistema.'
        },
        '/usuario': {
            titulo: 'Usuarios',
            descripcion: 'Gestión de los usuarios del sistema.'
        },
        '/rol': {
            titulo: 'Roles y permisos',
            descripcion: 'Define qué puede hacer cada rol en cada módulo del sistema.'
        },
        '/carga_docente': {
            titulo: 'Carga docente',
            descripcion: 'Gestión de asignaciones, grupos y horarios docentes.'
        },
        '/Estructura_Académica': {
            titulo: 'Estructura académica',
            descripcion: 'Gestión de asignaturas, facultades y programas académicos.'
        },
        '/Grupos_Horarios': {
            titulo: 'Grupos',
            descripcion: 'Administración de grupos por período académico.'
        },
        '/Evaluación_Desempeño': {
            titulo: 'Evaluación docente',
            descripcion: 'Califica cada pregunta y comparte tu retroalimentación.'
        },
        '/Analitica': {
            titulo: 'Analítica docente',
            descripcion: 'Consulta el estado de las evaluaciones y el seguimiento académico de los docentes.'
         },
        '/exportaciones': {
            titulo: 'Exportaciones',
            descripcion: 'Gestión de exportaciones de datos del sistema.'
        },
        '/tablero': {
            titulo: 'Tablero',
            descripcion: 'Resumen de indicadores y métricas del sistema.'
        },
        '/asignar_evaluacion': {
            titulo: 'Asignar evaluaciones',
            descripcion: 'Elige qué evaluaciones se asignan a todos los docentes.'
        },
        '/perfil': {
            titulo: 'Mi perfil',
            descripcion: 'Consulta y actualiza los datos de tu cuenta.'
        }
        
    };

    // Minúsculas, sin tildes ni barra final, para que /Estructura_Académica
    // coincida aunque el navegador la codifique distinto.
    const limpiar = (ruta) => {
        let r = ruta;
        try { r = decodeURIComponent(ruta); } catch {}
        return r.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\/+$/, '');
    };

    const MAPA = Object.entries(SECCIONES).map(([ruta, seccion]) => [limpiar(ruta), seccion]);
    const VACIA = { titulo: '', descripcion: '' };

    // Devuelve la sección de una ruta (también para subrutas como /usuario/5)
    export const seccionActual = (pathname) => {
        const actual = limpiar(pathname);
        return MAPA.find(([ruta]) => actual === ruta || actual.startsWith(ruta + '/'))?.[1] ?? VACIA;
    };
</script>

<script>
    import { page } from '$app/stores';

    // titulo y descripcion son opcionales: si no se pasan, salen de SECCIONES
    let { titulo, descripcion, acciones } = $props();

    const seccion = $derived(seccionActual($page.url.pathname));
</script>

<div class="encabezado-seccion">
    <div>
        <h1>{titulo ?? seccion.titulo}</h1>
        <p>{descripcion ?? seccion.descripcion}</p>
    </div>

    {#if acciones}
        <div class="acciones">{@render acciones()}</div>
    {/if}
</div>

<style>
    .encabezado-seccion {
        display: flex;
        flex-direction: column;
        gap: 1rem;
        margin-bottom: 1.5rem;
        padding: 1rem 1.5rem;
        background: #fff;
        border: 1px solid #dbe5f1;
        border-radius: 16px;
        box-shadow: 0 6px 24px rgba(15, 52, 96, 0.08);
    }

    h1 { margin: 0 0 0.25rem; color: #12233d; font-size: 1.75rem; font-weight: 700; }
    p { margin: 0; color: #5b6b82; font-size: 0.875rem; }

    .acciones { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 0.5rem; }

    @media (max-width: 767.98px) {
        .encabezado-seccion { padding: 1rem; margin-bottom: 1rem; border-radius: 18px; gap: 0.75rem; }
        h1 { font-size: 1.3rem; }
        .acciones { width: 100%; }
        .acciones :global(.btn) { flex: 1 1 auto; min-height: 44px; border-radius: 12px; }
    }

    @media (min-width: 768px) {
        .encabezado-seccion { flex-direction: row; align-items: center; justify-content: space-between; }
    }

    /* Botones disponibles para cualquier página que use el componente */
    .acciones :global(.btn) { padding-inline: 1rem; font-weight: 600; }
    .acciones :global(.btn-marca) { background: #0f3460; border: 1px solid #0f3460; color: #fff; }
    .acciones :global(.btn-marca:hover:not(:disabled)) { background: #0b2447; border-color: #0b2447; color: #fff; }
    .acciones :global(.btn-contorno) { background: #fff; border: 1px solid #0f3460; color: #0f3460; }
    .acciones :global(.btn-contorno:hover:not(:disabled)) { background: #eef4fb; border-color: #1d5aa8; color: #1d5aa8; }
</style>