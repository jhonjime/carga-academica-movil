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

    import { gruposApi, asignaturasApi, cargaDocenteApi } from '$lib/api/CargaDocenteApi.js';

    const COLOR = '#0f3460';
    const ROL_DOCENTE_ID = 1;
    const CAPACIDAD_DEFECTO = 30;
    const MAX_NOMBRE = 50;

    const COLUMNAS = [
        { key: 'asignatura', label: 'ASIGNATURA', sortable: true },
        { key: 'nombre_grupos', label: 'GRUPO', sortable: true },
        { key: 'capacidad', label: 'CUPO MÁXIMO', sortable: true },
        { key: 'estado', label: 'ESTADO', type: 'status', sortable: true }
    ];

    // Claves alternativas con las que la API puede nombrar cada permiso
    const CLAVES_PERMISO = {
        puede_ver: ['puede_ver', 'ver', 'can_view'],
        puede_crear: ['puede_crear', 'crear', 'can_create'],
        puede_editar: ['puede_editar', 'editar', 'can_edit'],
        puede_eliminar: ['puede_eliminar', 'eliminar', 'can_delete']
    };

    const VERDADEROS = new Set(['true', '1', 'activo', 'activa', 'abierto', 'abierta', 'si', 'sí']);

    // --------------------------------------------------
    // FUNCIONES AUXILIARES (puras; candidatas a $lib/utils)
    // --------------------------------------------------

    /** Devuelve el primer valor definido (no null/undefined/'') entre varias claves. */
    const primero = (obj, ...claves) => {
        for (const clave of claves) {
            const valor = obj?.[clave];
            if (valor !== undefined && valor !== null && valor !== '') return valor;
        }
        return undefined;
    };

    const normalizar = (valor) =>
        String(valor ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLocaleLowerCase('es')
            .trim();

    const aBooleano = (valor) => {
        if (typeof valor === 'boolean') return valor;
        if (typeof valor === 'number') return valor === 1;
        return VERDADEROS.has(String(valor ?? '').trim().toLowerCase());
    };

    const numeroValido = (valor) => {
        if (valor === null || valor === undefined || valor === '') return null;
        const numero = Number(valor);
        return Number.isFinite(numero) ? numero : null;
    };

    const leerJson = (clave, porDefecto) => {
        try {
            return JSON.parse(sessionStorage.getItem(clave) || 'null') ?? porDefecto;
        } catch (e) {
            console.error(`Error leyendo "${clave}" de la sesión:`, e);
            return porDefecto;
        }
    };

    const idGrupo = (g) => primero(g, 'grupos_id', 'id_grupo', 'grupo_id', 'id');
    const idAsignatura = (a) => primero(a, 'asignaturas_id', 'asignatura_id', 'id_asignatura', 'id');
    const asignaturaDeGrupo = (g) => primero(g, 'asignaturas_id', 'asignatura_id', 'id_asignatura');
    const docenteDeCarga = (c) => primero(c, 'user_id', 'usuario_id', 'id_usuario', 'docente_id', 'id_docente');
    const grupoDeCarga = (c) => primero(c, 'id_grupo', 'grupos_id', 'grupo_id');
    const nombreDeGrupo = (g) => primero(g, 'nombre_grupos', 'nombre_grupo', 'nombre') ?? '';

    const extraerLista = (r) => {
        if (Array.isArray(r)) return r;
        return [r?.data, r?.items, r?.resultados].find(Array.isArray) ?? [];
    };

    const resetForm = (grupo = {}) => ({
        asignaturas_id: String(asignaturaDeGrupo(grupo) ?? ''),
        nombre_grupos: nombreDeGrupo(grupo),
        capacidad: grupo?.capacidad ?? CAPACIDAD_DEFECTO,
        estado: grupo?.estado !== undefined ? aBooleano(grupo.estado) : true
    });

    /** Valida el formulario y devuelve { datos } o { error }. */
    function validarFormulario(f) {
        const asignaturaId = Number(f.asignaturas_id);
        const capacidad = Number(f.capacidad);
        const nombre = String(f.nombre_grupos ?? '').trim();

        if (!Number.isInteger(asignaturaId) || asignaturaId <= 0) return { error: 'Selecciona una asignatura.' };
        if (!nombre) return { error: 'Ingresa el nombre del grupo.' };
        if (nombre.length > MAX_NOMBRE) return { error: `El nombre del grupo no puede superar los ${MAX_NOMBRE} caracteres.` };
        if (!Number.isInteger(capacidad) || capacidad <= 0) return { error: 'El cupo debe ser un número entero mayor que cero.' };

        return {
            datos: {
                asignaturas_id: asignaturaId,
                nombre_grupos: nombre,
                capacidad,
                estado: aBooleano(f.estado)
            }
        };
    }

    // --------------------------------------------------
    // ALERTAS
    // --------------------------------------------------

    // Referencia al componente <Alerta /> (bind:this en el HTML)
    let avisos;

    const METODO_ALERTA = { success: 'exito', error: 'error', warning: 'advertencia', info: 'info' };

    // alerta('Título', 'Texto', 'warning' | 'error' | 'success' | 'info')
    const alerta = (titulo, mensaje, icono = 'warning') =>
        avisos[METODO_ALERTA[icono] ?? 'advertencia'](titulo, mensaje);

    const aviso = (titulo) => avisos.toastExito(titulo);

    // --------------------------------------------------
    // ESTADO
    // --------------------------------------------------

    let sesion = $state({ id: null, rol: '', rolId: null });
    let permiso = $state(null); // null = aún sin verificar

    let asignaturas = $state([]);
    let grupos = $state([]);
    let cargas = $state([]);

    let cargando = $state(true);
    let guardando = $state(false);
    let error = $state('');

    let idEditando = $state(null);
    let mostrarModal = $state(false);
    let form = $state(resetForm());

    // --------------------------------------------------
    // SESIÓN Y PERMISOS
    // --------------------------------------------------

    function verificarPermisos() {
        const usuario = leerJson('usuario', {});
        const modulos = leerJson('usuario_modulos', []);

        sesion = {
            id: numeroValido(
                sessionStorage.getItem('usuario_id') ||
                    primero(usuario, 'usuario_id', 'user_id', 'id_usuario', 'id')
            ),
            rol: String(
                sessionStorage.getItem('usuario_rol') ||
                    primero(usuario, 'nombre_rol', 'rol_nombre') ||
                    usuario?.rol?.nombre_rol ||
                    (typeof usuario?.rol === 'string' ? usuario.rol : '')
            ).trim(),
            rolId: numeroValido(
                sessionStorage.getItem('usuario_role_id') ||
                    sessionStorage.getItem('rol_id') ||
                    primero(usuario, 'rol_id', 'role_id') ||
                    usuario?.rol?.rol_id
            )
        };

        const modulo = (Array.isArray(modulos) ? modulos : []).find((m) => {
            const nombre = normalizar(
                typeof m === 'string' ? m : primero(m, 'nombre_modulo', 'nombre_modulos', 'nombre', 'descripcion')
            );
            return nombre.includes('grupo') || nombre.includes('horario');
        });

        const datos = modulo && typeof modulo === 'object' ? modulo : {};

        // Se eliminó la regla de 'esDireccion' para que los permisos dependan 
        // 100% de lo que tenga asignado el módulo en la base de datos / sesión.
        permiso = Object.fromEntries(
            Object.entries(CLAVES_PERMISO).map(([clave, alias]) => [
                clave,
                aBooleano(primero(datos, ...alias))
            ])
        );
    }

    // --------------------------------------------------
    // DATOS DERIVADOS
    // --------------------------------------------------

    const usuarioId = $derived(sesion.id);
    const esDocente = $derived(normalizar(sesion.rol).includes('docente') || sesion.rolId === ROL_DOCENTE_ID);

    // Un docente nunca gestiona grupos, sin importar los permisos del módulo
    const puedeCrear = $derived(!esDocente && !!permiso?.puede_crear);
    const puedeEditar = $derived(!esDocente && !!permiso?.puede_editar);
    const puedeEliminar = $derived(!esDocente && !!permiso?.puede_eliminar);

    const mapaAsignaturas = $derived(
        new Map(
            asignaturas.map((a) => {
                const nombre = primero(a, 'nombre_asignatura', 'nombres_asignaturas', 'nombre') ?? 'Sin nombre';
                const texto = a.codigo_asignatura ? `${a.codigo_asignatura} — ${nombre}` : nombre;
                return [Number(idAsignatura(a)), texto];
            })
        )
    );

    const opcionesAsignaturas = $derived([...mapaAsignaturas]);

    const idsGruposDelDocente = $derived.by(() => {
        const ids = new Set();
        if (usuarioId === null) return ids;

        for (const carga of cargas) {
            if (Number(docenteDeCarga(carga)) !== usuarioId) continue;
            const g = Number(grupoDeCarga(carga));
            if (Number.isFinite(g)) ids.add(g);
        }
        return ids;
    });

    const gruposTabla = $derived.by(() => {
        if (esDocente && usuarioId === null) return [];

        const visibles = esDocente
            ? grupos.filter((g) => idsGruposDelDocente.has(Number(idGrupo(g))))
            : grupos;

        return visibles.map((grupo) => ({
            grupos_id: idGrupo(grupo),
            asignatura:
                grupo.nombre_asignatura ??
                mapaAsignaturas.get(Number(asignaturaDeGrupo(grupo))) ??
                `Asignatura #${asignaturaDeGrupo(grupo) ?? ''}`,
            nombre_grupos: nombreDeGrupo(grupo),
            capacidad: Number(grupo.capacidad ?? CAPACIDAD_DEFECTO),
            estado: aBooleano(grupo.estado),
            _raw: grupo
        }));
    });

    // --------------------------------------------------
    // CARGAR DATOS
    // --------------------------------------------------

    let ultimaCarga = 0; // evita que una respuesta lenta pise a una más reciente

    /**
     * Carga los datos. Con `soloGrupos` solo recarga los grupos (tras guardar),
     * y las cargas docentes solo se piden cuando el usuario es docente.
     * Devuelve true si todo salió bien.
     */
    async function cargarDatos({ soloGrupos = false } = {}) {
        if (!permiso?.puede_ver) {
            cargando = false;
            return false;
        }

        const solicitud = ++ultimaCarga;
        cargando = true;
        error = '';

        try {
            const [resAsignaturas, resGrupos, resCargas] = await Promise.all([
                soloGrupos ? null : asignaturasApi.listar(),
                gruposApi.listar(),
                soloGrupos || !esDocente ? null : cargaDocenteApi.listar()
            ]);

            if (solicitud !== ultimaCarga) return true;

            if (resAsignaturas) asignaturas = extraerLista(resAsignaturas);
            if (resCargas) cargas = extraerLista(resCargas);
            grupos = extraerLista(resGrupos);
            return true;
        } catch (e) {
            console.error('Error cargando los datos:', e);
            if (solicitud === ultimaCarga) {
                error = e?.message || 'No se pudieron cargar los datos desde la API.';
            }
            return false;
        } finally {
            if (solicitud === ultimaCarga) cargando = false;
        }
    }

    onMount(() => {
        verificarPermisos();
        cargarDatos();
    });

    // --------------------------------------------------
    // CREAR Y EDITAR
    // --------------------------------------------------

    function permitir(permitido, accion) {
        if (permitido) return true;
        alerta('Acceso denegado', `No tienes permisos para ${accion}.`, 'warning');
        return false;
    }

    function limpiarModal() {
        mostrarModal = false;
        idEditando = null;
        form = resetForm();
    }

    function cerrarModal() {
        if (!guardando) limpiarModal();
    }

    function abrirModalCrear() {
        if (!permitir(puedeCrear, 'registrar grupos')) return;

        idEditando = null;
        form = resetForm();
        mostrarModal = true;
    }

    function abrirModalEditar(fila) {
        if (!permitir(puedeEditar, 'editar grupos')) return;

        const grupo = fila?._raw ?? fila;
        idEditando = idGrupo(grupo);
        form = resetForm(grupo);
        mostrarModal = true;
    }

    async function guardarGrupo() {
        if (guardando) return;

        const edicion = idEditando !== null;
        if (!permitir(edicion ? puedeEditar : puedeCrear, edicion ? 'editar grupos' : 'registrar grupos')) return;

        const { datos, error: mensaje } = validarFormulario(form);
        if (mensaje) {
            await alerta('Revisa los datos', mensaje);
            return;
        }

        guardando = true;

        try {
            await (edicion ? gruposApi.actualizar(idEditando, datos) : gruposApi.crear(datos));

            limpiarModal();

            // Solo se recargan los grupos; asignaturas y cargas no cambian al guardar
            const recargado = await cargarDatos({ soloGrupos: true });

            if (!recargado) {
                await alerta(
                    'Operación enviada',
                    'La API respondió, pero no se pudieron actualizar los datos de la tabla. Pulsa Actualizar para comprobar el registro.',
                    'warning'
                );
                return;
            }

            aviso(edicion ? 'Grupo actualizado correctamente' : 'Grupo creado correctamente');
        } catch (e) {
            console.error('Error guardando grupo:', e);
            await alerta(
                'No se pudo guardar',
                e?.message || 'La API no pudo guardar el grupo. Revisa la consola y los registros del servidor.',
                'error'
            );
        } finally {
            guardando = false;
        }
    }

    // --------------------------------------------------
    // ELIMINAR
    // --------------------------------------------------

    async function eliminarGrupo(fila) {
        if (!permitir(puedeEliminar, 'eliminar grupos')) return;

        const id = fila?.grupos_id;
        const nombre = fila?.nombre_grupos ?? 'Grupo';

        if (id === null || id === undefined) {
            await alerta('Error', 'No se encontró el identificador del grupo.');
            return;
        }

        const confirmado = await avisos.confirmar(
            '¿Eliminar grupo?',
            `Se eliminará el grupo "${nombre}". Esta acción no se puede deshacer.`,
            { confirmar: 'Sí, eliminar', peligro: true }
        );
        if (!confirmado) return;

        try {
            await gruposApi.eliminar(id);
            grupos = grupos.filter((g) => Number(idGrupo(g)) !== Number(id));
            aviso('Grupo eliminado correctamente');
        } catch (e) {
            console.error('Error eliminando grupo:', e);
            await alerta(
                'Error al eliminar',
                e?.message || 'No se pudo eliminar el grupo. Puede estar relacionado con una carga docente.',
                'error'
            );
        }
    }
</script>

<svelte:head>
    <title>Grupos | Acta Docente</title>
</svelte:head>

<Header />
<Navbar />

<main class="bg-light min-vh-100 p-4">
    <div class="container-fluid px-2 px-md-4">
        {#if !permiso}
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-5">
                    <div class="spinner-border" style:color={COLOR} role="status"></div>
                    <p class="text-muted mt-3 mb-0">Verificando permisos...</p>
                </div>
            </div>

        {:else if !permiso.puede_ver}
            <div class="card border-0 shadow-sm">
                <div class="card-body text-center py-5">
                    <i class="bi bi-shield-lock fs-1 text-danger" aria-hidden="true"></i>
                    <h3 class="fw-bold mt-3">Acceso no autorizado</h3>
                    <p class="text-muted mb-0">Tu rol no tiene permisos para acceder a Grupos y Horarios.</p>
                </div>
            </div>

        {:else}
            {#if esDocente && usuarioId === null}
                <div class="alert alert-danger mb-4" role="alert">
                    <i class="bi bi-exclamation-octagon-fill me-2" aria-hidden="true"></i>
                    No se pudo identificar tu usuario en la sesión. Cierra sesión y vuelve a ingresar.
                </div>
            {/if}

            <PageHeader>
                {#snippet acciones()}
                    {#if puedeCrear}
                        <button type="button" class="btn btn-marca text-nowrap" onclick={abrirModalCrear} disabled={guardando}>
                            <i class="bi bi-plus-lg me-2" aria-hidden="true"></i>
                            Nuevo Grupo
                        </button>
                    {/if}

                    <button type="button" class="btn btn-contorno" onclick={() => cargarDatos()} disabled={cargando}>
                        <i class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>
                        Actualizar
                    </button>
                {/snippet}
            </PageHeader>

            {#if error}
                <div class="alert alert-danger d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2" role="alert">
                    <span>
                        <i class="bi bi-exclamation-triangle-fill me-2" aria-hidden="true"></i>
                        {error}
                    </span>

                    <button type="button" class="btn btn-sm btn-outline-danger" onclick={() => cargarDatos()} disabled={cargando}>
                        Reintentar
                    </button>
                </div>
            {/if}

            <DataTable
                title={esDocente ? 'Mis grupos asignados' : 'Grupos registrados'}
                rows={gruposTabla}
                columns={COLUMNAS}
                loading={cargando}
                emptyMessage={esDocente
                    ? 'No tienes grupos asignados en tus cargas docentes.'
                    : 'No se encontraron grupos registrados.'}
                pageSize={10}
                onEdit={puedeEditar ? abrirModalEditar : undefined}
                onDelete={puedeEliminar ? eliminarGrupo : undefined}
            />
        {/if}
    </div>
</main>

<ModalFormulario
    bind:abierto={mostrarModal}
    titulo={idEditando !== null ? 'Editar Grupo' : 'Nuevo Grupo'}
    subtitulo="Completa la información del grupo"
    textoGuardar={idEditando !== null ? 'Guardar cambios' : 'Crear grupo'}
    cargando={guardando}
    onGuardar={guardarGrupo}
    onCerrar={cerrarModal}
>
    <div class="row g-3">
        <div class="col-md-12">
            <label for="asignaturaModal" class="form-label fw-semibold">Asignatura</label>
            <select id="asignaturaModal" class="form-select" bind:value={form.asignaturas_id} required disabled={guardando}>
                <option value="">Selecciona una asignatura...</option>
                {#each opcionesAsignaturas as [id, texto] (id)}
                    <option value={String(id)}>{texto}</option>
                {/each}
            </select>
        </div>

        <div class="col-md-6">
            <label for="nombreGrupoModal" class="form-label fw-semibold">Nombre del grupo</label>
            <input
                id="nombreGrupoModal"
                class="form-control"
                placeholder="Ej.: Grupo A"
                maxlength={MAX_NOMBRE}
                bind:value={form.nombre_grupos}
                required
                disabled={guardando}
            />
        </div>

        <div class="col-md-6">
            <label for="capacidadModal" class="form-label fw-semibold">Cupo máximo</label>
            <input
                id="capacidadModal"
                type="number"
                class="form-control"
                min="1"
                step="1"
                bind:value={form.capacidad}
                required
                disabled={guardando}
            />
        </div>

        <div class="col-md-12">
            <label for="estadoModal" class="form-label fw-semibold">Estado</label>
            <select
                id="estadoModal"
                class="form-select"
                value={String(form.estado)}
                onchange={(e) => (form.estado = e.currentTarget.value === 'true')}
                disabled={guardando}
            >
                <option value="true">Abierto</option>
                <option value="false">Cerrado</option>
            </select>
        </div>
    </div>
</ModalFormulario>

<Alerta bind:this={avisos} />

<Footer />
<BtnSugerencias />