<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    
    // Importa tus componentes si los tienes en carpetas separadas (ajusta las rutas según tu estructura)
    import Header from '$lib/components/Header.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import Footer from '$lib/components/Footer.svelte';

    const ANIO = new Date().getFullYear();

    let modulos = $state([]);
    let puedeVerTablero = $state(false);
    let nombreUsuario = $state('Usuario');
    let rolUsuario = $state('Sin rol');

    const normalizar = (v) =>
        String(v ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    onMount(() => {
        // Leer datos de sesión almacenados al iniciar sesión
        const nombreGuardado = sessionStorage.getItem('usuario_nombre');
        const rolGuardado = sessionStorage.getItem('usuario_rol');
        const modulosGuardados = sessionStorage.getItem('usuario_modulos');

        if (nombreGuardado) nombreUsuario = nombreGuardado;
        if (rolGuardado) rolUsuario = rolGuardado;

        if (modulosGuardados) {
            try {
                modulos = JSON.parse(modulosGuardados);
            } catch (error) {
                console.error('Error al leer módulos:', error);
                modulos = [];
            }
        }

        const r = normalizar(rolUsuario);

        // Validar permisos para ver el tablero (por rol o por módulo asignado en la BD)
        const tienePermisoModulo = Array.isArray(modulos) && modulos.some((m) => {
            const nombre = normalizar(m.nombre || m.nombre_modulo || '');
            const puedeVer = Boolean(m.puede_ver) === true || m.puede_ver === 1 || m.puede_ver === '1' || m.puede_ver === 'true';
            return nombre.includes('tablero') && puedeVer;
        });

        puedeVerTablero = r.includes('administrador') || r.includes('direccion') || r.includes('jefe') || tienePermisoModulo;
    });

    function esRutaActiva(ruta) {
        const rutaActual = decodeURIComponent($page.url.pathname).toLowerCase();
        const rutaBuscada = decodeURIComponent(ruta).toLowerCase();
        return rutaActual === rutaBuscada;
    }

    function cerrarSesion() {
        sessionStorage.clear();
        goto('/');
    }
</script>

<svelte:head>
    <title>Tablero y Analítica | Acta Docente</title>
    <meta name="description" content="Visualización de tableros y analítica de datos institucionales." />
</svelte:head>

<div class="min-vh-100 d-flex flex-column bg-light">
    <!-- Componentes modulares de Cabecera y Navegación -->
    <Header />
    <Navbar />

    <!-- Contenido Principal con el Iframe de Power BI -->
    <main class="flex-grow-1 p-3 p-sm-4 p-lg-5">
        <div class="max-w-container mx-auto">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-md-center mb-4 gap-3">
                <div>
                    <h1 class="fw-bold text-dark tracking-tight mb-1">Tablero de Control</h1>
                    <p class="text-muted small mb-0">Visualización interactiva de indicadores y métricas institucionales.</p>
                </div>
                <div class="badge bg-white text-dark border shadow-sm px-3 py-2 rounded-pill align-self-start align-self-md-auto">
                    <i class="bi bi-clock-history text-info me-1"></i> Actualizado en tiempo real
                </div>
            </div>

            <!-- Contenedor del Reporte (Iframe Power BI) -->
            <div class="card border-0 shadow-sm rounded-4 overflow-hidden bg-white">
                <div class="card-body p-0">
                    <div class="iframe-container">
                        <iframe 
                            title="Tablero Institucional - Acta Docente" 
                            src="https://app.powerbi.com/reportEmbed?reportId=8402489e-e9c0-4471-bf65-436c3d8a128e&autoAuth=true&ctid=740be6bd-fd36-470e-94d9-0f0c777fadb9" 
                            allowFullScreen="true">
                        </iframe>
                    </div>
                </div>
            </div>
        </div>
    </main>

    <!-- Componente Footer institucional -->
    <Footer />
</div>

<style>
    .color-principal { color: #0f3460; }
    .tracking-tight { letter-spacing: -0.02em; }
    .max-w-container { max-width: 1350px; }

    /* Contenedor flexible adaptable para el Iframe */
    .iframe-container {
        position: relative;
        width: 100%;
        height: 75vh;
        min-height: 550px;
        background: #f8f9fa;
    }

    .iframe-container iframe {
        width: 100%;
        height: 100%;
        border: none;
    }

    .navbar-nav .nav-link {
        color: #495057;
        transition: all 0.2s ease-in-out;
    }

    .navbar-nav .nav-link:hover {
        background-color: #f1f3f5;
        color: #0f3460;
    }
</style>