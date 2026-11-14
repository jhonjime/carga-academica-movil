<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { page } from '$app/stores';
    import Imagen from '$lib/components/Imagen.svelte';
    import { seccionActual } from '$lib/components/PageHeader.svelte';
    import { autenticacionApi } from '$lib/api/CargaDocenteApi.js';
    import { abrirMenu } from '$lib/movil/ui.svelte.js';

    let usuario = $state({ nombre: 'Usuario', correo: '', rol: 'Invitado' });
    let abierto = $state(null); // null | 'menu' | 'notif'
    let notificaciones = $state([]);

    const get = (k) => sessionStorage.getItem(k);

    // Título de la pantalla actual para la barra superior del celular.
    const seccion = $derived(seccionActual($page.url.pathname));
    const tituloMovil = $derived(seccion.titulo || 'Carga Académica');

    const iniciales = $derived(
        usuario.nombre
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]?.toUpperCase() ?? '')
            .join('') || 'U'
    );

    function cargar() {
        let u = {};
        try {
            u = JSON.parse(get('usuario')) || {};
        } catch {}

        const correo = get('usuario_correo') || u.correo || '';
        const completo = [u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido]
            .filter(Boolean)
            .join(' ');

        usuario = {
            nombre:
                get('usuario_nombre') ||
                completo ||
                u.nombre ||
                correo.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()) ||
                'Usuario',
            correo,
            rol: get('usuario_rol') || u.nombre_rol || u.rol || 'Invitado'
        };
    }

    const toggle = (x) => (abierto = abierto === x ? null : x);
    const cerrar = () => (abierto = null);

    function cerrarSesion() {
        autenticacionApi.cerrarSesion();
        cargar();
        cerrar();
        goto('/login', { replaceState: true });
    }

    onMount(() => {
        cargar();
        window.addEventListener('sesionActualizada', cargar);
        return () => window.removeEventListener('sesionActualizada', cargar);
    });
</script>

<!-- Cierra los paneles al hacer clic fuera de ellos -->
<svelte:window onclick={(e) => e.target.closest('[data-menu]') || cerrar()} />

<header class="cabecera">
    <nav class="navbar navbar-expand navbar-dark barra px-2 px-sm-3 px-md-4 py-2 py-lg-3 shadow-sm">
        <div class="container-fluid position-relative gap-1 px-1">
            <!-- Botón de menú (solo celular) -->
            <button
                type="button"
                class="btn boton-icono d-lg-none"
                aria-label="Abrir menú de navegación"
                onclick={(e) => {
                    e.stopPropagation();
                    abrirMenu();
                }}
            >
                <i class="bi bi-list fs-3"></i>
            </button>

            <a href="/inicio" class="d-flex align-items-center gap-2 gap-lg-3 text-decoration-none marca" aria-label="Ir al inicio">
                <span class="logo"><Imagen ancho="auto" alto="100%" alt="Logo institucional" /></span>

                <!-- Escritorio -->
                <div class="d-none d-lg-block">
                    <h1 class="h5 text-white fw-semibold mb-0">Carga Académica</h1>
                    <small class="text-white-50">Sistema de carga y evaluación docente</small>
                </div>

                <!-- Celular: título de la pantalla actual -->
                <div class="d-lg-none overflow-hidden lh-sm">
                    <div class="text-white-50 sobretitulo">Carga Académica</div>
                    <div class="text-white fw-semibold text-truncate titulo-movil">{tituloMovil}</div>
                </div>
            </a>

            <div class="d-flex align-items-center gap-1 gap-md-3 ms-auto">
                <!-- NOTIFICACIONES -->
                <div class="position-relative" data-menu>
                    <button
                        type="button"
                        class="btn boton-icono position-relative"
                        title="Notificaciones"
                        aria-label="Abrir notificaciones"
                        aria-expanded={abierto === 'notif'}
                        onclick={() => toggle('notif')}
                    >
                        <i class="bi bi-bell fs-5"></i>
                        {#if notificaciones.length}
                            <span class="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
                                <span class="visually-hidden">Tienes notificaciones</span>
                            </span>
                        {/if}
                    </button>

                    {#if abierto === 'notif'}
                        <div class="panel-flotante position-absolute end-0 mt-2 bg-white rounded-4 shadow-lg border" role="dialog" aria-label="Panel de notificaciones">
                            <div class="d-flex justify-content-between align-items-center px-3 py-3 border-bottom">
                                <div>
                                    <h6 class="mb-0 fw-bold text-dark">Notificaciones</h6>
                                    <small class="text-muted">Avisos del sistema</small>
                                </div>
                                <i class="bi bi-bell text-secondary fs-5" aria-hidden="true"></i>
                            </div>

                            {#each notificaciones as n}
                                <div class="d-flex gap-3 px-3 py-3">
                                    <i class="bi bi-info-circle text-primary fs-5"></i>
                                    <div>
                                        <div class="fw-semibold">{n.titulo}</div>
                                        <small class="text-muted">{n.mensaje}</small>
                                    </div>
                                </div>
                            {:else}
                                <div class="text-center px-4 py-5">
                                    <div class="bg-light rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3" style="width: 64px; height: 64px;">
                                        <i class="bi bi-bell-slash text-secondary fs-3" aria-hidden="true"></i>
                                    </div>
                                    <h6 class="fw-semibold text-dark mb-1">No tienes notificaciones</h6>
                                    <p class="text-muted small mb-0">Aquí aparecerán los avisos importantes del sistema.</p>
                                </div>
                            {/each}

                            <div class="border-top px-3 py-2 text-center">
                                <small class="text-muted">Carga Académica</small>
                            </div>
                        </div>
                    {/if}
                </div>

                <div class="vr bg-white opacity-25 d-none d-lg-block" style="height: 40px;"></div>

                <!-- PERFIL -->
                <div class="position-relative" data-menu>
                    <button
                        type="button"
                        class="btn border-0 text-white d-flex align-items-center gap-2 p-1 rounded-3"
                        aria-label="Abrir menú de usuario"
                        aria-expanded={abierto === 'menu'}
                        onclick={() => toggle('menu')}
                    >
                        <span class="avatar">{iniciales}</span>
                        <div class="text-start d-none d-lg-block">
                            <div class="fw-semibold small lh-1">{usuario.nombre}</div>
                            <div class="text-white-50 mt-1" style="font-size: 11px;">{usuario.rol}</div>
                        </div>
                        <i class="bi bi-chevron-down small text-white-50 ms-1 d-none d-lg-inline"></i>
                    </button>

                    {#if abierto === 'menu'}
                        <ul class="dropdown-menu dropdown-menu-end shadow-lg border-0 mt-2 show position-absolute end-0">
                            <li class="px-3 py-3 border-bottom d-flex align-items-center gap-2">
                                <span class="avatar avatar-claro flex-shrink-0">{iniciales}</span>
                                <div class="overflow-hidden">
                                    <div class="fw-bold text-dark">{usuario.nombre}</div>
                                    <small class="text-muted text-break">{usuario.correo}</small>
                                </div>
                            </li>
                            <li class="px-3 py-2">
                                <small class="text-muted d-block">Rol actual</small>
                                <span class="badge bg-primary mt-1"><i class="bi bi-shield-check me-1"></i>{usuario.rol}</span>
                            </li>
                            <li><hr class="dropdown-divider" /></li>
                            <li><h6 class="dropdown-header">Cuenta</h6></li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center py-2" href="/perfil" onclick={cerrar}>
                                    <i class="bi bi-person me-2 fs-6"></i>Mi Perfil
                                </a>
                            </li>

                            <li><hr class="dropdown-divider" /></li>
                            <li>
                                <button type="button" class="dropdown-item text-danger fw-semibold d-flex align-items-center py-2" onclick={cerrarSesion}>
                                    <i class="bi bi-box-arrow-right me-2 fs-6"></i>Cerrar sesión
                                </button>
                            </li>
                        </ul>
                    {/if}
                </div>
            </div>
        </div>
    </nav>
</header>

<style>
    .cabecera {
        padding: 1rem;
    }

    .barra {
        background-color: #0f3460;
        border-radius: 1rem;
    }

    .logo {
        display: inline-flex;
        height: 46px;
        flex-shrink: 0;
    }

    .boton-icono {
        width: 42px;
        height: 42px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        background-color: rgba(255, 255, 255, 0.1);
        border: 0;
    }

    .boton-icono:hover,
    .boton-icono:active {
        color: #fff;
        background-color: rgba(255, 255, 255, 0.2);
    }

    .avatar {
        width: 38px;
        height: 38px;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.85rem;
        letter-spacing: 0.02em;
        color: #0f3460;
        background: linear-gradient(135deg, #ffffff 0%, #dbe8f7 100%);
        box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.25);
    }

    .avatar-claro {
        width: 44px;
        height: 44px;
        color: #fff;
        background: linear-gradient(135deg, #0f3460 0%, #1d5aa8 100%);
        box-shadow: none;
    }

    .panel-flotante {
        width: min(340px, calc(100vw - 24px));
        z-index: 1050;
    }

    .dropdown-menu {
        width: min(300px, calc(100vw - 24px));
        z-index: 1050;
    }

    /* ── Celular / tableta: barra superior tipo app ─────────────────────── */
    @media (max-width: 991.98px) {
        .cabecera {
            position: sticky;
            top: 0;
            z-index: 1030;
            padding: 0;
        }

        .barra {
            border-radius: 0;
            padding-top: calc(var(--sat) + 0.5rem) !important;
            background: linear-gradient(135deg, #0b2a4f 0%, #0f3460 55%, #16477f 100%);
        }

        .logo {
            height: 34px;
        }

        .marca {
            min-width: 0;
            flex: 1 1 auto;
        }

        .sobretitulo {
            font-size: 0.68rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
        }

        .titulo-movil {
            font-size: 1.02rem;
        }

        .boton-icono {
            background-color: transparent;
        }

        .avatar {
            width: 34px;
            height: 34px;
            font-size: 0.78rem;
        }
    }
</style>
