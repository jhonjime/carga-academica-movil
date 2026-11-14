<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import { fade, fly } from 'svelte/transition';
    import { autenticacionApi } from '$lib/api/CargaDocenteApi.js';
    import { leerSesion, modulosVisibles, esRutaActiva } from '$lib/navegacion.js';
    import { ui, abrirMenu, cerrarMenu } from '$lib/movil/ui.svelte.js';
    import Imagen from '$lib/components/Imagen.svelte';

    const VERSION = '1.0.0';

    // Orden de prioridad para los accesos rápidos de la barra inferior.
    const PRIORIDAD = [
        '/carga_docente',
        '/Evaluación_Desempeño',
        '/Analitica',
        '/Grupos_Horarios',
        '/Estructura_Académica',
        '/asignar_evaluacion',
        '/usuario',
        '/rol',
        '/exportaciones',
        '/tablero'

    ];

    let items = $state([]);
    let usuario = $state({ nombre: 'Usuario', rol: '', correo: '' });

    const pathname = $derived($page.url.pathname);
    const activo = (ruta) => esRutaActiva(pathname, ruta);

    // Inicio + 3 módulos principales + botón "Menú".
    const accesosRapidos = $derived.by(() => {
        const inicio = items.find((i) => i.ruta === '/inicio');
        const resto = PRIORIDAD.map((r) => items.find((i) => i.ruta === r))
            .filter(Boolean)
            .slice(0, 3);
        const lista = [inicio, ...resto].filter(Boolean);
        if (lista.length < 4) {
            lista.push({ ruta: '/perfil', corto: 'Perfil', icono: 'bi-person', iconoActivo: 'bi-person-fill' });
        }
        return lista;
    });

    const iniciales = $derived(
        usuario.nombre
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? '')
            .join('') || 'U'
    );

    function cargar() {
        items = modulosVisibles(leerSesion());
        let u = {};
        try {
            u = JSON.parse(sessionStorage.getItem('usuario') || '{}') || {};
        } catch {}
        usuario = {
            nombre:
                sessionStorage.getItem('usuario_nombre') ||
                [u.primer_nombre, u.primer_apellido].filter(Boolean).join(' ') ||
                'Usuario',
            rol: sessionStorage.getItem('usuario_rol') || u.nombre_rol || '',
            correo: sessionStorage.getItem('usuario_correo') || u.correo || ''
        };
    }

    function cerrarSesion() {
        cerrarMenu();
        autenticacionApi.cerrarSesion();
        goto('/login', { replaceState: true });
    }

    // Evita que el contenido de atrás se desplace con el menú abierto.
    $effect(() => {
        document.documentElement.classList.toggle('menu-abierto', ui.menuAbierto);
    });

    onMount(() => {
        cargar();
        document.body.classList.add('con-barra-inferior');
        window.addEventListener('sesionActualizada', cargar);
        return () => {
            document.body.classList.remove('con-barra-inferior');
            document.documentElement.classList.remove('menu-abierto');
            window.removeEventListener('sesionActualizada', cargar);
        };
    });
</script>

<!-- ═════════════ ESCRITORIO: barra horizontal ═════════════ -->
<nav class="navbar navbar-expand-lg bg-body-tertiary border-bottom shadow-sm d-none d-lg-flex" aria-label="Navegación principal">
    <div class="container-fluid">
        <ul class="navbar-nav mx-auto text-center gap-1">
            {#each items as item (item.ruta)}
                <li class="nav-item">
                    <a class="nav-link nav-estilizado" class:active={activo(item.ruta)} href={item.ruta}>
                        {item.texto}
                    </a>
                </li>
            {/each}
        </ul>
    </div>
</nav>

<!-- ═════════════ CELULAR: barra inferior tipo app ═════════════ -->
<nav class="barra-inferior d-lg-none" aria-label="Accesos rápidos">
    {#each accesosRapidos as item (item.ruta)}
        {@const esActivo = activo(item.ruta)}
        <a href={item.ruta} class="pestana" class:activa={esActivo} aria-current={esActivo ? 'page' : undefined}>
            <span class="pildora"><i class="bi {esActivo ? item.iconoActivo : item.icono}"></i></span>
            <span class="etiqueta">{item.corto}</span>
        </a>
    {/each}
    <button type="button" class="pestana" class:activa={ui.menuAbierto} onclick={abrirMenu} aria-label="Abrir menú con todos los módulos">
        <span class="pildora"><i class="bi bi-grid{ui.menuAbierto ? '-fill' : ''}"></i></span>
        <span class="etiqueta">Menú</span>
    </button>
</nav>

<!-- ═════════════ CELULAR: menú lateral ═════════════ -->
{#if ui.menuAbierto}
    <div class="fondo-menu d-lg-none" transition:fade={{ duration: 180 }} onclick={cerrarMenu} aria-hidden="true"></div>

    <div class="menu-lateral d-lg-none" transition:fly={{ x: -320, duration: 240, opacity: 1 }} aria-label="Menú de navegación" role="dialog" aria-modal="true">
        <div class="menu-encabezado">
            <div class="d-flex align-items-center justify-content-between mb-3">
                <div class="d-flex align-items-center gap-2">
                    <span class="menu-logo"><Imagen ancho="auto" alto="100%" alt="Logo institucional" /></span>
                    <div class="lh-sm">
                        <div class="fw-bold text-white">Carga Académica</div>
                        <small class="text-white-50">Gestión y evaluación docente</small>
                    </div>
                </div>
                <button type="button" class="btn btn-cerrar-menu" onclick={cerrarMenu} aria-label="Cerrar menú" data-cerrar-con-atras>
                    <i class="bi bi-x-lg"></i>
                </button>
            </div>

            <a href="/perfil" class="tarjeta-usuario" onclick={cerrarMenu}>
                <span class="avatar">{iniciales}</span>
                <div class="overflow-hidden flex-grow-1">
                    <div class="fw-semibold text-white text-truncate">{usuario.nombre}</div>
                    <small class="text-white-50 text-truncate d-block">{usuario.rol || usuario.correo}</small>
                </div>
                <i class="bi bi-chevron-right text-white-50"></i>
            </a>
        </div>

        <div class="menu-cuerpo">
            <div class="menu-grupo">Módulos</div>
            {#each items as item (item.ruta)}
                {@const esActivo = activo(item.ruta)}
                <a href={item.ruta} class="menu-item" class:activo={esActivo} onclick={cerrarMenu}>
                    <span class="menu-icono"><i class="bi {esActivo ? item.iconoActivo : item.icono}"></i></span>
                    <span class="flex-grow-1">{item.texto}</span>
                    {#if esActivo}<span class="punto"></span>{/if}
                </a>
            {/each}

            <div class="menu-grupo mt-3">Cuenta</div>
            <a href="/perfil" class="menu-item" class:activo={activo('/perfil')} onclick={cerrarMenu}>
                <span class="menu-icono"><i class="bi bi-person-gear"></i></span>
                <span class="flex-grow-1">Mi perfil</span>
            </a>
            <button type="button" class="menu-item text-danger w-100" onclick={cerrarSesion}>
                <span class="menu-icono peligro"><i class="bi bi-box-arrow-right"></i></span>
                <span class="flex-grow-1 text-start">Cerrar sesión</span>
            </button>
        </div>

        <div class="menu-pie">
            <i class="bi bi-shield-check me-1"></i> Carga Académica · v{VERSION}
        </div>
    </div>
{/if}

<style>
    /* ── Escritorio (estilo original) ─────────────────────────────────── */
    .nav-estilizado {
        position: relative;
        font-family: 'Segoe UI', system-ui, -apple-system, Roboto, sans-serif;
        font-weight: 600;
        font-size: 0.95rem;
        letter-spacing: 0.3px;
        color: #495057 !important;
        padding: 8px 16px !important;
        border-radius: 6px;
        transition: all 0.25s ease-in-out;
    }

    .nav-estilizado:hover {
        color: #0f3460 !important;
        background-color: rgba(15, 52, 96, 0.08);
        transform: translateY(-1px);
    }

    .nav-estilizado::after {
        content: '';
        position: absolute;
        bottom: 2px;
        left: 50%;
        width: 0;
        height: 2px;
        background-color: #0f3460;
        transition: width 0.25s ease, left 0.25s ease;
        border-radius: 2px;
    }

    .nav-estilizado:hover::after {
        width: 60%;
        left: 20%;
    }

    .nav-estilizado.active {
        color: #0f3460 !important;
        background-color: rgba(15, 52, 96, 0.12);
        font-weight: 700;
    }

    .nav-estilizado.active::after {
        width: 70%;
        left: 15%;
    }

    /* ── Barra inferior ───────────────────────────────────────────────── */
    .barra-inferior {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 1040;
        display: grid;
        grid-auto-flow: column;
        grid-auto-columns: 1fr;
        padding: 6px 6px calc(6px + var(--sab));
        background: #fff;
        border-top: 1px solid #e3eaf3;
        box-shadow: 0 -6px 24px rgba(15, 52, 96, 0.08);
        transition: transform 0.2s ease;
    }

    :global(html.teclado-abierto) .barra-inferior {
        transform: translateY(110%);
    }

    .pestana {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        padding: 2px 0;
        border: 0;
        background: none;
        color: #6b7a90;
        text-decoration: none;
        font-size: 0.68rem;
        font-weight: 600;
        letter-spacing: 0.01em;
        -webkit-tap-highlight-color: transparent;
    }

    .pildora {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 56px;
        height: 30px;
        border-radius: 999px;
        font-size: 1.2rem;
        transition: background-color 0.2s ease, color 0.2s ease;
    }

    .pestana.activa {
        color: #0f3460;
    }

    .pestana.activa .pildora {
        background: rgba(15, 52, 96, 0.12);
    }

    .pestana:active .pildora {
        transform: scale(0.94);
    }

    .etiqueta {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    /* ── Menú lateral ─────────────────────────────────────────────────── */
    .fondo-menu {
        position: fixed;
        inset: 0;
        z-index: 1060;
        background: rgba(7, 24, 46, 0.5);
    }

    .menu-lateral {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 1070;
        width: min(320px, 86vw);
        display: flex;
        flex-direction: column;
        background: #fff;
        box-shadow: 8px 0 32px rgba(7, 24, 46, 0.25);
        border-radius: 0 20px 20px 0;
        overflow: hidden;
    }

    .menu-encabezado {
        padding: calc(var(--sat) + 1rem) 1rem 1rem;
        background: linear-gradient(150deg, #07182e 0%, #0f3460 60%, #1d5aa8 100%);
    }

    .menu-logo {
        display: inline-flex;
        height: 38px;
    }

    .btn-cerrar-menu {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
        border: 0;
    }

    .tarjeta-usuario {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.7rem 0.8rem;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.12);
        text-decoration: none;
    }

    .avatar {
        width: 42px;
        height: 42px;
        flex-shrink: 0;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        color: #0f3460;
        background: linear-gradient(135deg, #fff 0%, #dbe8f7 100%);
    }

    .menu-cuerpo {
        flex: 1;
        overflow-y: auto;
        padding: 0.75rem 0.75rem 1rem;
    }

    .menu-grupo {
        padding: 0.5rem 0.75rem 0.35rem;
        font-size: 0.7rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #8a97aa;
    }

    .menu-item {
        display: flex;
        align-items: center;
        gap: 0.8rem;
        padding: 0.6rem 0.75rem;
        margin-bottom: 2px;
        border: 0;
        border-radius: 12px;
        background: none;
        color: #23324a;
        font-weight: 600;
        font-size: 0.95rem;
        text-decoration: none;
    }

    .menu-item:active {
        background: #eef3f9;
    }

    .menu-item.activo {
        background: rgba(15, 52, 96, 0.08);
        color: #0f3460;
    }

    .menu-icono {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
        border-radius: 10px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 1.1rem;
        color: #0f3460;
        background: #eef3f9;
    }

    .menu-item.activo .menu-icono {
        color: #fff;
        background: #0f3460;
    }

    .menu-icono.peligro {
        color: #dc3545;
        background: #fdecee;
    }

    .punto {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #0f3460;
    }

    .menu-pie {
        padding: 0.75rem 1rem calc(var(--sab) + 0.75rem);
        border-top: 1px solid #edf1f6;
        font-size: 0.75rem;
        color: #8a97aa;
        text-align: center;
    }
</style>
