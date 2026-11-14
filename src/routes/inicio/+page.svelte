<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';

    import Navbar from '$lib/components/navbar.svelte';
    import Footer from '$lib/components/footer.svelte';
    import Header from '$lib/components/header.svelte';
    import Imagen from '$lib/components/Imagen.svelte';
    import BtnSugerencias from '$lib/components/btnSugerencias.svelte';
    
    let modulos = $state([]);
    let mensaje = $state('');
    let cargando = $state(true);
    let nombre = $state('');
    let rol = $state('');

    const saludo = (() => {
        const h = new Date().getHours();
        return h < 12 ? 'Buenos días' : h < 19 ? 'Buenas tardes' : 'Buenas noches';
    })();

    const norm = (valor) =>
        String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[_-]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

    /**
     * Convierte distintos formatos de permisos a booleanos.
     */
    function tienePermiso(valor) {
        return (
            valor === true ||
            valor === 1 ||
            ['1', 'true', 'si', 'sí'].includes(
                String(valor ?? '').toLowerCase().trim()
            )
        );
    }

    /**
     * Carga los permisos de la sesión actual.
     */
    function cargarModulos() {
        try {
            const sesion = sessionStorage.getItem('usuario');

            if (!sesion) {
                modulos = [];
                cargando = false;
                return;
            }

            const datos = JSON.parse(
                sessionStorage.getItem('usuario_modulos') || '[]'
            );

            modulos = Array.isArray(datos) ? datos : [];
            nombre = (sessionStorage.getItem('usuario_nombre') || '').split(' ')[0];
            rol = sessionStorage.getItem('usuario_rol') || '';
        } catch (error) {
            console.error('Error al cargar los permisos:', error);
            modulos = [];
        } finally {
            cargando = false;
        }
    }

    onMount(() => {
        cargarModulos();

        window.addEventListener('sesionActualizada', cargarModulos);

        return () => {
            window.removeEventListener('sesionActualizada', cargarModulos);
        };
    });

    /**
     * Tarjetas disponibles en el sistema.
     * Los alias permiten reconocer nombres alternativos de los módulos.
     */
    const tarjetas = [
        {
            nombre: 'Usuarios',
            titulo: 'Usuarios',
            descripcion:
                'Gestión y administración de cuentas de usuarios del sistema.',
            icono: 'bi-people-fill',
            ruta: '/usuario',
            alias: ['usuario', 'usuarios', 'gestion de usuarios']
        },
        {
            nombre: 'Rol',
            titulo: 'Roles y Permisos',
            descripcion:
                'Configuración de roles, permisos y accesos por módulo.',
            icono: 'bi-shield-lock-fill',
            ruta: '/rol',
            alias: ['rol', 'roles', 'roles y permisos', 'permisos']
        },
        {
            nombre: 'Carga Docente',
            titulo: 'Carga Docente',
            descripcion:
                'Asigna horas y cursos a cada docente por semestre.',
            icono: 'bi-journal-bookmark-fill',
            ruta: '/carga_docente',
            alias: ['carga docente', 'carga de docente', 'carga academica']
        },
        {
            nombre: 'Estructura Académica',
            titulo: 'Estructura Académica',
            descripcion:
                'Gestión de facultades, programas, planes de estudio y asignaturas.',
            icono: 'bi-diagram-3-fill',
            ruta: '/Estructura_Académica',
            alias: [
                'estructura academica',
                'facultades',
                'programas academicos',
                'asignaturas'
            ]
        },
        {
            nombre: 'Horarios Grupos',
            titulo: 'Horarios Grupos',
            descripcion:
                'Asignación y programación de horarios por grupos académicos.',
            icono: 'bi-calendar3-range-fill',
            ruta: '/Grupos_Horarios',
            alias: [
                'horarios grupos',
                'horarios',
                'grupos',
                'grupos y horarios'
            ]
        },
        {
            nombre: 'Evaluación Docente',
            titulo: 'Evaluación de Desempeño',
            descripcion:
                'Encuestas de par académico, autoevaluación y evaluación estudiantil.',
            icono: 'bi-star-fill',
            ruta: '/Evaluación_Desempeño',
            alias: [
                'evaluacion docente',
                'evaluacion de desempeno',
                'evaluacion desempeno',
                'evaluaciones'
            ]
        },
        {
            nombre: 'Analítica',
            titulo: 'Analítica',
            descripcion:
                'Consolidados por facultad con indicadores visuales y exportación.',
            icono: 'bi-bar-chart-fill',
            ruta: '/Analitica',
            alias: ['analitica', 'analitica institucional']
        }
    ];

    /**
     * Obtiene el nombre del módulo en los distintos formatos
     * que puede devolver la API.
     */
    function obtenerNombreModulo(modulo) {
        return norm(
            modulo?.nombre_modulo ??
            modulo?.nombre ??
            modulo?.modulo_nombre ??
            modulo?.modulo?.nombre_modulo ??
            modulo?.modulo?.nombre
        );
    }

    /**
     * Verifica si existe permiso de visualización para una tarjeta.
     */
    function permitido(tarjeta) {
        return modulos.some((modulo) => {
            const nombre = obtenerNombreModulo(modulo);

            const coincide = tarjeta.alias.some(
                (alias) => norm(alias) === nombre
            );

            return coincide && tienePermiso(modulo?.puede_ver);
        });
    }

    /**
     * Navega únicamente si el módulo está autorizado en la sesión.
     */
    async function abrirModulo(evento, tarjeta) {
        evento.preventDefault();
        mensaje = '';

        if (!permitido(tarjeta)) {
            mensaje =
                `No tienes permisos para acceder al módulo "${tarjeta.titulo}".`;
            return;
        }

        try {
            await goto(tarjeta.ruta);
        } catch (error) {
            console.error('Error al navegar:', error);
            mensaje = 'No se pudo abrir el módulo seleccionado.';
        }
    }
</script>

<svelte:head>
    <title>Inicio | Acta Docente</title>
    <meta
        name="description"
        content="Plataforma institucional de gestión de carga académica y evaluación docente."
    />
</svelte:head>

<Header />
<Navbar />

<main class="bg-light min-vh-100 py-5">
    <div class="container">

        {#if mensaje}
            <div
                class="alert alert-danger border-0 shadow-sm d-flex align-items-center gap-2 mb-4 mx-auto"
                style="max-width: 600px;"
                role="alert"
            >
                <i class="bi bi-shield-lock-fill fs-5"></i>

                <div class="fw-medium small flex-grow-1">
                    {mensaje}
                </div>

                <button
                    type="button"
                    class="btn-close"
                    onclick={() => (mensaje = '')}
                    aria-label="Cerrar"
                ></button>
            </div>
        {/if}

        <!-- Celular: saludo personalizado -->
        <div class="saludo-movil d-lg-none mb-4">
            <div class="flex-grow-1">
                <div class="small opacity-75">{saludo}{nombre ? ',' : ''}</div>
                <div class="fs-4 fw-bold lh-sm">{nombre || 'Bienvenido'} 👋</div>
                {#if rol}
                    <span class="badge rounded-pill insignia-rol mt-2"><i class="bi bi-shield-check me-1"></i>{rol}</span>
                {/if}
            </div>
            <div class="saludo-logo"><Imagen ancho="auto" alto="64px" alt="Logo CUL" /></div>
        </div>

        <div class="d-lg-none d-flex align-items-center justify-content-between mb-3">
            <h2 class="h6 fw-bold text-dark mb-0">Tus módulos</h2>
            <small class="text-muted">Toca para abrir</small>
        </div>

        <div class="text-center mb-5 d-none d-lg-block">
            <div class="mb-3">
                <Imagen ancho="auto" alto="90px" alt="Logo CUL" />
            </div>

            <h2 class="fw-bold mb-2 text-dark">
                Bienvenido a Carga Académica
            </h2>

            <p class="text-secondary mx-auto mb-0 descripcion-inicio">
                Plataforma institucional para la gestión de carga académica,
                estructura universitaria y evaluación de desempeño docente.
            </p>
        </div>

        {#if cargando}
            <div class="text-center py-5" role="status">
                <div
                    class="spinner-border"
                    style="color: #0f3460;"
                    aria-hidden="true"
                ></div>

                <p class="text-muted mt-3 mb-0">
                    Cargando módulos y permisos...
                </p>
            </div>
        {:else if modulos.length === 0}
            <div
                class="alert alert-warning border-0 shadow-sm mx-auto text-center"
                style="max-width: 600px;"
                role="alert"
            >
                <i class="bi bi-exclamation-circle fs-4 d-block mb-2"></i>

                <strong>No se encontraron permisos.</strong>

                <p class="small mb-0 mt-2">
                    Cierra sesión e ingresa nuevamente. Si el problema continúa,
                    solicita al administrador que revise los permisos de tu rol.
                </p>
            </div>
        {:else}
            <div class="row g-3 g-lg-4 justify-content-center">
                {#each tarjetas as tarjeta (tarjeta.nombre)}
                    {@const autorizado = permitido(tarjeta)}

                    <div class="col-6 col-lg-4 col-xl-3">
                        <a
                            href={tarjeta.ruta}
                            onclick={(evento) => abrirModulo(evento, tarjeta)}
                            class="text-decoration-none h-100 d-block"
                            aria-label={`Abrir ${tarjeta.titulo}`}
                            aria-disabled={!autorizado}
                        >
                            <div
                                class="card border-0 shadow-sm h-100 transition-hover"
                                class:tarjeta-bloqueada={!autorizado}
                            >
                                <div
                                    class="card-body text-center p-3 p-lg-4 d-flex flex-column align-items-center position-relative"
                                >
                                    {#if !autorizado}
                                        <span
                                            class="position-absolute top-0 end-0 m-2 badge bg-secondary bg-opacity-25 text-secondary rounded-pill"
                                            title="Sin permiso de visualización"
                                        >
                                            <i class="bi bi-lock-fill"></i>
                                        </span>
                                    {/if}

                                    <div
                                        class="mb-3 icono-tarjeta"
                                        class:icono-bloqueado={!autorizado}
                                    >
                                        <i
                                            class={`bi ${tarjeta.icono} fs-1`}
                                            aria-hidden="true"
                                        ></i>
                                    </div>

                                    <h6 class="fw-bold text-dark mb-2">
                                        {tarjeta.titulo}
                                    </h6>

                                    <p class="small text-muted mb-0 descripcion-tarjeta">
                                        {tarjeta.descripcion}
                                    </p>

                                    {#if !autorizado}
                                        <span class="small text-secondary mt-3">
                                            <i class="bi bi-lock me-1"></i>
                                            Acceso restringido
                                        </span>
                                    {:else}
                                        <span class="small mt-3 enlace-modulo">
                                            Abrir módulo
                                            <i class="bi bi-arrow-right ms-1"></i>
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </a>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</main>

<Footer />

<!-- Botón flotante de sugerencias -->
<BtnSugerencias />

<style>
    .descripcion-inicio {
        max-width: 600px;
    }

    .transition-hover {
        transition:
            transform 0.25s ease,
            box-shadow 0.25s ease;
        cursor: pointer;
    }

    .transition-hover:hover {
        transform: translateY(-6px);
        box-shadow: 0 0.75rem 1.25rem rgba(15, 52, 96, 0.12) !important;
    }

    .tarjeta-bloqueada {
        opacity: 0.7;
        cursor: not-allowed;
    }

    .tarjeta-bloqueada:hover {
        transform: none;
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
    }

    .icono-tarjeta {
        color: #0f3460;
    }

    .icono-bloqueado {
        color: #6c757d;
    }

    .enlace-modulo {
        color: #0f3460;
        font-weight: 600;
    }

    a:focus-visible .card {
        outline: 3px solid #86b7fe;
        outline-offset: 3px;
    }

    /* ── Celular ───────────────────────────────────────────────────── */
    .saludo-movil {
        display: flex;
        align-items: center;
        gap: 1rem;
        padding: 1.25rem;
        border-radius: 22px;
        color: #fff;
        background:
            radial-gradient(circle at 100% 0%, rgba(13, 202, 240, 0.25) 0%, transparent 50%),
            linear-gradient(135deg, #0f3460 0%, #1d5aa8 100%);
        box-shadow: 0 14px 32px rgba(15, 52, 96, 0.25);
    }

    .insignia-rol {
        background: rgba(255, 255, 255, 0.18);
        font-weight: 600;
    }

    .saludo-logo {
        flex-shrink: 0;
        filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.25));
    }

    @media (max-width: 991.98px) {
        .card {
            border-radius: 18px;
        }

        .icono-tarjeta {
            width: 52px;
            height: 52px;
            border-radius: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(15, 52, 96, 0.08);
            margin-bottom: 0.75rem !important;
        }

        .icono-tarjeta :global(i) {
            font-size: 1.5rem !important;
        }

        .icono-bloqueado {
            background: #eef0f3;
        }

        h6 {
            font-size: 0.9rem;
        }

        .descripcion-tarjeta {
            font-size: 0.74rem;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }

        .enlace-modulo,
        .card-body > span.small {
            font-size: 0.75rem;
            margin-top: 0.6rem !important;
        }

        .transition-hover:active {
            transform: scale(0.97);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .transition-hover {
            transition: none;
        }

        .transition-hover:hover {
            transform: none;
        }
    }
</style>