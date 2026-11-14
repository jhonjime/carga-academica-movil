<script>
    import { goto } from '$app/navigation';
    import Imagen from '$lib/components/Imagen.svelte';
    import { autenticacionApi } from '$lib/api/CargaDocenteApi.js';

    const ANIO = new Date().getFullYear();

    const BENEFICIOS = [
        'Gestión de carga docente',
        'Administración de usuarios y roles',
        'Evaluación del desempeño '
    ];

    // Credenciales de ejemplo: cámbialas por usuarios existentes en tu API.
    // Solo se muestran en desarrollo para que no viajen en el bundle de producción.
    const MOSTRAR_ACCESOS = import.meta.env.DEV;
    const ACCESOS = MOSTRAR_ACCESOS
        ? [
              { id: 'direccion', icono: 'bi-building', titulo: 'Dirección', detalle: 'Académica', correo: 'beatriz.quintero@universidad.edu.co', password: '12345678' },
              { id: 'docente', icono: 'bi-person-workspace', titulo: 'Docente', detalle: 'Profesor', correo: 'maria.lopez@universidad.edu.co', password: '12345678' },
              { id: 'jefe', icono: 'bi-diagram-3', titulo: 'Jefe', detalle: 'Departamento', correo: 'sandra.fajardo@universidad.edu.co', password: '12345678' }
          ]
        : [];

    let email = $state('');
    let password = $state('');
    let cargando = $state(false);
    let verPassword = $state(false);
    let mensajeError = $state('');
    let mensajeExito = $state('');

    function seleccionarAcceso({ correo, password: clave }) {
        email = correo;
        password = clave;
        mensajeError = mensajeExito = '';
        verPassword = false;
    }

    function guardarSesion(data, correo) {
        const u = data.usuario;
        const r = data.rol ?? u.rol ?? u.nombre_rol ?? 'Sin rol';
        const obj = r && typeof r === 'object' ? r : null;

        const datos = {
            usuario: JSON.stringify(u),
            usuario_id: u.usuario_id ?? '',
            usuario_nombre:
                [u.primer_nombre, u.segundo_nombre, u.primer_apellido, u.segundo_apellido]
                    .filter(Boolean)
                    .join(' ') ||
                u.nombre ||
                'Usuario',
            usuario_correo: u.correo || correo,
            usuario_rol: obj ? (obj.nombre_rol ?? obj.nombre ?? 'Sin rol') : r,
            usuario_role_id: (obj ? (obj.rol_id ?? obj.role_id) : null) ?? u.rol_id ?? '',
            usuario_modulos: JSON.stringify(Array.isArray(data.modulos) ? data.modulos : []),
            // Token firmado por el backend; CargaDocenteApi.js lo envía en cada petición.
            token: data.token ?? ''
        };

        for (const [k, v] of Object.entries(datos)) sessionStorage.setItem(k, String(v));
        window.dispatchEvent(new Event('sesionActualizada'));
    }

    async function manejarLogin(e) {
        e.preventDefault();
        if (cargando) return;

        mensajeError = mensajeExito = '';
        const correo = email.trim();

        if (!correo || !password) {
            mensajeError = 'Ingresa tu correo electrónico y contraseña.';
            return;
        }

        cargando = true;

        try {
            const data = await autenticacionApi.iniciarSesion({ correo, password });
            const u = data?.usuario;

            if (!u || typeof u !== 'object' || Array.isArray(u)) {
                throw new Error('La API respondió, pero no devolvió los datos esperados del usuario.');
            }

            guardarSesion(data, correo);
            mensajeExito = 'Inicio de sesión exitoso. Redirigiendo...';
            // Se mantiene "cargando" durante la redirección para evitar envíos duplicados.
            await goto('/inicio');
        } catch (error) {
            mensajeError =
                error?.message ||
                'No fue posible iniciar sesión. Verifica tus credenciales e inténtalo nuevamente.';
            cargando = false;
        }
    }
</script>

<svelte:head>
    <title>Iniciar sesión | Acta Docente</title>
    <meta name="description" content="Acceso al sistema de gestión y evaluación docente." />
</svelte:head>

<div class="min-vh-100 d-flex flex-column bg-light">
    <div class="row g-0 flex-grow-1">
        <div class="col-lg-6 d-none d-lg-flex flex-column p-5 text-white position-relative overflow-hidden panel">
            <div class="fondo"></div>

            <div class="d-flex flex-column align-items-start gap-3 position-relative">
                <div class="d-inline-flex align-items-center gap-2 px-3 py-2 rounded-pill bg-white bg-opacity-10 border border-white border-opacity-10">
                    <i class="bi bi-shield-check text-info"></i>
                    <span class="fw-semibold">Carga Académica</span>
                </div>

                <div class="logo">
                    <Imagen ancho="auto" alto="95px" alt="Logo institucional CUL" />
                </div>
            </div>

            <div class="pe-lg-5 mt-4 position-relative">
                <h1 class="display-5 fw-bold mb-3 lh-sm tracking-tight">Plataforma de Gestión Académica</h1>

                <p class="fs-5 text-white-50 mb-4 fw-light">
                    Administra asignaturas, programas, grupos y horarios docentes en un solo lugar.
                </p>

                <div class="d-flex flex-column gap-3 mt-4">
                    {#each BENEFICIOS as b}
                        <div class="d-flex align-items-center gap-3">
                            <i class="bi bi-check-circle text-info fs-4"></i>
                            <span>{b}</span>
                        </div>
                    {/each}
                </div>
            </div>

            <div class="mt-auto position-relative pt-5 text-white-50 small">
                <hr class="border-white border-opacity-10 mb-3" />
                <div class="d-flex justify-content-between">
                    <span>Sistema de Gestión Académica</span>
                    <span>&copy; {ANIO}</span>
                </div>
            </div>
        </div>

        <div class="col-lg-6 d-flex align-items-center justify-content-center p-4 p-sm-5 bg-white columna-form">
            <div class="w-100 formulario">
                <div class="d-lg-none text-center mb-4 hero-movil">
                    <div class="logo-movil mb-3">
                        <Imagen ancho="auto" alto="84px" alt="Logo institucional CUL" />
                    </div>
                    <div class="fw-bold fs-4 text-white">Carga Académica</div>
                    <p class="small mb-0 text-white-50">Gestión y evaluación docente</p>
                </div>

                <div class="tarjeta-login">

                {#if ACCESOS.length}
                    <div class="accesos-rapidos mb-4">
                        

                        <div class="row g-2">
                            {#each ACCESOS as acceso (acceso.id)}
                                <div class="col-4">
                                    <button type="button" class="btn btn-acceso w-100" onclick={() => seleccionarAcceso(acceso)} disabled={cargando}>
                                        <i class="bi {acceso.icono} d-block mb-1"></i>
                                        <span>{acceso.titulo}</span>
                                        <small>{acceso.detalle}</small>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                {/if}

                <div class="mb-4">
                    <h2 class="fw-bold mb-2 text-dark tracking-tight">Iniciar sesión</h2>
                    <p class="text-muted small mb-0">Ingresa las credenciales de tu cuenta institucional.</p>
                </div>

                {#if mensajeError}
                    <div class="alert alert-danger border-0 shadow-sm rounded-3 small d-flex align-items-start gap-2 mb-4" role="alert">
                        <i class="bi bi-exclamation-triangle-fill fs-5 flex-shrink-0"></i>
                        <div class="flex-grow-1 mensaje">{mensajeError}</div>
                        <button type="button" class="btn-close" onclick={() => (mensajeError = '')} aria-label="Cerrar mensaje"></button>
                    </div>
                {/if}

                {#if mensajeExito}
                    <div class="alert alert-success border-0 shadow-sm rounded-3 small d-flex align-items-center gap-2 mb-4" role="status">
                        <i class="bi bi-check-circle-fill fs-5 flex-shrink-0"></i>
                        <div>{mensajeExito}</div>
                    </div>
                {/if}

                <form onsubmit={manejarLogin}>
                    <div class="mb-3">
                        <label for="email" class="form-label fw-semibold text-secondary text-uppercase etiqueta">Correo electrónico</label>
                        <div class="input-group input-login">
                            <span class="input-group-text"><i class="bi bi-envelope"></i></span>
                            <input id="email" type="email" class="form-control" placeholder="usuario@institucion.edu.co" autocomplete="username" bind:value={email} required disabled={cargando} />
                        </div>
                    </div>

                    <div class="mb-4">
                        <label for="password" class="form-label fw-semibold text-secondary text-uppercase etiqueta">Contraseña</label>
                        <div class="input-group input-login">
                            <span class="input-group-text"><i class="bi bi-lock"></i></span>
                            <input id="password" type={verPassword ? 'text' : 'password'} class="form-control" placeholder="Ingresa tu contraseña" autocomplete="current-password" bind:value={password} required disabled={cargando} />
                            <button
                                type="button"
                                class="btn btn-light boton-password"
                                onclick={() => (verPassword = !verPassword)}
                                aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                aria-pressed={verPassword}
                                disabled={cargando}
                            >
                                <i class="bi {verPassword ? 'bi-eye-slash' : 'bi-eye'}"></i>
                            </button>
                        </div>
                    </div>

                    <button type="submit" class="btn w-100 text-white py-3 fw-semibold shadow-sm rounded-3 boton-ingresar" disabled={cargando}>
                        {#if cargando}
                            <span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>
                            Verificando credenciales...
                        {:else}
                            <i class="bi bi-box-arrow-in-right me-2"></i>
                            Ingresar al sistema
                        {/if}
                    </button>
                </form>

                <p class="text-center text-muted small mt-4 mb-0">
                    <i class="bi bi-shield-lock me-1"></i>
                    Acceso exclusivo para usuarios registrados.
                </p>

                </div>

                <div class="text-center mt-4 d-lg-none">
                    <small class="text-muted">&copy; {ANIO} Carga Académica · CUL</small>
                </div>
            </div>
        </div>
    </div>
</div>

<style>
    .panel {
        background: linear-gradient(145deg, #07182e 0%, #0f3460 60%, #16213e 100%);
    }

    .fondo {
        position: absolute;
        inset: 0;
        pointer-events: none;
        opacity: 0.5;
        background:
            radial-gradient(circle at 20% 20%, rgba(67, 97, 238, 0.4) 0%, transparent 50%),
            radial-gradient(circle at 90% 80%, rgba(13, 202, 240, 0.12) 0%, transparent 40%);
    }

    /* Contenedor del componente Imagen (panel izquierdo) */
    .logo {
        filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.3));
    }

    /* Contenedor del componente Imagen (versión móvil) */
    .logo-movil {
        max-width: 100%;
    }

    .formulario { max-width: 420px; }
    .color-principal { color: #0f3460; }
    .etiqueta { font-size: 0.75rem; letter-spacing: 0.05em; }
    .tracking-tight { letter-spacing: -0.02em; }
    .mensaje { overflow-wrap: anywhere; white-space: pre-line; }

    .accesos-rapidos {
        padding-bottom: 18px;
        border-bottom: 1px solid #e9ecef;
    }

    .btn-acceso {
        min-height: 78px;
        padding: 10px 4px;
        border: 1px solid #d8e2ef;
        border-radius: 12px;
        background: #f5f8fc;
        color: #0f3460;
        font-size: 0.78rem;
        font-weight: 700;
        line-height: 1.3;
        transition: background-color 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }

    .btn-acceso i { font-size: 1.15rem; }

    .btn-acceso small {
        display: block;
        margin-top: 2px;
        font-size: 0.68rem;
        font-weight: 400;
        color: #6c757d;
    }

    .btn-acceso:hover:not(:disabled) {
        background: #0f3460;
        color: #fff;
        border-color: #0f3460;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(15, 52, 96, 0.15);
    }

    .btn-acceso:hover:not(:disabled) small { color: #e5edf7; }

    .input-login .input-group-text,
    .input-login .form-control {
        min-height: 48px;
        background-color: #f8f9fa;
        border-color: #dee2e6;
    }

    .input-login .input-group-text {
        color: #6c757d;
        border-right: 0;
        padding-left: 15px;
    }

    .input-login .form-control {
        border-left: 0;
        box-shadow: none;
    }

    .input-login .form-control:focus,
    .input-login:focus-within .input-group-text {
        background-color: #fff;
        border-color: #86b7fe;
    }

    .boton-password {
        border-color: #dee2e6;
        background-color: #f8f9fa;
        color: #6c757d;
    }

    .boton-password:hover:not(:disabled) {
        background-color: #edf3fa;
        color: #0f3460;
    }

    .boton-ingresar {
        transition: background-color 0.2s ease-in-out, border-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out, transform 0.2s ease-in-out;
        background-color: #0f3460;
        border: 1px solid #0f3460;
    }

    .boton-ingresar:hover:not(:disabled) {
        background-color: #16213e;
        border-color: #16213e;
        box-shadow: 0 6px 16px rgba(15, 52, 96, 0.25);
        transform: translateY(-1px);
    }

    .boton-ingresar:disabled,
    .btn-acceso:disabled {
        opacity: 0.75;
        cursor: not-allowed;
    }

    /* ── Celular: cabecera institucional + tarjeta flotante ─────────── */
    @media (max-width: 991.98px) {
        .columna-form {
            align-items: flex-start !important;
            padding: calc(var(--sat) + 2.25rem) 1rem calc(var(--sab) + 1.5rem) !important;
            background:
                radial-gradient(circle at 85% 0%, rgba(13, 202, 240, 0.18) 0%, transparent 45%),
                linear-gradient(170deg, #07182e 0%, #0f3460 100%) top / 100% 300px no-repeat,
                #f3f6fb !important;
            min-height: 100dvh;
        }

        .logo-movil {
            filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.35));
        }

        .tarjeta-login {
            background: #fff;
            border-radius: 24px;
            padding: 1.5rem 1.25rem;
            box-shadow: 0 18px 40px rgba(15, 52, 96, 0.14);
        }

        .tarjeta-login h2 {
            font-size: 1.5rem;
        }

        .boton-ingresar {
            border-radius: 14px !important;
        }
    }

    @media (max-width: 380px) {
        .btn-acceso { font-size: 0.7rem; }
        .btn-acceso small { font-size: 0.62rem; }
    }

    @media (prefers-reduced-motion: reduce) {
        .btn-acceso,
        .boton-ingresar { transition: none; }
        .btn-acceso:hover:not(:disabled),
        .boton-ingresar:hover:not(:disabled) { transform: none; }
    }
</style>