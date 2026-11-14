<script>
    import { onMount } from 'svelte';
    import Alerta from '$lib/components/Alerta.svelte';
    import Navbar from '$lib/components/navbar.svelte';
    import Footer from '$lib/components/footer.svelte';
    import Header from '$lib/components/header.svelte';

    import BtnSugerencias from '$lib/components/btnSugerencias.svelte';
    import PageHeader from '$lib/components/PageHeader.svelte';
    import DataTable from '$lib/components/DataTable.svelte';
    import ModalFormulario from '$lib/components/ModalFormulario.svelte';
    import {
        asignaturasApi,
        programasAcademicosApi,
        facultadesApi,
        cargaDocenteApi,
        gruposApi
    } from '$lib/api/CargaDocenteApi.js';

    const COLOR = '#0f3460';
    const CREDITOS_DEFECTO = 3;
    const REGEX_DOCENTE = /docente|profesor|teacher/;
    const CLAVES_PERMISO = ['puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar'];
    const VERDADEROS = new Set(['true', '1', 'activo', 'activa', 'si', 'sí']);

    const COLUMNAS = [
        { key: 'codigo_asignatura', label: 'CÓDIGO', sortable: true },
        { key: 'nombres_asignaturas', label: 'ASIGNATURA', sortable: true },
        { key: 'facultad', label: 'FACULTAD', sortable: true },
        { key: 'programa', label: 'PROGRAMA', sortable: true },
        { key: 'creditos', label: 'CRÉDITOS', sortable: true },
        { key: 'estado', label: 'ESTADO', type: 'status', sortable: true }
    ];

    // ---------- Utilidades (puras; candidatas a $lib/utils) ----------
    const aBooleano = (v) => {
        if (typeof v === 'boolean') return v;
        if (typeof v === 'number') return v === 1;
        if (typeof v === 'string') return VERDADEROS.has(v.trim().toLowerCase());
        return false;
    };

    const normalizar = (v) =>
        String(v ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('es')
            .trim();

    // Convierte cualquier id a texto comparable; '' si no es válido (evita "NaN").
    const llave = (v) => {
        if (v === null || v === undefined || v === '') return '';
        const n = Number(v);
        return Number.isFinite(n) ? String(n) : '';
    };

    /** Primer valor definido (no null/undefined/'') entre varias claves. */
    const primero = (obj, ...claves) => {
        for (const c of claves) {
            const v = obj?.[c];
            if (v !== undefined && v !== null && v !== '') return v;
        }
        return undefined;
    };

    const leerJSON = (clave, porDefecto) => {
        try {
            return JSON.parse(sessionStorage.getItem(clave) || 'null') ?? porDefecto;
        } catch {
            return porDefecto;
        }
    };

    const extraerLista = (r) => {
        if (Array.isArray(r)) return r;
        if (!r || typeof r !== 'object') return [];
        return [r.data, r.items, r.resultados, r.results, r.cargas, r.grupos].find(Array.isArray) ?? [];
    };

    const idFacultad = (f) => primero(f, 'facultades_id', 'facultad_id', 'id');
    const nombreFac = (f) => primero(f, 'nombre_facultades', 'nombre_facultad', 'nombre') ?? 'Sin facultad';
    const idPrograma = (p) => primero(p, 'programa_id', 'programas_academicos_id', 'id');
    const facultadDe = (p) => llave(primero(p, 'facultades_id', 'facultad_id', 'id_facultad'));
    const nombreProg = (p) => primero(p, 'nombre_programa', 'nombres_programa', 'nombre') ?? 'Sin programa';
    const idAsignatura = (a) => primero(a, 'asignatura_id', 'asignaturas_id', 'id');
    const idGrupo = (g) => primero(g, 'grupos_id', 'grupo_id', 'id_grupo', 'id');
    const idGrupoCarga = (c) => primero(c, 'id_grupo', 'grupos_id', 'grupo_id');
    const idUsuarioCarga = (c) => primero(c, 'user_id', 'usuario_id', 'docente_id');
    const idAsignaturaGrupo = (g) => primero(g, 'asignaturas_id', 'asignatura_id');

    const nuevo = (a = {}) => ({
        codigo_asignatura: a.codigo_asignatura ?? '',
        nombres_asignaturas: a.nombres_asignaturas ?? '',
        programa_id: String(a.programa_id ?? ''),
        creditos: a.creditos ?? CREDITOS_DEFECTO,
        estado: a.estado !== undefined ? aBooleano(a.estado) : true
    });

    /** Valida el formulario y devuelve { datos } o { error: { titulo, mensaje } }. */
    function validarFormulario(f) {
        const codigo = String(f.codigo_asignatura ?? '').trim();
        const nombre = String(f.nombres_asignaturas ?? '').trim();
        const creditos = Number(f.creditos);

        if (!codigo || !nombre || !f.programa_id) {
            return { error: { titulo: 'Campos requeridos', mensaje: 'Diligencia el código, nombre y programa académico.' } };
        }

        if (!Number.isInteger(creditos) || creditos < 1) {
            return { error: { titulo: 'Créditos inválidos', mensaje: 'Ingresa un número entero de créditos mayor que cero.' } };
        }

        return {
            datos: {
                codigo_asignatura: codigo,
                nombres_asignaturas: nombre,
                programa_id: Number(f.programa_id),
                creditos,
                estado: !!f.estado
            }
        };
    }

    // ---------- Estado ----------
    let sesion = $state({ id: null, rol: '' });
    let permiso = $state(null); // null = aún sin verificar

    let asignaturas = $state([]);
    let programas = $state([]);
    let facultades = $state([]);
    let grupos = $state([]);
    let cargasDocentes = $state([]);

    let cargando = $state(true);
    let guardando = $state(false);
    let error = $state(null);

    let filtroFacultad = $state('');
    let filtroPrograma = $state('');

    let mostrarModal = $state(false);
    let idEditando = $state(null);
    let form = $state(nuevo());

    let versionCarga = 0; // evita que una carga lenta pise a otra más reciente

    // ---------- Alertas ----------
    // Referencia al componente <Alerta /> (bind:this en el HTML)
    let avisos;

    const METODO_ALERTA = { success: 'exito', error: 'error', warning: 'advertencia', info: 'info' };

    // alerta('Título', 'Texto', 'warning' | 'error' | 'success' | 'info')
    const alerta = (titulo, mensaje, icono = 'warning') =>
        avisos[METODO_ALERTA[icono] ?? 'advertencia'](titulo, mensaje);

    const aviso = (titulo) => avisos.toastExito(titulo);

    // ---------- Derivados de sesión y permisos ----------
    const usuarioId = $derived(sesion.id);
    const esDocente = $derived(REGEX_DOCENTE.test(normalizar(sesion.rol)));

    // Los permisos de un docente ya vienen en false (salvo ver) desde verificarPermisos
    const puedeCrear = $derived(!!permiso?.puede_crear);
    const puedeEditar = $derived(!!permiso?.puede_editar);
    const puedeEliminar = $derived(!!permiso?.puede_eliminar);

    function permitir(permitido, accion) {
        if (esDocente) {
            alerta('Acción no permitida', 'Los docentes solo pueden consultar las asignaturas de su carga docente.');
            return false;
        }
        if (permitido) return true;

        alerta('Acceso denegado', `No tienes permisos para ${accion}.`);
        return false;
    }

    // ---------- Sesión y permisos ----------
    function verificarPermisos() {
        const guardado = leerJSON('usuario', {});
        const usuario = guardado && typeof guardado === 'object' ? guardado : {};

        const id = llave(
            sessionStorage.getItem('usuario_id') || primero(usuario, 'usuario_id', 'user_id', 'id')
        );
        const rol = String(
            sessionStorage.getItem('usuario_rol') || primero(usuario, 'nombre_rol', 'rol', 'role') || ''
        );

        sesion = { id: id ? Number(id) : null, rol };

        const docente = REGEX_DOCENTE.test(normalizar(rol));
        const modulos = leerJSON('usuario_modulos', []);

        const modulo = Array.isArray(modulos)
            ? modulos.find((m) => {
                  const nombre = normalizar(
                      typeof m === 'string' ? m : primero(m, 'nombre', 'nombre_modulo', 'descripcion')
                  );
                  return nombre.includes('asignatura') || nombre.includes('estructura academica');
              })
            : null;

        permiso = Object.fromEntries(
            CLAVES_PERMISO.map((k) => [
                k,
                // El docente nunca puede modificar, solo consultar.
                k === 'puede_ver' ? aBooleano(modulo?.[k]) : !docente && aBooleano(modulo?.[k])
            ])
        );
    }

    // ---------- Carga de datos ----------
    /**
     * Con `soloAsignaturas` solo se recargan las asignaturas (tras guardar):
     * programas, facultades, cargas y grupos no cambian con esa operación.
     * Devuelve true si todo salió bien.
     */
    async function cargarDatos({ soloAsignaturas = false } = {}) {
        if (!permiso?.puede_ver) {
            cargando = false;
            return false;
        }

        const version = ++versionCarga;
        cargando = true;
        error = null;

        const completa = !soloAsignaturas;
        const paraDocente = completa && esDocente; // cargas y grupos solo se piden al docente

        try {
            const [asig, progs, facs, cargas, grps] = await Promise.all([
                asignaturasApi.listar(),
                completa ? programasAcademicosApi.listar() : null,
                completa ? facultadesApi.listar() : null,
                paraDocente ? cargaDocenteApi.listar() : null,
                paraDocente ? gruposApi.listar() : null
            ]);

            if (version !== versionCarga) return true;

            asignaturas = extraerLista(asig);
            if (completa) {
                programas = extraerLista(progs);
                facultades = extraerLista(facs);
            }
            if (paraDocente) {
                cargasDocentes = extraerLista(cargas);
                grupos = extraerLista(grps);
            }

            if (filtroFacultad && !facultades.some((f) => llave(idFacultad(f)) === filtroFacultad)) {
                filtroFacultad = '';
            }
            if (filtroPrograma && !programas.some((p) => llave(idPrograma(p)) === filtroPrograma)) {
                filtroPrograma = '';
            }
            return true;
        } catch (e) {
            console.error('Error cargando estructura académica:', e);
            if (version === versionCarga) error = e?.message || 'Error de conexión con la API.';
            return false;
        } finally {
            if (version === versionCarga) cargando = false;
        }
    }

    onMount(() => {
        verificarPermisos();
        cargarDatos();
    });

    // ---------- Datos derivados ----------
    /*
     * Asignaturas de la carga del docente:
     * 1. Cargas activas del usuario de la sesión.
     * 2. Grupos activos de esas cargas.
     * 3. Asignaturas de esos grupos (o asignadas directamente en la carga).
     */
    const idsAsignaturasDocente = $derived.by(() => {
        const ids = new Set();
        if (!esDocente || usuarioId === null) return ids;

        const gruposPropios = new Set();

        for (const carga of cargasDocentes) {
            if (Number(idUsuarioCarga(carga)) !== usuarioId || !aBooleano(carga.estado)) continue;

            const grupoId = llave(idGrupoCarga(carga));
            if (grupoId) gruposPropios.add(grupoId);

            const directo = llave(primero(carga, 'asignaturas_id', 'asignatura_id'));
            if (directo) ids.add(directo);
        }

        for (const grupo of grupos) {
            if (!gruposPropios.has(llave(idGrupo(grupo))) || !aBooleano(grupo.estado)) continue;

            const asignaturaId = llave(idAsignaturaGrupo(grupo));
            if (asignaturaId) ids.add(asignaturaId);
        }

        return ids;
    });

    const asignaturasVisibles = $derived(
        esDocente
            ? asignaturas.filter((a) => idsAsignaturasDocente.has(llave(idAsignatura(a))))
            : asignaturas
    );

    const programasMap = $derived.by(() => {
        const facultadesMap = new Map(facultades.map((f) => [llave(idFacultad(f)), nombreFac(f)]));

        return new Map(
            programas.map((p) => {
                const facId = facultadDe(p);
                return [
                    llave(idPrograma(p)),
                    { nombre: nombreProg(p), facId, facultad: facultadesMap.get(facId) ?? 'Sin facultad' }
                ];
            })
        );
    });

    // Los filtros se limitan a lo que realmente aparece en las asignaturas visibles.
    const filtrosDisponibles = $derived.by(() => {
        const idsProgramas = new Set();
        const idsFacultades = new Set();

        for (const a of asignaturasVisibles) {
            const progId = llave(a.programa_id);
            idsProgramas.add(progId);

            const facId = programasMap.get(progId)?.facId;
            if (facId) idsFacultades.add(facId);
        }

        return {
            programas: programas.filter((p) => idsProgramas.has(llave(idPrograma(p)))),
            facultades: facultades.filter((f) => idsFacultades.has(llave(idFacultad(f))))
        };
    });

    const facultadesDisponibles = $derived(filtrosDisponibles.facultades);

    const programasFiltrados = $derived(
        filtroFacultad
            ? filtrosDisponibles.programas.filter((p) => facultadDe(p) === filtroFacultad)
            : filtrosDisponibles.programas
    );

    const asignaturasTabla = $derived.by(() => {
        const filas = [];

        for (const a of asignaturasVisibles) {
            const progId = llave(a.programa_id);
            const info = programasMap.get(progId);

            if (filtroFacultad && info?.facId !== filtroFacultad) continue;
            if (filtroPrograma && progId !== filtroPrograma) continue;

            filas.push({
                asignatura_id: idAsignatura(a),
                codigo_asignatura: a.codigo_asignatura,
                nombres_asignaturas: a.nombres_asignaturas,
                facultad: info?.facultad ?? 'Sin facultad',
                programa: info?.nombre ?? 'Sin programa',
                creditos: a.creditos,
                estado: aBooleano(a.estado),
                _raw: a
            });
        }

        return filas;
    });

    // ---------- Filtros ----------
    function cambiarFacultad() {
        if (!programasFiltrados.some((p) => llave(idPrograma(p)) === filtroPrograma)) {
            filtroPrograma = '';
        }
    }

    function limpiarFiltros() {
        filtroFacultad = '';
        filtroPrograma = '';
    }

    // ---------- CRUD ----------
    function limpiarModal() {
        mostrarModal = false;
        idEditando = null;
        form = nuevo();
    }

    function abrirModal(id, datos) {
        idEditando = id;
        form = nuevo(datos);
        mostrarModal = true;
    }

    function abrirModalCrear() {
        if (!permitir(puedeCrear, 'registrar asignaturas')) return;
        abrirModal(null, {});
    }

    function abrirModalEditar({ asignatura_id, _raw, estado }) {
        if (!permitir(puedeEditar, 'editar asignaturas')) return;
        abrirModal(asignatura_id, { ..._raw, estado });
    }

    async function guardarAsignatura() {
        if (guardando) return;

        const edicion = idEditando !== null;
        if (!permitir(edicion ? puedeEditar : puedeCrear, edicion ? 'modificar asignaturas' : 'crear asignaturas')) return;

        const { datos, error: fallo } = validarFormulario(form);
        if (fallo) return alerta(fallo.titulo, fallo.mensaje);

        guardando = true;

        try {
            await (edicion ? asignaturasApi.actualizar(idEditando, datos) : asignaturasApi.crear(datos));

            limpiarModal();

            const recargado = await cargarDatos({ soloAsignaturas: true });

            if (!recargado) {
                return alerta(
                    'Operación realizada',
                    'La asignatura se guardó, pero no se pudieron actualizar los datos de la tabla. Pulsa Actualizar para recargarlos.'
                );
            }

            aviso(edicion ? 'Asignatura actualizada correctamente' : 'Asignatura creada correctamente');
        } catch (e) {
            console.error('Error guardando asignatura:', e);
            alerta('Error al guardar', e?.message || 'No se pudo guardar la asignatura.', 'error');
        } finally {
            guardando = false;
        }
    }

    async function eliminarAsignatura({ asignatura_id: id, nombres_asignaturas }) {
        if (!permitir(puedeEliminar, 'eliminar asignaturas')) return;

        const confirmado = await avisos.confirmar(
            `¿Eliminar "${nombres_asignaturas}"?`,
            'Esta acción eliminará la asignatura de la base de datos.',
            { confirmar: 'Sí, eliminar', peligro: true }
        );
        if (!confirmado) return;

        try {
            await asignaturasApi.eliminar(id);
            asignaturas = asignaturas.filter((a) => llave(idAsignatura(a)) !== llave(id));
            aviso('Asignatura eliminada correctamente');
        } catch (e) {
            console.error('Error eliminando asignatura:', e);
            alerta('Error al eliminar', e?.message || 'No se pudo eliminar la asignatura.', 'error');
        }
    }
</script>

<svelte:head>
    <title>Estructura Académica | Acta Docente</title>
</svelte:head>

<Header />
<Navbar />

<main class="bg-light min-vh-100 p-4">
    <div class="container-fluid px-2 px-md-4">
        {#if !permiso}
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-5">
                    <div class="spinner-border" style:color={COLOR} role="status"></div>
                    <p class="text-muted mt-3 mb-0">Verificando permisos de acceso...</p>
                </div>
            </div>
        {:else if !permiso.puede_ver}
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-5">
                    <i class="bi bi-shield-lock-fill fs-1 text-danger" aria-hidden="true"></i>
                    <h3 class="fw-bold text-dark">Acceso no autorizado</h3>
                    <p class="text-muted mb-0">
                        Tu rol no tiene permisos para acceder al módulo de Estructura Académica.
                    </p>
                </div>
            </div>
        {:else}
            <PageHeader>
                {#snippet acciones()}
                    {#if puedeCrear}
                        <button type="button" class="btn btn-marca" onclick={abrirModalCrear}>
                            <i class="bi bi-plus-lg me-2" aria-hidden="true"></i>
                            Nueva Asignatura
                        </button>
                    {/if}

                    <button type="button" class="btn btn-contorno" onclick={() => cargarDatos()} disabled={cargando}>
                        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                        Actualizar
                    </button>
                {/snippet}
            </PageHeader>

            <div class="card border-0 shadow-sm mb-4">
                <div class="card-body p-3 p-md-4">
                    <div class="row g-3 align-items-end">
                        <div class="col-12 col-md-5">
                            <label for="filtroFacultad" class="form-label fw-semibold text-secondary">Facultad</label>
                            <select id="filtroFacultad" class="form-select" bind:value={filtroFacultad} onchange={cambiarFacultad}>
                                <option value="">Todas las facultades</option>
                                {#each facultadesDisponibles as f (idFacultad(f))}
                                    <option value={llave(idFacultad(f))}>{nombreFac(f)}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="col-12 col-md-5">
                            <label for="filtroPrograma" class="form-label fw-semibold text-secondary">Programa académico</label>
                            <select id="filtroPrograma" class="form-select" bind:value={filtroPrograma}>
                                <option value="">Todos los programas</option>
                                {#each programasFiltrados as p (idPrograma(p))}
                                    <option value={llave(idPrograma(p))}>{nombreProg(p)}</option>
                                {/each}
                            </select>
                        </div>

                        <div class="col-12 col-md-2">
                            <button
                                type="button"
                                class="btn btn-outline-secondary w-100"
                                onclick={limpiarFiltros}
                                disabled={!filtroFacultad && !filtroPrograma}
                            >
                                <i class="bi bi-arrow-counterclockwise me-1" aria-hidden="true"></i>
                                Limpiar
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {#if error}
                <div class="alert alert-danger" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2" aria-hidden="true"></i>
                    <strong>Error al obtener los datos:</strong>
                    {error}

                    <button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick={() => cargarDatos()} disabled={cargando}>
                        Reintentar
                    </button>
                </div>
            {:else if esDocente && usuarioId === null}
                <div class="alert alert-warning" role="alert">
                    No se pudo identificar al docente de la sesión. Cierra sesión e inicia sesión
                    nuevamente para cargar tus asignaturas.
                </div>
            {:else if esDocente && !cargando && idsAsignaturasDocente.size === 0}
                <div class="card border-0 shadow-sm">
                    <div class="card-body text-center py-5">
                        <i class="bi bi-journal-x fs-1 text-secondary" aria-hidden="true"></i>
                        <h4 class="fw-bold mt-3">No tienes asignaturas en tu carga docente</h4>
                        <p class="text-muted mb-0">
                            Cuando te asignen grupos en la carga docente, las asignaturas
                            correspondientes aparecerán aquí.
                        </p>
                    </div>
                </div>
            {:else}
                <!-- La tabla se mantiene montada durante las recargas: conserva orden y página -->
                <DataTable
                    title={esDocente ? 'Mis asignaturas' : 'Asignaturas registradas'}
                    rows={asignaturasTabla}
                    columns={COLUMNAS}
                    loading={cargando}
                    emptyMessage="No se encontraron asignaturas para los filtros seleccionados."
                    pageSize={10}
                    onEdit={puedeEditar ? abrirModalEditar : undefined}
                    onDelete={puedeEliminar ? eliminarAsignatura : undefined}
                />
            {/if}
        {/if}
    </div>
</main>

{#if !esDocente}
    <ModalFormulario
        bind:abierto={mostrarModal}
        titulo={idEditando !== null ? 'Editar Asignatura' : 'Nueva Asignatura'}
        subtitulo="Completa la información de la asignatura"
        textoGuardar={idEditando !== null ? 'Guardar cambios' : 'Crear asignatura'}
        cargando={guardando}
        onGuardar={guardarAsignatura}
        onCerrar={limpiarModal}
    >
        <div class="mb-3">
            <label for="fCodigo" class="form-label fw-semibold text-secondary">Código de asignatura</label>
            <input id="fCodigo" class="form-control" placeholder="Ej.: ASIG-000" bind:value={form.codigo_asignatura} required disabled={guardando} />
        </div>

        <div class="mb-3">
            <label for="fNombre" class="form-label fw-semibold text-secondary">Nombre de la asignatura</label>
            <input id="fNombre" class="form-control" placeholder="Ej.: Cálculo I" bind:value={form.nombres_asignaturas} required disabled={guardando} />
        </div>

        <div class="mb-3">
            <label for="fPrograma" class="form-label fw-semibold text-secondary">Programa académico</label>
            <select id="fPrograma" class="form-select" bind:value={form.programa_id} required disabled={guardando}>
                <option value="">Selecciona un programa...</option>
                {#each programas as p (idPrograma(p))}
                    <option value={llave(idPrograma(p))}>{nombreProg(p)}</option>
                {/each}
            </select>
        </div>

        <div class="row g-3">
            <div class="col-md-6">
                <label for="fCreditos" class="form-label fw-semibold text-secondary">Créditos</label>
                <input id="fCreditos" type="number" min="1" step="1" class="form-control" bind:value={form.creditos} required disabled={guardando} />
            </div>

            <div class="col-md-6">
                <label for="fEstado" class="form-label fw-semibold text-secondary">Estado</label>
                <select id="fEstado" class="form-select" bind:value={form.estado} disabled={guardando}>
                    <option value={true}>Activa</option>
                    <option value={false}>Inactiva</option>
                </select>
            </div>
        </div>
    </ModalFormulario>
{/if}

<Alerta bind:this={avisos} />

<Footer />
<BtnSugerencias />