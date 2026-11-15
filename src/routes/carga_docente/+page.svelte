<script>
    import { onMount } from 'svelte';
    import Alerta from '$lib/components/Alerta.svelte';
    import BtnSugerencias from '$lib/components/btnSugerencias.svelte';
    import Header from '$lib/components/Header.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import PageHeader from '$lib/components/PageHeader.svelte';
    import DataTable from '$lib/components/DataTable.svelte';
    import ModalFormulario from '$lib/components/ModalFormulario.svelte';
    import Confirmacion from '$lib/components/Confirmacion.svelte';
    import { usuariosApi, asignaturasApi, gruposApi, periodosAcademicosApi, horariosApi, cargaDocenteApi } from '$lib/api/CargaDocenteApi.js';

    const COLOR = '#0f3460', ROL_DOCENTE_ID = 1;
    const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    const COLUMNAS = ['docente', 'periodo', 'grupo', 'asignatura', 'horario'].map(k => ({ key: k, label: k.toUpperCase(), sortable: true })).concat({ key: 'estado', label: 'ESTADO', type: 'status' });
    const nuevoForm = () => ({ carga_id: null, horario_id: null, user_id: '', periodo_id: '', id_grupo: '', dia_laborales: '1', hora_inicio: '', hora_finalizar: '', estado: true });

    let [docentes, grupos, asignaturas, periodos, horarios, cargas] = $state([[], [], [], [], [], []]);
    let cargando = $state(true), guardando = $state(false), accesoVerificado =$state(false), modalAbierto = $state(false), editando =$state(false);
    let form = $state(nuevoForm()), confirmacion = $state(null), permiso =$state({}), avisos;
    let usuarioActualId = $state(null), usuarioActualRol =$state(''), usuarioActualRolId = $state(null), esUsuarioDocente =$state(false);

    const alerta = (title, text, icon = 'warning') => ({ success: avisos.exito, error: avisos.error, warning: avisos.advertencia, info: avisos.info }[icon] ?? avisos.advertencia)(title, text);
    const normalizar = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    const pick = (o, ...keys) => keys.map(k => o?.[k]).find(v => v != null);
    const ids = (...keys) => o => pick(o, ...keys);
    const buscar = (arr, idFn, id) => arr.find(x => Number(idFn(x)) === Number(id));
    const hm = h => String(h ?? '').slice(0, 5);

    const idCarga = ids('carga_id', 'id_carga', 'id');
    const idUsuario = ids('usuario_id', 'user_id', 'id_usuario', 'id');
    const idGrupo = ids('grupos_id', 'id_grupo', 'grupo_id', 'id');
    const idPeriodo = ids('periodo_id', 'id_periodo', 'periodos_academicos_id', 'id');
    const idAsignatura = ids('asignatura_id', 'asignaturas_id', 'id_asignatura', 'id');
    const idHorario = ids('horario_id', 'id_horario', 'id');
    const periodoDe = ids('periodo_id', 'id_periodo', 'periodos_academicos_id');
    const grupoDe = ids('id_grupo', 'grupos_id', 'grupo_id');
    const docenteDe = ids('user_id', 'usuario_id', 'id_usuario', 'docente_id');

    const nombreDocente = u => u?.nombre_completo || u?.nombre || [u?.primer_nombre, u?.segundo_nombre, u?.primer_apellido, u?.segundo_apellido].filter(Boolean).join(' ') || u?.correo || 'Docente sin nombre';
    const nombreGrupo = g => pick(g, 'nombre_grupos', 'nombre_grupo', 'nombre', 'grupo', 'codigo_grupo', 'codigo') ?? `Grupo ${idGrupo(g) ?? ''}`;
    const nombreAsignatura = a => pick(a, 'nombre_asignatura', 'nombres_asignaturas', 'nombre_asignaturas', 'nombre') ?? 'Asignatura sin nombre';
    const nombrePeriodo = p => pick(p, 'codigo_periodo', 'nombre_periodo', 'periodo', 'nombre', 'descripcion', 'codigo') ?? `Período ${idPeriodo(p) ?? ''}`;
    const asignaturaDe = g => buscar(asignaturas, idAsignatura, pick(g, 'asignaturas_id', 'asignatura_id', 'id_asignatura'));
    const estadoActivo = v => v == null || (typeof v === 'boolean' ? v : !['false', '0', 'inactivo', 'inactiva', 'eliminado', 'eliminada'].includes(String(v).trim().toLowerCase()));
    const lista = (data, ...keys) => Array.isArray(data) ? data : [...keys, 'data', 'items', 'results'].map(k => data?.[k]).find(Array.isArray) ?? [];

    function obtenerSesion() {
        try {
            const u = JSON.parse(sessionStorage.getItem('usuario') || '{}');
            const rolG = sessionStorage.getItem('usuario_rol') ?? u.nombre_rol ?? u.rol_nombre ?? u.rol ?? '';
            const rolObj = typeof rolG === 'object' && rolG !== null ? rolG : {};
            usuarioActualId = Number(pick(sessionStorage, 'usuario_id') ?? pick(u, 'usuario_id', 'user_id', 'id_usuario', 'id')) || null;
            usuarioActualRol = normalizar(typeof rolG === 'object' && rolG !== null ? (rolG.nombre_rol ?? rolG.nombre ?? '') : rolG);
            usuarioActualRolId = Number(pick(sessionStorage, 'usuario_role_id', 'rol_id') ?? pick(u, 'rol_id', 'role_id', 'id_rol') ?? pick(rolObj, 'rol_id', 'id_rol', 'id')) || null;
            esUsuarioDocente = usuarioActualRol === 'docente' || usuarioActualRolId === ROL_DOCENTE_ID;
        } catch (e) {
            usuarioActualId = null; usuarioActualRol = ''; usuarioActualRolId = null; esUsuarioDocente = false;
        }
    }

    function verificarPermisos() {
        let modulo = null;
        try {
            const modulos = JSON.parse(sessionStorage.getItem('usuario_modulos') || '[]');
            modulo = modulos.find(m => ['carga docente', 'cargas docentes'].includes(normalizar(m.nombre ?? m.nombre_modulo)));
        } catch (e) {}
        permiso = Object.fromEntries(['puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar'].map(k => [k, [true, 1, 'true'].includes(modulo?.[k])]));
        accesoVerificado = true;
    }

    function permitir(k, accion) {
        if (esUsuarioDocente && ['puede_crear', 'puede_editar', 'puede_eliminar'].includes(k)) {
            alerta('Acción no disponible', 'El rol Docente solo puede consultar sus propias cargas.');
            return false;
        }
        if (permiso[k]) return true;
        alerta('Acceso denegado', `No tienes permiso para ${accion}.`);
        return false;
    }

    async function cargarTodo() {
        if (!permiso.puede_ver) { cargando = false; return; }
        cargando = true;
        try {
            const r = await Promise.all([usuariosApi.listar(), asignaturasApi.listar(), gruposApi.listar(), periodosAcademicosApi.listar(), horariosApi.listar(), cargaDocenteApi.listar()]);
            [docentes, asignaturas, grupos, periodos, horarios, cargas] = [lista(r[0], 'usuarios'), lista(r[1], 'asignaturas'), lista(r[2], 'grupos'), lista(r[3], 'periodos_academicos', 'periodos'), lista(r[4], 'horarios'), lista(r[5], 'carga_docente', 'cargas')];
        } catch (e) {
            await alerta('Error al cargar', e.message || 'No se pudieron cargar los datos.', 'error');
        } finally { cargando = false; }
    }

    onMount(() => { obtenerSesion(); verificarPermisos(); cargarTodo(); });

    function detalle(c) {
        const cargaId = idCarga(c);
        const h = horarios.find(horario => Number(horario.carga_id ?? horario.carga_docente_id) === Number(cargaId));
        const d = buscar(docentes, idUsuario, docenteDe(c));
        const g = buscar(grupos, idGrupo, grupoDe(c));
        const a = g ? asignaturaDe(g) : null;
        const p = buscar(periodos, idPeriodo, periodoDe(c));
        const dia = DIAS[Number(h?.dia_laborales) - 1] ?? `Día ${h?.dia_laborales ?? ''}`;
        return {
            carga_id: cargaId,
            docente: d ? nombreDocente(d) : c.nombre_docente ?? 'Docente no disponible',
            periodo: p ? nombrePeriodo(p) : c.nombre_periodo ?? c.codigo_periodo ?? 'Sin período',
            grupo: g ? nombreGrupo(g) : c.nombre_grupo ?? 'Sin grupo',
            asignatura: a ? nombreAsignatura(a) : c.nombre_asignatura ?? 'Sin asignatura',
            horario: h ? `${dia} · ${hm(h.hora_inicio) || '--:--'}\n${hm(h.hora_finalizar) || '--:--'}` : 'Sin horario',
            estado: estadoActivo(c.estado),
            _raw: c, _horario: h
        };
    }

    const filas = $derived(cargas.filter(c => !esUsuarioDocente ? true : (usuarioActualId !== null && Number(docenteDe(c)) === usuarioActualId)).map(detalle));

    const selects = $derived([
        ['user_id', 'Docente', 'un docente', 'col-md-6', docentes.filter(u => {
            const rol = u?.rol, nombre = u?.nombre_rol ?? u?.rol_nombre ?? (typeof rol === 'string' ? rol : rol?.nombre_rol ?? rol?.nombre);
            const rolId = pick(u, 'rol_id', 'role_id', 'id_rol') ?? pick(rol, 'rol_id', 'id_rol', 'id');
            return normalizar(nombre) === 'docente' || String(rolId) === String(ROL_DOCENTE_ID);
        }).map(d => [idUsuario(d), nombreDocente(d)])],
        ['periodo_id', 'Período académico', 'un período', 'col-md-6', periodos.map(p => [idPeriodo(p), nombrePeriodo(p)])],
        ['id_grupo', 'Grupo', 'un grupo', '', grupos.map(g => { const a = asignaturaDe(g); return [idGrupo(g), nombreGrupo(g) + (a ? ` — ${nombreAsignatura(a)}` : '')]; })]
    ]);

    function abrirCrear() {
        if (!esUsuarioDocente && permitir('puede_crear', 'registrar cargas docentes')) { form = nuevoForm(); editando = false; modalAbierto = true; }
        else if (esUsuarioDocente) alerta('Acción no disponible', 'El rol Docente no puede registrar cargas docentes.');
    }

    function abrirEditar(fila) {
        if (esUsuarioDocente) return alerta('Acción no disponible', 'El rol Docente no puede editar cargas docentes.');
        if (!permitir('puede_editar', 'editar cargas docentes')) return;
        const { _raw: c, _horario: h } = fila;
        form = { carga_id: idCarga(c), horario_id: h ? idHorario(h) : null, user_id: String(docenteDe(c) ?? ''), periodo_id: String(periodoDe(c) ?? ''), id_grupo: String(grupoDe(c) ?? ''), dia_laborales: String(h?.dia_laborales ?? '1'), hora_inicio: hm(h?.hora_inicio), hora_finalizar: hm(h?.hora_finalizar), estado: estadoActivo(c.estado) };
        editando = true; modalAbierto = true;
    }

    async function guardar() {
        if (esUsuarioDocente) return alerta('Acceso denegado', 'El rol Docente no puede modificar cargas.');
        if (!permitir(editando ? 'puede_editar' : 'puede_crear', 'realizar esta operación')) return;
        const { user_id, periodo_id, id_grupo, hora_inicio, hora_finalizar } = form;
        if (!user_id || !periodo_id || !id_grupo || !hora_inicio || !hora_finalizar) return alerta('Campos requeridos', 'Completa docente, período, grupo y horario.');
        if (hora_finalizar <= hora_inicio) return alerta('Horario inválido', 'La hora final debe ser posterior a la hora inicial.');
        guardando = true;
        try {
            const datos = { user_id: Number(user_id), periodo_id: Number(periodo_id), id_grupo: Number(id_grupo), estado: !!form.estado };
            const res = editando ? await cargaDocenteApi.actualizar(form.carga_id, datos) : await cargaDocenteApi.crear(datos);
            const cargaId = form.carga_id ?? idCarga(res) ?? idCarga(res?.data);
            if (cargaId == null) throw new Error('No se obtuvo el identificador de la carga creada.');
            const horario = { carga_id: Number(cargaId), dia_laborales: Number(form.dia_laborales), hora_inicio, hora_finalizar };
            await (editando && form.horario_id ? horariosApi.actualizar(form.horario_id, horario) : horariosApi.crear(horario));
            modalAbierto = false; form = nuevoForm(); await cargarTodo();
            avisos.toastExito(editando ? 'Carga actualizada' : 'Carga registrada');
        } catch (e) {
            await alerta('No se pudo guardar', e.message || 'Ocurrió un error al guardar la carga.', 'error');
        } finally { guardando = false; }
    }

    async function eliminar({ carga_id: id, docente }) {
        if (esUsuarioDocente) return alerta('Acción no disponible', 'El rol Docente no puede eliminar cargas docentes.');
        if (!permitir('puede_eliminar', 'eliminar cargas docentes')) return;
        if (id == null) return alerta('Error', 'No se identificó la carga seleccionada.', 'error');
        await confirmacion.eliminar({
            nombre: `la carga de ${docente}`,
            accion: async () => {
                try {
                    await cargaDocenteApi.eliminar(id);
                    cargas = cargas.filter(c => Number(idCarga(c)) !== Number(id));
                    await confirmacion.exito('La carga docente se eliminó correctamente.');
                } catch (e) {
                    await confirmacion.error(e.message || 'No se pudo eliminar la carga.');
                }
            }
        });
    }
</script>

<svelte:head><title>Carga Docente | Acta Docente</title></svelte:head>

<Header /><Navbar />

<main class="bg-light min-vh-100 p-4">
    <div class="container-fluid px-2 px-md-4">
        {#if !accesoVerificado}
            <div class="card border-0 shadow-sm rounded-4"><div class="card-body text-center py-5"><div class="spinner-border" style:color={COLOR} role="status"></div><p class="text-muted mt-3 mb-0">Verificando permisos de acceso...</p></div></div>
        {:else if !permiso.puede_ver}
            <div class="card border-0 shadow-sm rounded-4"><div class="card-body text-center py-5"><i class="bi bi-shield-lock-fill fs-2 text-danger"></i><h3 class="fw-bold">Acceso no autorizado</h3><p class="text-muted mb-0">Tu rol no tiene permisos para acceder a Carga Docente.</p></div></div>
        {:else}
            <PageHeader>
                {#snippet acciones()}
                    {#if !esUsuarioDocente && permiso.puede_crear}
                        <button class="btn btn-marca" onclick={abrirCrear}><i class="bi bi-plus-circle-fill me-2"></i>Registrar carga</button>
                    {/if}
                    <button class="btn btn-contorno" onclick={cargarTodo} disabled={cargando}><i class="bi bi-arrow-clockwise me-1"></i>Actualizar</button>
                {/snippet}
            </PageHeader>

            {#if esUsuarioDocente && usuarioActualId === null}
                <div class="alert alert-danger rounded-3">No se pudo identificar tu usuario. Cierra sesión e inicia sesión nuevamente.</div>
            {/if}

            <DataTable title={esUsuarioDocente ? 'Mis cargas docentes' : 'Listado de cargas docentes'} rows={filas} columns={COLUMNAS} loading={cargando} pageSize={5} onEdit={!esUsuarioDocente && permiso.puede_editar ? abrirEditar : undefined} onDelete={!esUsuarioDocente && permiso.puede_eliminar ? eliminar : undefined} />

            {#if esUsuarioDocente && !cargando && usuarioActualId !== null && filas.length === 0}
                <div class="alert alert-info rounded-3 mt-3"><i class="bi bi-info-circle me-2"></i>No tienes cargas docentes asignadas actualmente.</div>
            {/if}
        {/if}
    </div>
</main>

<ModalFormulario bind:abierto={modalAbierto} titulo={editando ? 'Editar carga docente' : 'Registrar carga docente'} subtitulo="Completa la asignación académica y el horario" textoGuardar={editando ? 'Guardar cambios' : 'Registrar carga'} cargando={guardando} onGuardar={guardar} onCerrar={() => { if (!guardando) form = nuevoForm(); }}>
    <div class="row g-3">
        {#each selects as [k, label, ph, col, opciones] (k)}
            <div class="col-12 {col}">
                <label for={k} class="form-label fw-semibold text-secondary">{label}</label>
                <select id={k} class="form-select" bind:value={form[k]} required>
                    <option value="">Selecciona {ph}</option>
                    {#each opciones as [v, t] (v)}<option value={String(v)}>{t}</option>{/each}
                </select>
            </div>
        {/each}

        <div class="col-12 col-md-6">
            <label for="dia" class="form-label fw-semibold text-secondary">Día</label>
            <select id="dia" class="form-select" bind:value={form.dia_laborales}>
                {#each DIAS as d, i}<option value={String(i + 1)}>{d}</option>{/each}
            </select>
        </div>

        <div class="col-12 col-md-6">
            <label for="estado" class="form-label fw-semibold text-secondary">Estado</label>
            <select id="estado" class="form-select" bind:value={form.estado}>
                <option value={true}>Activo</option>
                <option value={false}>Inactivo</option>
            </select>
        </div>

        {#each [['hora_inicio', 'Hora de inicio'], ['hora_finalizar', 'Hora de finalización']] as [k, label]}
            <div class="col-12 col-md-6">
                <label for={k} class="form-label fw-semibold text-secondary">{label}</label>
                <input id={k} type="time" class="form-control" bind:value={form[k]} required />
            </div>
        {/each}
    </div>
</ModalFormulario>

<Alerta bind:this={avisos} />
<Confirmacion bind:api={confirmacion} />
<Footer /><BtnSugerencias />