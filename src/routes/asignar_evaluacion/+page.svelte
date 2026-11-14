<!-- src/routes/asignar_evaluacion/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    import Alerta from '$lib/components/Alerta.svelte';
    import BtnSugerencias from '$lib/components/btnSugerencias.svelte';
    import Navbar from '$lib/components/navbar.svelte';
    import Footer from '$lib/components/footer.svelte';
    import Header from '$lib/components/header.svelte';
    import PageHeader from '$lib/components/PageHeader.svelte';

    import { evaluacionesApi } from '$lib/api/CargaDocenteApi.js';

    const COLOR = '#0f3460';

    // ---------- Utilidades ----------
    const normalizar = (v) =>
        String(v ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('es')
            .trim();

    const activo = (v) => {
        if (v === undefined || v === null) return false;
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v === 1;
        return ['true', '1', 'activo', 'activa', 'publicada', 'si', 'sí']
            .includes(String(v).trim().toLowerCase());
    };

    const idEvaluacion = (e) => e?.evaluacion_id ?? e?.id_evaluacion ?? e?.id;

    const lista = (d) =>
        Array.isArray(d)
            ? d
            : [d?.data, d?.evaluaciones].find(Array.isArray) ?? [];

    // ---------- Estado ----------
    let accesoVerificado = $state(false);
    let puedeAsignar = $state(false);

    let evaluaciones = $state([]);
    let cargando = $state(true);
    let procesando = $state(null); // id de la evaluación que se está actualizando
    let error = $state('');

    // Referencia al componente <Alerta />
    let avisos;

    const publicadas = $derived(evaluaciones.filter((e) => activo(e.estado)).length);

    // ---------- Permisos ----------
    // Solo el jefe de departamento (o dirección académica) puede asignar.
    // Ajusta los nombres si en tu sistema el rol se llama distinto.
    function verificarAcceso() {
        let rol = '';

        try {
            const u = JSON.parse(sessionStorage.getItem('usuario') || '{}') ?? {};
            rol =
                sessionStorage.getItem('usuario_rol') ??
                u.nombre_rol ??
                u.rol_nombre ??
                (typeof u.rol === 'string' ? u.rol : u.rol?.nombre_rol) ??
                '';
        } catch {}

        const r = normalizar(rol);
        puedeAsignar = r.includes('jefe') || r.includes('direccion');
        accesoVerificado = true;
    }

    // ---------- Carga ----------
    async function cargar() {
        cargando = true;
        error = '';

        try {
            evaluaciones = lista(await evaluacionesApi.listar());
        } catch (e) {
            error = e.message || 'No se pudieron cargar las evaluaciones.';
        } finally {
            cargando = false;
        }
    }

    onMount(() => {
        verificarAcceso();
        if (puedeAsignar) cargar();
        else cargando = false;
    });

    // ---------- Asignar / retirar ----------
    // Publicar una evaluación = que todos los docentes la vean en "Evaluación docente".
    async function cambiarEstado(evaluacion, publicar) {
        const id = idEvaluacion(evaluacion);
        const titulo = evaluacion.titulo || 'esta evaluación';

        const confirmado = await avisos.confirmar(
            publicar ? '¿Asignar a todos los docentes?' : '¿Retirar la evaluación?',
            publicar
                ? `"${titulo}" quedará disponible para todos los docentes.`
                : `"${titulo}" dejará de aparecerle a los docentes.`,
            {
                confirmar: publicar ? 'Sí, asignar' : 'Sí, retirar',
                peligro: !publicar
            }
        );

        if (!confirmado) return;

        procesando = id;

        try {
            // El PUT del backend suele exigir el objeto completo, por eso se envía todo.
            await evaluacionesApi.actualizar(id, { ...evaluacion, estado: publicar });

            evaluaciones = evaluaciones.map((e) =>
                idEvaluacion(e) === id ? { ...e, estado: publicar } : e
            );

            avisos.toastExito(
                publicar ? 'Evaluación asignada a todos los docentes' : 'Evaluación retirada'
            );
        } catch (e) {
            await avisos.fallo(e, 'No se pudo actualizar la evaluación');
        } finally {
            procesando = null;
        }
    }
</script>

<svelte:head>
    <title>Asignar evaluación | Acta Docente</title>
</svelte:head>

<Header />
<Navbar />

<main class="bg-light min-vh-100 p-4">
    <div class="container-fluid px-2 px-md-4">
        {#if !accesoVerificado}
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body text-center py-5">
                    <div class="spinner-border" style:color={COLOR} role="status"></div>
                    <p class="text-muted mt-3 mb-0">Verificando permisos de acceso...</p>
                </div>
            </div>
        {:else if !puedeAsignar}
            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body text-center py-5">
                    <i class="bi bi-shield-lock-fill fs-2 text-danger"></i>
                    <h3 class="fw-bold">Acceso no autorizado</h3>
                    <p class="text-muted mb-0">
                        Solo el jefe de departamento puede asignar evaluaciones.
                    </p>
                </div>
            </div>
        {:else}
            <PageHeader
                titulo="Asignar evaluaciones"
                descripcion="Elige qué evaluaciones se asignan a todos los docentes."
            >
                {#snippet acciones()}
                    <button class="btn btn-contorno" onclick={cargar} disabled={cargando}>
                        <i class="bi bi-arrow-clockwise me-1"></i>
                        Actualizar
                    </button>
                {/snippet}
            </PageHeader>

            {#if error}
                <div class="alert alert-danger d-flex justify-content-between align-items-center">
                    <span><i class="bi bi-exclamation-triangle-fill me-2"></i>{error}</span>
                    <button class="btn btn-sm btn-outline-danger" onclick={cargar} disabled={cargando}>
                        Reintentar
                    </button>
                </div>
            {/if}

            <div class="card border-0 shadow-sm rounded-4">
                <div class="card-body p-3 p-md-4">
                    <div class="d-flex justify-content-between align-items-center mb-3">
                        <h2 class="h5 fw-bold mb-0" style:color={COLOR}>Evaluaciones</h2>
                        {#if !cargando && evaluaciones.length}
                            <span class="badge text-bg-light border">
                                {publicadas} de {evaluaciones.length} asignadas
                            </span>
                        {/if}
                    </div>

                    {#if cargando}
                        <div class="text-center py-4">
                            <div class="spinner-border" style:color={COLOR} role="status"></div>
                            <p class="text-muted mt-2 mb-0">Cargando evaluaciones...</p>
                        </div>
                    {:else if !evaluaciones.length}
                        <div class="alert alert-info mb-0">No hay evaluaciones registradas.</div>
                    {:else}
                        <div class="table-responsive">
                            <table class="table align-middle mb-0">
                                <thead>
                                    <tr>
                                        <th>Evaluación</th>
                                        <th>Tipo</th>
                                        <th>Estado</th>
                                        <th class="text-end">Asignar a todos los docentes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each evaluaciones as evaluacion (idEvaluacion(evaluacion))}
                                        {@const id = idEvaluacion(evaluacion)}
                                        {@const asignada = activo(evaluacion.estado)}
                                        <tr>
                                            <td class="fw-semibold">
                                                {evaluacion.titulo || 'Evaluación sin título'}
                                            </td>
                                            <td class="text-muted">
                                                {evaluacion.tipo_evaluacion || '—'}
                                            </td>
                                            <td>
                                                {#if asignada}
                                                    <span class="badge text-bg-success">Asignada</span>
                                                {:else}
                                                    <span class="badge text-bg-secondary">Sin asignar</span>
                                                {/if}
                                            </td>
                                            <td class="text-end">
                                                {#if procesando === id}
                                                    <span class="spinner-border spinner-border-sm" style:color={COLOR}></span>
                                                {:else}
                                                    <div class="form-check form-switch d-inline-block m-0">
                                                        <input
                                                            class="form-check-input"
                                                            type="checkbox"
                                                            role="switch"
                                                            aria-label="Asignar {evaluacion.titulo ?? 'evaluación'} a todos los docentes"
                                                            checked={asignada}
                                                            disabled={procesando !== null}
                                                            onclick={(e) => {
                                                                // La confirmación decide el cambio; no se deja que el switch cambie solo.
                                                                e.preventDefault();
                                                                cambiarEstado(evaluacion, !asignada);
                                                            }}
                                                        />
                                                    </div>
                                                {/if}
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>
            </div>
        {/if}
    </div>
</main>

<Alerta bind:this={avisos} />

<Footer />
<BtnSugerencias />

<style>
    .form-check-input {
        width: 2.5rem;
        height: 1.3rem;
        cursor: pointer;
    }

    .form-check-input:checked {
        background-color: #0f3460;
        border-color: #0f3460;
    }
</style>