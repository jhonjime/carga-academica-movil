
<script>
    import Header from '$lib/components/header.svelte';
    import Navbar from '$lib/components/navbar.svelte';
    import Footer from '$lib/components/footer.svelte';
    import PageHeader from '$lib/components/PageHeader.svelte';

    import { descargarReporte } from '$lib/api/CargaDocenteApi.js';

    // URL DEL BACKEND PUBLICADO EN RENDER
    const API_URL = 'https://api-carga-docente-vnek.onrender.com';

    // ==========================================
    // FILTROS
    // ==========================================

    let fechaInicio = $state('');
    let fechaFin = $state('');
    let programa = $state('');
    let apellido = $state('');
    let tipoEvaluacion = $state('');

    // ==========================================
    // ESTADOS DE DESCARGA
    // ==========================================

    let generandoReporte = $state(false);
    let mensajeReporte = $state('');
    let errorReporte = $state('');

    // ==========================================
    // ESTADOS DE ENVIO DE CORREO
    // ==========================================

    let destinatario = $state('');
    let tipoReporteCorreo = $state('CARGA_DOCENTE');
    let formatoCorreo = $state('PDF');

    let enviandoCorreo = $state(false);
    let mensajeCorreo = $state('');
    let errorCorreo = $state('');

    // ==========================================
    // FILTROS PARA EL BACKEND
    // ==========================================

    const filtrosReporte = () => ({
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        programa: programa.trim() || null,
        apellido: apellido.trim() || null,
        tipo_evaluacion: tipoEvaluacion || null
    });

    // ==========================================
    // OBTENER ID DEL USUARIO
    // ==========================================

    function obtenerUsuarioId() {
        const posiblesClaves = [
            'usuario',
            'user',
            'usuarioActual'
        ];

        for (const clave of posiblesClaves) {
            const contenido = sessionStorage.getItem(clave);

            if (!contenido) continue;

            try {
                const usuario = JSON.parse(contenido);

                const id =
                    usuario?.usuario_id ??
                    usuario?.id ??
                    usuario?.user_id;

                if (
                    id !== null &&
                    id !== undefined &&
                    Number.isInteger(Number(id)) &&
                    Number(id) > 0
                ) {
                    return Number(id);
                }

            } catch {
                // Continúa buscando en las demás claves
            }
        }

        const idDirecto = sessionStorage.getItem('usuario_id');

        if (
            idDirecto &&
            Number.isInteger(Number(idDirecto)) &&
            Number(idDirecto) > 0
        ) {
            return Number(idDirecto);
        }

        return null;
    }

    // ==========================================
    // OBTENER TOKEN
    // ==========================================

    function obtenerToken() {
        return (
            sessionStorage.getItem('token') ||
            sessionStorage.getItem('authToken') ||
            ''
        );
    }

    // ==========================================
    // VALIDAR FECHAS
    // ==========================================

    function validarFechas() {
        if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
            errorReporte =
                'La fecha inicial no puede ser posterior a la fecha final.';

            return false;
        }

        return true;
    }

    // ==========================================
    // DESCARGAR REPORTES
    // ==========================================

    async function generarReporte(tipo, formato) {
        if (generandoReporte || enviandoCorreo) return;

        mensajeReporte = '';
        errorReporte = '';

        if (!validarFechas()) return;

        const endpoints = {
            carga: {
                pdf: '/reportes/carga-docente/pdf',
                excel: '/reportes/carga-docente/excel'
            },

            evaluaciones: {
                pdf: '/reportes/evaluaciones/pdf',
                excel: '/reportes/evaluaciones/excel'
            }
        };

        const endpoint = endpoints[tipo]?.[formato];

        if (!endpoint) {
            errorReporte = 'El tipo de reporte solicitado no es válido.';
            return;
        }

        generandoReporte = true;

        try {
            await descargarReporte(endpoint, filtrosReporte());

            const nombreTipo =
                tipo === 'carga' ? 'carga docente' : 'evaluaciones';

            mensajeReporte =
                `El reporte de ${nombreTipo} en ${formato.toUpperCase()} se descargó correctamente.`;

        } catch (e) {
            console.error('Error generando reporte:', e);

            errorReporte =
                e?.message ||
                'No fue posible generar el reporte. Verifica la conexión con el servidor.';

        } finally {
            generandoReporte = false;
        }
    }

    // ==========================================
    // ENVIAR REPORTE POR CORREO
    // ==========================================

    async function enviarReporteCorreo() {
        if (enviandoCorreo || generandoReporte) return;

        mensajeCorreo = '';
        errorCorreo = '';
        errorReporte = '';

        // Validar destinatario
        const correo = destinatario.trim();

        const patronCorreo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!correo || !patronCorreo.test(correo)) {
            errorCorreo = 'Ingresa un correo electrónico válido.';
            return;
        }

        // Validar fechas
        if (!validarFechas()) {
            errorCorreo = errorReporte;
            errorReporte = '';
            return;
        }

        // Obtener usuario
        const usuarioId = obtenerUsuarioId();

        if (!usuarioId) {
            errorCorreo =
                'No se encontró el ID del usuario. Verifica los datos de sesión.';
            return;
        }

        enviandoCorreo = true;

        try {
            const parametros = new URLSearchParams({
                usuario_id: String(usuarioId)
            });

            const token = obtenerToken();

            const respuesta = await fetch(
                `${API_URL}/reportes/enviar-correo?${parametros.toString()}`,
                {
                    method: 'POST',

                    headers: {
                        'Content-Type': 'application/json',

                        ...(token
                            ? { Authorization: `Bearer ${token}` }
                            : {})
                    },

                    body: JSON.stringify({
                        destinatario: correo,
                        tipo_reporte: tipoReporteCorreo,
                        formato: formatoCorreo,
                        ...filtrosReporte()
                    })
                }
            );

            // Leer respuesta del backend
            const resultado = await respuesta.json();

            if (!respuesta.ok) {
                throw new Error(
                    resultado.detail ||
                    'No fue posible enviar el reporte.'
                );
            }

            mensajeCorreo =
                `El reporte fue enviado correctamente a ${correo}.`;

            destinatario = '';

        } catch (e) {
            console.error('Error enviando reporte:', e);

            errorCorreo =
                e?.message ||
                'Ocurrió un error al enviar el reporte.';

        } finally {
            enviandoCorreo = false;
        }
    }

    // ==========================================
    // LIMPIAR FILTROS
    // ==========================================

    function limpiarFiltrosReporte() {
        fechaInicio = '';
        fechaFin = '';
        programa = '';
        apellido = '';
        tipoEvaluacion = '';

        mensajeReporte = '';
        errorReporte = '';

        mensajeCorreo = '';
        errorCorreo = '';
    }
</script>

<svelte:head>
    <title>Exportaciones | Acta Docente</title>
    <meta
        name="description"
        content="Generación, descarga y envío de reportes en PDF y Excel."
    />
</svelte:head>

<div class="pagina">

    <Header />
    <Navbar />

    <main class="container-fluid px-3 px-lg-4 py-4">

        <PageHeader />

        <!-- ==================================
             FILTROS DE BUSQUEDA
        =================================== -->

        <section class="card shadow-sm mb-4">

            <div class="card-body">

                <h2 class="h5 fw-bold mb-3">
                    <i class="bi bi-funnel me-2 text-primary"></i>
                    Filtros de búsqueda
                </h2>

                <div class="row g-3">

                    <div class="col-12 col-md-6 col-lg-3">

                        <label for="fechaInicio" class="form-label">
                            Fecha inicial
                        </label>

                        <input
                            id="fechaInicio"
                            type="date"
                            class="form-control"
                            bind:value={fechaInicio}
                            disabled={generandoReporte || enviandoCorreo}
                        />

                    </div>

                    <div class="col-12 col-md-6 col-lg-3">

                        <label for="fechaFin" class="form-label">
                            Fecha final
                        </label>

                        <input
                            id="fechaFin"
                            type="date"
                            class="form-control"
                            bind:value={fechaFin}
                            disabled={generandoReporte || enviandoCorreo}
                        />

                    </div>

                    <div class="col-12 col-md-6 col-lg-3">

                        <label for="programa" class="form-label">
                            Programa académico
                        </label>

                        <input
                            id="programa"
                            type="text"
                            class="form-control"
                            placeholder="Nombre del programa"
                            bind:value={programa}
                            disabled={generandoReporte || enviandoCorreo}
                        />

                    </div>

                    <div class="col-12 col-md-6 col-lg-3">

                        <label for="apellido" class="form-label">
                            Apellido del docente
                        </label>

                        <input
                            id="apellido"
                            type="text"
                            class="form-control"
                            placeholder="Ingrese el apellido"
                            bind:value={apellido}
                            disabled={generandoReporte || enviandoCorreo}
                        />

                    </div>

                    <div class="col-12 col-md-6 col-lg-4">

                        <label for="tipoEvaluacion" class="form-label">
                            Tipo de evaluación
                        </label>

                        <select
                            id="tipoEvaluacion"
                            class="form-select"
                            bind:value={tipoEvaluacion}
                            disabled={generandoReporte || enviandoCorreo}
                        >
                            <option value="">Todos los tipos</option>

                            <option value="AUTOEVALUACION">
                                Autoevaluación
                            </option>

                            <option value="COEVALUACION">
                                Coevaluación
                            </option>

                            <option value="HETEROEVALUACION">
                                Heteroevaluación
                            </option>
                        </select>

                    </div>

                    <div class="col-12 col-md-6 col-lg-8 d-flex align-items-end justify-content-md-end">

                        <button
                            type="button"
                            class="btn btn-outline-secondary"
                            onclick={limpiarFiltrosReporte}
                            disabled={generandoReporte || enviandoCorreo}
                        >
                            <i class="bi bi-eraser me-1"></i>
                            Limpiar filtros
                        </button>

                    </div>

                </div>

            </div>

        </section>

        <!-- ==================================
             DESCARGAR REPORTES
        =================================== -->

        <section class="card shadow-sm mb-4">

            <div class="card-body">

                <h2 class="h5 fw-bold mb-3">
                    <i class="bi bi-download me-2 text-primary"></i>
                    Descargar reportes
                </h2>

                <div class="row g-3">

                    <!-- CARGA DOCENTE -->

                    <div class="col-12 col-lg-6">

                        <div class="reporte-opcion h-100">

                            <div class="d-flex align-items-center gap-3 mb-3">

                                <div class="reporte-icono carga-icono">
                                    <i class="bi bi-person-workspace"></i>
                                </div>

                                <div>
                                    <h3 class="h6 fw-bold mb-1">
                                        Reporte de carga docente
                                    </h3>

                                    <p class="small text-secondary mb-0">
                                        Información de docentes, programas,
                                        asignaturas y periodos académicos.
                                    </p>
                                </div>

                            </div>

                            <div class="d-flex flex-wrap gap-2">

                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    onclick={() => generarReporte('carga', 'pdf')}
                                    disabled={generandoReporte || enviandoCorreo}
                                >
                                    {#if generandoReporte}
                                        <span class="spinner-border spinner-border-sm me-1"></span>
                                    {:else}
                                        <i class="bi bi-file-earmark-pdf me-1"></i>
                                    {/if}

                                    Descargar PDF
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-success"
                                    onclick={() => generarReporte('carga', 'excel')}
                                    disabled={generandoReporte || enviandoCorreo}
                                >
                                    <i class="bi bi-file-earmark-excel me-1"></i>
                                    Descargar Excel
                                </button>

                            </div>

                        </div>

                    </div>

                    <!-- EVALUACIONES -->

                    <div class="col-12 col-lg-6">

                        <div class="reporte-opcion h-100">

                            <div class="d-flex align-items-center gap-3 mb-3">

                                <div class="reporte-icono evaluacion-icono">
                                    <i class="bi bi-clipboard-data"></i>
                                </div>

                                <div>
                                    <h3 class="h6 fw-bold mb-1">
                                        Reporte de evaluaciones docentes
                                    </h3>

                                    <p class="small text-secondary mb-0">
                                        Resultados, tipos de evaluación,
                                        respuestas y promedios.
                                    </p>
                                </div>

                            </div>

                            <div class="d-flex flex-wrap gap-2">

                                <button
                                    type="button"
                                    class="btn btn-danger"
                                    onclick={() => generarReporte('evaluaciones', 'pdf')}
                                    disabled={generandoReporte || enviandoCorreo}
                                >
                                    {#if generandoReporte}
                                        <span class="spinner-border spinner-border-sm me-1"></span>
                                    {:else}
                                        <i class="bi bi-file-earmark-pdf me-1"></i>
                                    {/if}

                                    Descargar PDF
                                </button>

                                <button
                                    type="button"
                                    class="btn btn-success"
                                    onclick={() => generarReporte('evaluaciones', 'excel')}
                                    disabled={generandoReporte || enviandoCorreo}
                                >
                                    <i class="bi bi-file-earmark-excel me-1"></i>
                                    Descargar Excel
                                </button>

                            </div>

                        </div>

                    </div>

                </div>

                {#if generandoReporte}
                    <div class="alert alert-info mt-3 mb-0">
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        Generando el reporte. Por favor, espera...
                    </div>
                {/if}

                {#if mensajeReporte}
                    <div class="alert alert-success mt-3 mb-0" role="status">
                        <i class="bi bi-check-circle-fill me-2"></i>
                        {mensajeReporte}
                    </div>
                {/if}

                {#if errorReporte}
                    <div class="alert alert-danger mt-3 mb-0" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        {errorReporte}
                    </div>
                {/if}

            </div>

        </section>

        <!-- ==================================
             ENVIAR REPORTES POR CORREO
        =================================== -->

        <section class="card shadow-sm mb-4">

            <div class="card-body">

                <h2 class="h5 fw-bold mb-2">
                    <i class="bi bi-envelope me-2 text-primary"></i>
                    Enviar reportes por correo
                </h2>

                <p class="text-secondary small mb-4">
                    Envía automáticamente un reporte PDF o Excel
                    al correo electrónico que indiques.
                </p>

                <form onsubmit={(event) => {
                    event.preventDefault();
                    enviarReporteCorreo();
                }}>

                    <div class="row g-3">

                        <!-- DESTINATARIO -->

                        <div class="col-12 col-md-6">

                            <label for="destinatario" class="form-label">
                                Correo del destinatario
                            </label>

                            <input
                                id="destinatario"
                                type="email"
                                class="form-control"
                                placeholder="persona@correo.com"
                                bind:value={destinatario}
                                required
                                maxlength="254"
                                disabled={enviandoCorreo || generandoReporte}
                            />

                            <div class="form-text">
                                Escribe el correo de la persona que recibirá
                                el reporte.
                            </div>

                        </div>

                        <!-- TIPO DE REPORTE -->

                        <div class="col-12 col-md-3">

                            <label for="tipoReporteCorreo" class="form-label">
                                Tipo de reporte
                            </label>

                            <select
                                id="tipoReporteCorreo"
                                class="form-select"
                                bind:value={tipoReporteCorreo}
                                disabled={enviandoCorreo || generandoReporte}
                            >
                                <option value="CARGA_DOCENTE">
                                    Carga docente
                                </option>

                                <option value="EVALUACIONES">
                                    Evaluaciones
                                </option>
                            </select>

                        </div>

                        <!-- FORMATO -->

                        <div class="col-12 col-md-3">

                            <label for="formatoCorreo" class="form-label">
                                Formato
                            </label>

                            <select
                                id="formatoCorreo"
                                class="form-select"
                                bind:value={formatoCorreo}
                                disabled={enviandoCorreo || generandoReporte}
                            >
                                <option value="PDF">PDF</option>
                                <option value="EXCEL">Excel</option>
                            </select>

                        </div>

                        <!-- BOTON ENVIAR -->

                        <div class="col-12">

                            <button
                                type="submit"
                                class="btn btn-primary"
                                disabled={enviandoCorreo || generandoReporte}
                            >

                                {#if enviandoCorreo}
                                    <span class="spinner-border spinner-border-sm me-2"></span>
                                    Enviando reporte...
                                {:else}
                                    <i class="bi bi-send me-2"></i>
                                    Enviar reporte por correo
                                {/if}

                            </button>

                        </div>

                    </div>

                </form>

                <!-- ESTADO DEL ENVIO -->

                {#if mensajeCorreo}
                    <div class="alert alert-success mt-3 mb-0" role="status">
                        <i class="bi bi-check-circle-fill me-2"></i>
                        {mensajeCorreo}
                    </div>
                {/if}

                {#if errorCorreo}
                    <div class="alert alert-danger mt-3 mb-0" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2"></i>
                        {errorCorreo}
                    </div>
                {/if}

                {#if enviandoCorreo}
                    <div class="alert alert-info mt-3 mb-0">
                        <span class="spinner-border spinner-border-sm me-2"></span>
                        Preparando y enviando el reporte. Por favor, espera...
                    </div>
                {/if}

            </div>

        </section>

    </main>

</div>

<Footer />

<style>
    .pagina {
        min-height: 100vh;
        background: #f7f8fa;
    }

    .card {
        border: 1px solid #e6e9ef;
        border-radius: .75rem;
    }

    .card-header,
    .card-footer {
        border-color: #e6e9ef;
    }

    .reporte-opcion {
        padding: 1.25rem;
        border: 1px solid #e6e9ef;
        border-radius: .75rem;
        background: #fff;
        transition: box-shadow .2s ease, transform .2s ease;
    }

    .reporte-opcion:hover {
        box-shadow: 0 4px 14px rgb(0 0 0 / 7%);
        transform: translateY(-2px);
    }

    .reporte-icono {
        width: 48px;
        height: 48px;
        min-width: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: .75rem;
        font-size: 1.5rem;
    }

    .carga-icono {
        background: #e8f0ff;
        color: #2457a6;
    }

    .evaluacion-icono {
        background: #e5f5ed;
        color: #198754;
    }

    @media (max-width: 576px) {
        .reporte-opcion {
            padding: 1rem;
        }

        .reporte-opcion .btn {
            flex: 1;
        }
    }
</style>
