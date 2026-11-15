<!-- src/routes/Analitica/+page.svelte -->

<script>

    import { onMount } from 'svelte';

    import Header from '$lib/components/Header.svelte';

    import Navbar from '$lib/components/Navbar.svelte';

    import Footer from '$lib/components/Footer.svelte';

    import PageHeader from '$lib/components/PageHeader.svelte';



    import { peticion } from '$lib/api/CargaDocenteApi.js';



    const TIMEOUT_MS = 45000;



    // Solo se consultan los recursos que la página realmente usa.

    const RUTAS = {

        usuarios: '/usuarios/',

        roles: '/roles/',

        evaluaciones: '/evaluaciones/',

        preguntas: '/preguntas/',

        preguntasEvaluacion: '/preguntas-evaluacion/',

        respuestas: '/respuestas/'

    };



    const CLAVES_LISTA = [

        'data',

        'items',

        'resultados',

        'results',

        'usuarios',

        'evaluaciones',

        'preguntas',

        'respuestas',

        'preguntas_evaluacion'

    ];



    const ESTADOS = {

        completa: ['success', 'Completa'],

        pendiente: ['warning', 'Parcial'],

        sin_respuestas: ['secondary', 'Sin respuestas']

    };



    let cargando = $state(true);

    let error = $state('');

    let busqueda = $state('');

    let filtroEstado = $state('todos');

    let evaluacionSeleccionada = $state('');

    let detalleId = $state(null);

    let datos = $state(

        Object.fromEntries(Object.keys(RUTAS).map(k => [k, []]))

    );



    



    const extraerLista = r =>

        Array.isArray(r)

            ? r

            : CLAVES_LISTA.map(k => r?.[k]).find(Array.isArray) ?? [];



    const valor = (o, ...claves) => {

        for (const c of claves) {

            const v = o?.[c];

            if (v !== undefined && v !== null && v !== '') return v;

        }

    };



    const texto = (o, ...c) => String(valor(o, ...c) ?? '');

    const numero = (o, ...c) => Number(valor(o, ...c)) || 0;



    const activo = r => {

        const e = valor(r, 'estado', 'activo', 'is_active');



        return e === undefined ||

            (typeof e === 'boolean'

                ? e

                : !['false', '0', 'inactivo', 'inactive', 'no']

                    .includes(String(e).toLowerCase()));

    };



    const fechaNumero = r =>

        new Date(

            valor(

                r,

                'created_at',

                'fecha_creacion',

                'fecha',

                'updated_at'

            )

        ).getTime() || 0;



    // Comparador de más reciente: por fecha y, a igualdad, por id.

    const mas = (a, b) =>

        fechaNumero(a) - fechaNumero(b) ||

        numero(a, 'respuesta_id', 'id') -

        numero(b, 'respuesta_id', 'id');



    const idEvaluacion = e =>

        numero(e, 'evaluacion_id', 'id_evaluacion', 'id');



    function formatoFecha(fecha) {

        const d = new Date(fecha);



        return fecha && !isNaN(d)

            ? d.toLocaleString('es-CO', {

                dateStyle: 'medium',

                timeStyle: 'short'

            })

            : 'Sin fecha';

    }



    const nombreUsuario = u =>

        [

            valor(u, 'primer_nombre', 'nombre'),

            valor(u, 'segundo_nombre'),

            valor(u, 'primer_apellido', 'apellido'),

            valor(u, 'segundo_apellido')

        ]

            .filter(Boolean)

            .join(' ')

            .trim() ||

        texto(u, 'nombre_completo', 'nombre_usuario') ||

        texto(u, 'correo', 'email') ||

        'Usuario sin nombre';



    const consultar = ruta =>

        peticion(ruta, {

            raw: true,

            signal: AbortSignal.timeout(TIMEOUT_MS)

        });



    async function cargar() {

        cargando = true;

        error = '';



        try {

            const res = await Promise.all(

                Object.values(RUTAS).map(consultar)

            );



            datos = Object.fromEntries(

                Object.keys(RUTAS).map((k, i) => [

                    k,

                    extraerLista(res[i])

                ])

            );



            if (

                evaluacionSeleccionada &&

                !datos.evaluaciones.some(

                    e =>

                        activo(e) &&

                        String(idEvaluacion(e)) === evaluacionSeleccionada

                )

            ) {

                evaluacionSeleccionada = '';

            }

        } catch (e) {

            console.error('Error cargando analítica docente:', e);



            error =

                e?.message ||

                'No fue posible cargar la información. Verifica la conexión con la API.';

        } finally {

            cargando = false;

        }

    }



    onMount(cargar);



    const evalId = $derived(Number(evaluacionSeleccionada));



    const evaluacionesActivas = $derived(

        datos.evaluaciones.filter(activo)

    );



    const evaluacionActual = $derived(

        datos.evaluaciones.find(e => idEvaluacion(e) === evalId) ?? null

    );



    const docentes = $derived.by(() => {

        const roles = new Map(

            datos.roles.map(r => [

                numero(r, 'rol_id', 'role_id', 'id'),

                r

            ])

        );



        return datos.usuarios.filter(u => {

            const rol =

                texto(u, 'nombre_rol', 'rol', 'role') ||

                texto(

                    roles.get(numero(u, 'rol_id', 'role_id')),

                    'nombre_rol',

                    'nombre',

                    'rol'

                );



            return /docente|profesor|teacher/i.test(rol) && activo(u);

        });

    });



    const preguntasConTexto = $derived.by(() => {

        if (!evalId) return [];



        const base = new Map(

            datos.preguntas.map(p => [

                numero(p, 'pregunta_id', 'id'),

                p

            ])

        );



        return datos.preguntasEvaluacion

            .filter(

                p =>

                    numero(p, 'evaluacion_id', 'id_evaluacion') === evalId &&

                    activo(p) &&

                    numero(p, 'pregunta_evaluacion_id') > 0

            )

            .sort(

                (a, b) =>

                    numero(a, 'numero_orden', 'orden') -

                    numero(b, 'numero_orden', 'orden')

            )

            .map((rel, i) => ({

                pregunta_evaluacion_id: numero(

                    rel,

                    'pregunta_evaluacion_id'

                ),

                texto_pregunta:

                    texto(

                        rel,

                        'texto_pregunta',

                        'pregunta',

                        'enunciado'

                    ) ||

                    texto(

                        base.get(numero(rel, 'pregunta_id')),

                        'texto_pregunta',

                        'pregunta',

                        'enunciado'

                    ) ||

                    `Pregunta ${i + 1}`

            }));

    });



    // Respuestas activas de la evaluación elegida,

    // agrupadas por docente.

    const respuestasPorDocente = $derived.by(() => {

        const m = new Map();



        if (!evalId) return m;



        for (const r of datos.respuestas) {

            if (

                numero(r, 'evaluacion_id', 'id_evaluacion') !== evalId ||

                !activo(r)

            ) {

                continue;

            }



            const u = numero(r, 'usuario_id', 'user_id');



            m.has(u)

                ? m.get(u).push(r)

                : m.set(u, [r]);

        }



        return m;

    });



    // Cada docente con su progreso.

    const todas = $derived(

        docentes.map(d => {

            const id = numero(d, 'usuario_id', 'user_id', 'id');

            const lista = respuestasPorDocente.get(id) ?? [];

            const ultimas = new Map();



            for (const r of lista) {

                const k = numero(r, 'pregunta_evaluacion_id');



                if (

                    k &&

                    (!ultimas.has(k) || mas(r, ultimas.get(k)) > 0)

                ) {

                    ultimas.set(k, r);

                }

            }



            const total = preguntasConTexto.length;



            const contestadas = preguntasConTexto.filter(

                p =>

                    valor(

                        ultimas.get(p.pregunta_evaluacion_id),

                        'puntaje'

                    ) !== undefined

            ).length;



            return {

                id,

                lista,

                ultimas,

                total,

                contestadas,

                nombre: nombreUsuario(d),

                correo: texto(d, 'correo', 'email'),

                porcentaje: total

                    ? Math.round((contestadas / total) * 100)

                    : 0,

                estado:

                    total > 0 && contestadas >= total

                        ? 'completa'

                        : ultimas.size

                            ? 'pendiente'

                            : 'sin_respuestas'

            };

        })

    );



    const filas = $derived.by(() => {

        const t = busqueda.trim().toLowerCase();



        return todas

            .filter(

                d =>

                    (!t ||

                        d.nombre.toLowerCase().includes(t) ||

                        d.correo.toLowerCase().includes(t)) &&

                    (filtroEstado === 'todos' ||

                        d.estado === filtroEstado)

            )

            .sort((a, b) =>

                a.nombre.localeCompare(b.nombre, 'es')

            );

    });



    const tarjetas = $derived.by(() => {

        const n = k =>

            todas.filter(d => d.estado === k).length;



        return [

            ['Docentes', todas.length, ''],

            ['Evaluaciones completas', n('completa'), 'text-success'],

            ['Pendientes', n('pendiente'), 'text-warning'],

            ['Sin respuestas', n('sin_respuestas'), 'text-secondary']

        ];

    });



    const docenteSeleccionado = $derived(

        todas.find(d => d.id === detalleId) ?? null

    );



    const detalleRespuestas = $derived(

        preguntasConTexto.map(p => {

            const r = docenteSeleccionado?.ultimas.get(

                p.pregunta_evaluacion_id

            );



            const puntaje = valor(r, 'puntaje');



            return {

                ...p,

                puntaje,

                fecha: valor(r, 'created_at', 'fecha_creacion'),

                respondida: puntaje !== undefined

            };

        })

    );



    // Se muestra solo el comentario más reciente.

    const comentarioGeneral = $derived(

        docenteSeleccionado?.lista

            .filter(

                r =>

                    typeof r.comentario === 'string' &&

                    r.comentario.trim()

            )

            .sort((a, b) => mas(b, a))[0]

            ?.comentario.trim() ?? ''

    );

</script>



<svelte:head>

    <title>Analítica Docente | Acta Docente</title>

    <meta

        name="description"

        content="Seguimiento de las evaluaciones y respuestas docentes."

    />

</svelte:head>



<div class="pagina">

    <Header />

    <Navbar />



    <main class="container-fluid px-3 px-lg-4 py-4">



        <!-- Título y descripción -->

        <PageHeader>

            {#snippet acciones()}

                <button

                    type="button"

                    class="btn btn-contorno"

                    onclick={cargar}

                    disabled={cargando}

                >

                    {#if cargando}

                        <span class="spinner-border spinner-border-sm me-2"></span>

                        Actualizando...

                    {:else}

                        <i class="bi bi-arrow-clockwise me-1"></i>

                        Actualizar datos

                    {/if}

                </button>

            {/snippet}

        </PageHeader>



        <!-- ERROR DE CARGA -->

        {#if error}

            <div class="alert alert-danger" role="alert">

                <strong>No se pudo cargar la analítica.</strong>

                <p class="mb-2">{error}</p>

                <button

                    class="btn btn-sm btn-outline-danger"

                    onclick={cargar}

                >

                    Reintentar

                </button>

            </div>

        {/if}



        <!-- SELECTOR DE EVALUACIÓN -->

        <section class="card shadow-sm mb-4">

            <div class="card-body">

                <label for="evaluacion" class="form-label fw-semibold">

                    Evaluación que deseas consultar

                </label>



                <select

                    id="evaluacion"

                    class="form-select"

                    bind:value={evaluacionSeleccionada}

                    disabled={cargando}

                >

                    <option value="">Selecciona una evaluación</option>



                    {#each evaluacionesActivas as e (idEvaluacion(e))}

                        <option value={String(idEvaluacion(e))}>

                            {texto(e, 'titulo', 'nombre_evaluacion') ||

                                `Evaluación ${idEvaluacion(e)}`}

                            {texto(e, 'tipo_evaluacion')

                                ? ` — ${texto(e, 'tipo_evaluacion')}`

                                : ''}

                        </option>

                    {/each}

                </select>



                {#if evaluacionActual}

                    <p class="text-secondary small mt-2 mb-0">

                        Preguntas asociadas:

                        <strong>{preguntasConTexto.length}</strong>

                    </p>

                {/if}

            </div>

        </section>



        <!-- ESTADÍSTICAS Y SEGUIMIENTO -->

        {#if evaluacionSeleccionada}



            <section class="row g-3 mb-4">

                {#each tarjetas as [titulo, n, color] (titulo)}

                    <div class="col-12 col-sm-6 col-xl-3">

                        <div class="card shadow-sm h-100">

                            <div class="card-body">

                                <p class="text-secondary mb-1">

                                    {titulo}

                                </p>

                                <div class="display-6 fw-bold {color}">

                                    {n}

                                </div>

                            </div>

                        </div>

                    </div>

                {/each}

            </section>



            <!-- TABLA DE DOCENTES -->

            <section class="card shadow-sm">

                <div class="card-header bg-white py-3">

                    <h2 class="h5 mb-0">

                        Seguimiento por docente

                    </h2>

                </div>



                <div class="card-body border-bottom">

                    <div class="row g-3">



                        <div class="col-12 col-md-7">

                            <label for="busqueda" class="form-label">

                                Buscar docente

                            </label>



                            <input

                                id="busqueda"

                                class="form-control"

                                placeholder="Nombre o correo..."

                                bind:value={busqueda}

                            />

                        </div>



                        <div class="col-12 col-md-5">

                            <label for="filtroEstado" class="form-label">

                                Estado de la evaluación

                            </label>



                            <select

                                id="filtroEstado"

                                class="form-select"

                                bind:value={filtroEstado}

                            >

                                <option value="todos">

                                    Todos los estados

                                </option>



                                {#each Object.entries(ESTADOS) as [k, [, etiqueta]] (k)}

                                    <option value={k}>

                                        {etiqueta}

                                    </option>

                                {/each}

                            </select>

                        </div>



                    </div>

                </div>



                {#if cargando}

                    <div class="text-center py-5">

                        <div

                            class="spinner-border text-primary"

                            role="status"

                        ></div>



                        <p class="text-secondary mt-3 mb-0">

                            Cargando información...

                        </p>

                    </div>



                {:else if !preguntasConTexto.length}



                    <div class="alert alert-warning m-3">

                        No se encontraron preguntas relacionadas con esta

                        evaluación. Verifica los registros de

                        <code>preguntas_evaluacion</code>.

                    </div>



                {:else if !filas.length}



                    <p class="text-center text-secondary py-5 mb-0">

                        No hay docentes que coincidan con los filtros.

                    </p>



                {:else}



                    <div class="table-responsive">

                        <table class="table table-hover align-middle mb-0">

                            <thead class="table-light">

                                <tr>

                                    <th class="ps-3">Docente</th>

                                    <th>Progreso</th>

                                    <th>Estado</th>

                                    <th class="text-end pe-3">Detalle</th>

                                </tr>

                            </thead>



                            <tbody>

                                {#each filas as d (d.id)}

                                    <tr>

                                        <td class="ps-3">

                                            <div class="fw-semibold">

                                                {d.nombre}

                                            </div>



                                            <small class="text-secondary">

                                                {d.correo || 'Sin correo'}

                                            </small>

                                        </td>



                                        <td style="min-width: 150px;">

                                            <div

                                                class="d-flex justify-content-between small mb-1"

                                            >

                                                <span>

                                                    {d.contestadas} de {d.total}

                                                </span>



                                                <span>{d.porcentaje}%</span>

                                            </div>



                                            <div

                                                class="progress"

                                                role="progressbar"

                                                aria-label="Progreso de evaluación"

                                                aria-valuenow={d.porcentaje}

                                                aria-valuemin="0"

                                                aria-valuemax="100"

                                                style="height: 8px;"

                                            >

                                                <div

                                                    class="progress-bar"

                                                    class:bg-success={d.estado === 'completa'}

                                                    style="width: {d.porcentaje}%"

                                                ></div>

                                            </div>

                                        </td>



                                        <td>

                                            <span

                                                class="badge text-bg-{ESTADOS[d.estado][0]}"

                                            >

                                                {ESTADOS[d.estado][1]}

                                            </span>

                                        </td>



                                        <td class="text-end pe-3">

                                            <button

                                                type="button"

                                                class="btn btn-sm btn-outline-primary"

                                                onclick={() => (detalleId = d.id)}

                                            >

                                                Ver respuestas

                                            </button>

                                        </td>

                                    </tr>

                                {/each}

                            </tbody>

                        </table>

                    </div>



                    <div class="card-footer bg-white text-secondary small">

                        Mostrando {filas.length} docentes.

                    </div>



                {/if}

            </section>



        {:else}



            <div class="card shadow-sm">

                <div class="card-body text-center py-5">

                    <h2 class="h5">Selecciona una evaluación</h2>



                    <p class="text-secondary mb-0">

                        Podrás consultar el progreso de los docentes

                        y revisar sus respuestas.

                    </p>

                </div>

            </div>



        {/if}



    </main>

</div>



<!-- MODAL DE RESPUESTAS -->

{#if docenteSeleccionado}



    <div

        class="modal-backdrop-custom"

        role="presentation"

        onclick={() => (detalleId = null)}

    ></div>



    <div

        class="modal d-block"

        role="dialog"

        aria-modal="true"

        aria-labelledby="tituloDetalle"

        tabindex="-1"

    >

        <div class="modal-dialog modal-lg modal-dialog-scrollable">

            <div class="modal-content">



                <div class="modal-header">

                    <div>

                        <h2 class="modal-title h5" id="tituloDetalle">

                            Respuestas del docente

                        </h2>



                        <p class="text-secondary small mb-0">

                            {docenteSeleccionado.nombre}

                        </p>

                    </div>



                    <button

                        type="button"

                        class="btn-close"

                        aria-label="Cerrar"

                        onclick={() => (detalleId = null)}

                    ></button>

                </div>



                <div class="modal-body">



                    {#if evaluacionActual}

                        <p class="mb-3">

                            <strong>Evaluación:</strong>

                            {texto(

                                evaluacionActual,

                                'titulo',

                                'nombre_evaluacion'

                            )}

                        </p>

                    {/if}



                    {#each detalleRespuestas as r, i (r.pregunta_evaluacion_id)}

                        <article class="border rounded p-3 mb-3">



                            <div

                                class="d-flex justify-content-between align-items-start gap-3"

                            >

                                <h3 class="h6 mb-2">

                                    {i + 1}. {r.texto_pregunta}

                                </h3>



                                <span

                                    class="badge text-nowrap text-bg-{r.respondida ? 'primary' : 'secondary'}"

                                >

                                    {r.respondida

                                        ? `${r.puntaje} / 5`

                                        : 'Sin responder'}

                                </span>

                            </div>



                            {#if r.respondida}



                                <div

                                    class="progress mt-2"

                                    role="progressbar"

                                    aria-label="Puntaje de la respuesta"

                                    aria-valuenow={Number(r.puntaje)}

                                    aria-valuemin="0"

                                    aria-valuemax="5"

                                    style="height: 6px;"

                                >

                                    <div

                                        class="progress-bar"

                                        style="width: {Math.max(

                                            0,

                                            Math.min(

                                                100,

                                                Number(r.puntaje) * 20

                                            )

                                        )}%"

                                    ></div>

                                </div>



                                {#if r.fecha}

                                    <small class="text-secondary d-block mt-2">

                                        Registrada: {formatoFecha(r.fecha)}

                                    </small>

                                {/if}



                            {/if}



                        </article>

                    {/each}



                    <section class="border rounded p-3 mt-4">

                        <h3 class="h6 fw-bold mb-2">

                            Retroalimentación general

                        </h3>



                        <p

                            class="mb-0 text-break"

                            class:text-secondary={!comentarioGeneral}

                        >

                            {comentarioGeneral ||

                                'No se registró retroalimentación general.'}

                        </p>

                    </section>



                </div>



                <div class="modal-footer">

                    <button

                        type="button"

                        class="btn btn-secondary"

                        onclick={() => (detalleId = null)}

                    >

                        Cerrar

                    </button>

                </div>



            </div>

        </div>

    </div>



{/if}



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





    .modal-backdrop-custom {

        position: fixed;

        inset: 0;

        background: rgb(0 0 0 / 50%);

        z-index: 1040;

    }



    .modal {

        z-index: 1050;

        overflow-y: auto;

    }



    .modal-content {

        border: 0;

        border-radius: .75rem;

    }



    .text-break {

        overflow-wrap: anywhere;

        white-space: pre-wrap;

    }

</style>



<Footer />
