
<script>
    import { onMount } from 'svelte';
    import Alerta from '$lib/components/Alerta.svelte';
    import BtnSugerencias from '$lib/components/btnSugerencias.svelte';
    import Navbar from '$lib/components/navbar.svelte';
    import Footer from '$lib/components/footer.svelte';
    import Header from '$lib/components/header.svelte';
    import PageHeader from '$lib/components/PageHeader.svelte';

    import { evaluacionDocenteApi } from '$lib/api/CargaDocenteApi.js';

    const COLOR = '#0f3460';

    const ETIQUETAS = [
        'Deficiente',
        'Regular',
        'Aceptable',
        'Bueno',
        'Excelente'
    ];

    let evaluaciones = $state([]);
    let seleccionada = $state('');
    let preguntas = $state([]);
    let puntajes = $state({});
    let comentario = $state('');

    let cargando = $state(true);
    let cargandoPreguntas = $state(false);
    let guardando = $state(false);
    let error = $state('');

    let avisos;

    const evaluacionSeleccionada = $derived(
        evaluaciones.find(
            (e) => String(e.evaluacion_id) === String(seleccionada)
        ) ?? null
    );

    const calificadas = $derived(
        preguntas.filter(
            (p) => puntajes[p.pregunta_evaluacion_id] != null
        ).length
    );

    function normalizarLista(datos, claves = []) {
        if (Array.isArray(datos)) return datos;

        if (!datos || typeof datos !== 'object') {
            return [];
        }

        for (const clave of claves) {
            if (Array.isArray(datos[clave])) {
                return datos[clave];
            }
        }

        if (datos.data && typeof datos.data === 'object') {
            return normalizarLista(datos.data, claves);
        }

        return [];
    }

    function activo(valor) {
        if (valor === undefined || valor === null) {
            return true;
        }

        if (typeof valor === 'boolean') {
            return valor;
        }

        if (typeof valor === 'number') {
            return valor === 1;
        }

        return ['true', '1', 'activo', 'activa']
            .includes(String(valor).trim().toLowerCase());
    }

    // Reconoce los campos que puede devolver la API.
    function yaRespondida(e) {
        const valor =
            e.ya_respondida ??
            e.yaRespondida ??
            e.completada ??
            e.respondida ??
            e.evaluacion_completada;

        if (valor === undefined || valor === null) {
            return false;
        }

        return activo(valor);
    }

    function reiniciarFormulario() {
        preguntas = [];
        puntajes = {};
        comentario = '';
    }

    async function cargar() {
        cargando = true;
        error = '';

        try {
            const resultado =
                await evaluacionDocenteApi.listarMisEvaluaciones();

            const lista = normalizarLista(resultado, [
                'evaluaciones',
                'data'
            ]);

            evaluaciones = lista.filter((e) => {
                const id = Number(e.evaluacion_id);

                const estaActiva = activo(
                    e.estado ?? e.evaluacion_activa
                );

                return (
                    Number.isInteger(id) &&
                    id > 0 &&
                    estaActiva &&
                    !yaRespondida(e)
                );
            });

            seleccionada = '';
            reiniciarFormulario();
        } catch (e) {
            error =
                e.message ||
                'No se pudieron cargar las evaluaciones.';
        } finally {
            cargando = false;
        }
    }

    async function cambiarEvaluacion() {
        reiniciarFormulario();
        error = '';

        if (!seleccionada) return;

        cargandoPreguntas = true;

        try {
            const resultado =
                await evaluacionDocenteApi.listarPreguntasDeEvaluacion(
                    seleccionada
                );

            preguntas = normalizarLista(resultado, [
                'preguntas',
                'preguntas_evaluacion',
                'data'
            ])
                .filter((p) => activo(p.estado))
                .map((p) => ({
                    ...p,

                    pregunta_evaluacion_id: Number(
                        p.pregunta_evaluacion_id ??
                        p.id_pregunta_evaluacion
                    ),

                    pregunta_id: Number(
                        p.pregunta_id ??
                        p.id_pregunta ??
                        p.pregunta?.pregunta_id
                    ),

                    texto_pregunta:
                        typeof p.pregunta === 'string'
                            ? p.pregunta
                            : p.texto_pregunta ||
                              p.pregunta?.texto_pregunta ||
                              'Pregunta sin texto'
                }))
                .filter((p) =>
                    Number.isInteger(p.pregunta_evaluacion_id) &&
                    p.pregunta_evaluacion_id > 0
                )
                .sort(
                    (a, b) =>
                        Number(a.numero_orden || 0) -
                        Number(b.numero_orden || 0)
                );
        } catch (e) {
            error =
                e.message ||
                'No se pudieron cargar las preguntas.';
        } finally {
            cargandoPreguntas = false;
        }
    }

    async function guardar() {
        if (guardando) return;

        if (!evaluacionSeleccionada) {
            return avisos.advertencia(
                'Selecciona una evaluación'
            );
        }

        if (preguntas.length !== 5) {
            return avisos.advertencia(
                'Cantidad incorrecta',
                `Esta evaluación tiene ${preguntas.length} preguntas. Debe tener exactamente cinco.`
            );
        }

        if (
            preguntas.some(
                (p) =>
                    !Number.isInteger(p.pregunta_id) ||
                    p.pregunta_id <= 0
            )
        ) {
            return avisos.error(
                'Error en las preguntas',
                'Falta el identificador de una pregunta. No se guardaron las respuestas.'
            );
        }

        if (calificadas !== 5) {
            return avisos.advertencia(
                'Evaluación incompleta',
                'Debes calificar las cinco preguntas.'
            );
        }

        const confirmado = await avisos.confirmar(
            '¿Enviar evaluación?',
            'Se guardarán tus cinco respuestas y el comentario general.',
            { confirmar: 'Sí, enviar' }
        );

        if (!confirmado) return;

        guardando = true;

        // Guardar los identificadores antes de limpiar el formulario.
        const idEnviada = String(seleccionada);
        const evaluacionEnviada = evaluacionSeleccionada;

        try {
            const usuarioGuardado = JSON.parse(
                sessionStorage.getItem('usuario') || 'null'
            );

            const usuarioId = Number(
                sessionStorage.getItem('usuario_id') ??
                usuarioGuardado?.usuario_id ??
                usuarioGuardado?.id
            );

            if (!Number.isInteger(usuarioId) || usuarioId <= 0) {
                throw new Error(
                    'Tu sesión no es válida. Cierra sesión e inicia nuevamente.'
                );
            }

            await evaluacionDocenteApi.guardar({
                usuario_id: usuarioId,
                evaluacion_id: Number(idEnviada),

                respuestas: preguntas.map((p) => ({
                    pregunta_evaluacion_id:
                        p.pregunta_evaluacion_id,

                    pregunta_id: p.pregunta_id,

                    puntaje: Number(
                        puntajes[p.pregunta_evaluacion_id]
                    ),

                    estado: true
                })),

                comentario: comentario.trim() || null
            });

            // La API confirmó que se guardó la evaluación.
            // Eliminarla inmediatamente de las evaluaciones pendientes.
            evaluaciones = evaluaciones.filter(
                (e) => String(e.evaluacion_id) !== idEnviada
            );

            seleccionada = '';
            reiniciarFormulario();
            error = '';

            // Mostrar confirmación sin volver a agregar la evaluación.
            await avisos.exito(
                '¡Evaluación enviada!',
                `La evaluación "${evaluacionEnviada.titulo || 'Evaluación docente'}" se guardó correctamente. Ya no aparecerá en tus pendientes.`
            );
        } catch (e) {
            await avisos.fallo(e, 'Error al enviar');
        } finally {
            guardando = false;
        }
    }

    onMount(cargar);
</script>

<svelte:head>
    <title>Evaluación Docente | Acta Docente</title>
    <meta
        name="description"
        content="Selecciona y responde tus evaluaciones docentes."
    />
</svelte:head>

<Header />
<Navbar />

<main class="bg-light min-vh-100 py-4 py-md-5">
    <div class="container">
        <PageHeader />

        <div class="card border-0 shadow-sm rounded-4">
            <div class="card-body p-3 p-md-4 p-lg-5">
                <p class="text-muted mb-4">
                    Selecciona una evaluación, responde las preguntas y envíala.
                </p>

                {#if cargando}
                    <div class="text-center py-4">
                        <div
                            class="spinner-border"
                            style:color={COLOR}
                            role="status"
                        ></div>

                        <p class="text-muted mt-2 mb-0">
                            Cargando evaluaciones...
                        </p>
                    </div>

                {:else if error && !seleccionada}
                    <div class="alert alert-danger">
                        {error}

                        <button
                            class="btn btn-sm btn-outline-danger ms-2"
                            onclick={cargar}
                        >
                            Reintentar
                        </button>
                    </div>

                {:else if evaluaciones.length === 0}
                    <div class="text-center py-5">
                        <div class="mb-3">
                            <span
                                class="d-inline-flex align-items-center justify-content-center rounded-circle"
                                style="width: 76px; height: 76px; background: #e8f5e9;"
                            >
                                <span
                                    style="font-size: 2rem; color: #198754;"
                                >
                                    ✓
                                </span>
                            </span>
                        </div>

                        <h3 class="h5 fw-bold">
                            No tienes evaluaciones pendientes
                        </h3>

                        <p class="text-muted mb-0">
                            Has completado tus evaluaciones disponibles
                            o todavía no tienes evaluaciones asignadas.
                        </p>
                    </div>

                {:else}
                    <label
                        for="evaluacion"
                        class="form-label fw-semibold"
                    >
                        Selecciona una evaluación
                    </label>

                    <select
                        id="evaluacion"
                        class="form-select form-select-lg mb-4"
                        bind:value={seleccionada}
                        onchange={cambiarEvaluacion}
                        disabled={guardando || cargandoPreguntas}
                    >
                        <option value="">
                            -- Selecciona una evaluación --
                        </option>

                        {#each evaluaciones as evaluacion (evaluacion.evaluacion_id)}
                            <option value={String(evaluacion.evaluacion_id)}>
                                {evaluacion.titulo || 'Evaluación sin título'}
                                {#if evaluacion.tipo_evaluacion}
                                    — {evaluacion.tipo_evaluacion}
                                {/if}
                            </option>
                        {/each}
                    </select>

                    {#if cargandoPreguntas}
                        <div class="text-center py-4">
                            <div
                                class="spinner-border"
                                style:color={COLOR}
                                role="status"
                            ></div>

                            <p class="text-muted mt-2">
                                Cargando preguntas...
                            </p>
                        </div>

                    {:else if error && seleccionada}
                        <div class="alert alert-danger">
                            {error}
                        </div>

                    {:else if evaluacionSeleccionada}
                        <hr class="my-4" />

                        <h3 class="h5 fw-bold mb-1">
                            {evaluacionSeleccionada.titulo}
                        </h3>

                        <p class="text-muted mb-4">
                            Califica cada pregunta del 1 al 5.
                        </p>

                        {#if preguntas.length !== 5}
                            <div class="alert alert-warning">
                                Esta evaluación tiene {preguntas.length}
                                preguntas activas. Se requieren exactamente
                                cinco para enviarla.
                            </div>
                        {/if}

                        {#each preguntas as pregunta, i (pregunta.pregunta_evaluacion_id)}
                            <div class="pregunta py-4">
                                <h4 class="h6 fw-semibold mb-3">
                                    {i + 1}. {pregunta.texto_pregunta}
                                </h4>

                                <div class="escala">
                                    {#each ETIQUETAS as etiqueta, k}
                                        {@const valor = k + 1}
                                        {@const elegido = Number(puntajes[pregunta.pregunta_evaluacion_id]) === valor}

                                        <button
                                            type="button"
                                            class="rating-btn"
                                            class:seleccionado={elegido}
                                            aria-pressed={elegido}
                                            disabled={guardando}
                                            onclick={() => {
                                                puntajes = {
                                                    ...puntajes,
                                                    [pregunta.pregunta_evaluacion_id]:
                                                        valor
                                                };
                                            }}
                                        >
                                            <strong>{valor}</strong>
                                            <small>{etiqueta}</small>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/each}

                        {#if preguntas.length === 5}
                            <label
                                for="comentario"
                                class="form-label fw-semibold mt-4"
                            >
                                Retroalimentación general
                                <span class="text-muted fw-normal">
                                    (opcional)
                                </span>
                            </label>

                            <textarea
                                id="comentario"
                                class="form-control"
                                rows="4"
                                maxlength="500"
                                placeholder="Escribe tus comentarios u observaciones..."
                                bind:value={comentario}
                                disabled={guardando}
                            ></textarea>

                            <div class="text-end text-muted small mt-1">
                                {comentario.length}/500 caracteres
                            </div>

                            <button
                                type="button"
                                class="btn text-white fw-semibold w-100 mt-4 py-3"
                                style:background-color={COLOR}
                                onclick={guardar}
                                disabled={guardando || calificadas !== 5}
                            >
                                {#if guardando}
                                    <span
                                        class="spinner-border spinner-border-sm me-2"
                                    ></span>
                                    Enviando evaluación...
                                {:else}
                                    Enviar evaluación
                                {/if}
                            </button>
                        {/if}
                    {/if}
                {/if}
            </div>
        </div>
    </div>
</main>

<Alerta bind:this={avisos} />

<Footer />
<BtnSugerencias />

<style>
    .pregunta {
        border-bottom: 1px solid #e5e7eb;
    }

    .escala {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: 0.5rem;
    }

    .rating-btn {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.3rem;
        padding: 0.75rem 0.2rem;
        border: 1px solid #dce3ed;
        border-radius: 0.75rem;
        background: #fff;
        color: #475569;
    }

    .rating-btn strong {
        font-size: 1.2rem;
    }

    .rating-btn small {
        font-size: 0.7rem;
        text-align: center;
    }

    .rating-btn:hover:not(:disabled) {
        border-color: #0f3460;
    }

    .rating-btn.seleccionado {
        border: 2px solid #0f3460;
        background: #eaf0f8;
        color: #0f3460;
    }

    @media (max-width: 400px) {
        .escala {
            gap: 0.25rem;
        }

        .rating-btn small {
            font-size: 0.6rem;
        }
    }
</style>