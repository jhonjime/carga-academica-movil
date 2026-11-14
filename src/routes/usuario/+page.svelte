<script>
    import { onMount } from 'svelte';
    import Alerta from '$lib/components/Alerta.svelte';
    import Header from '$lib/components/header.svelte';
    import Navbar from '$lib/components/navbar.svelte';
    import Footer from '$lib/components/footer.svelte';
    import DataTable from '$lib/components/DataTable.svelte';
    import ModalFormulario from '$lib/components/ModalFormulario.svelte';
    import Confirmacion from '$lib/components/Confirmacion.svelte';
    import { usuariosApi } from '$lib/api/CargaDocenteApi.js';

    const COLOR = '#0f3460';
    const MODULOS = ['usuarios', 'usuario', 'gestión de usuarios'];
    const INACTIVOS = ['false', '0', 'inactivo', 'inactiva', 'eliminado'];
    const PERMISOS = ['puede_ver', 'puede_crear', 'puede_editar', 'puede_eliminar'];
    // Nombres alternativos con los que puede llegar cada campo desde la API.
    const ALIAS = { correo: ['email'], codigo_personal: ['codigo'], titulo_academico: ['titulo'], numero_documento: ['documento', 'cedula'] };
    const TIPOS = { success: 'exito', error: 'error', warning: 'advertencia', info: 'info' };
    const CAMPOS = [
        ['primer_nombre', 'Primer nombre', 'Ingrese el primer nombre', 'el primer nombre'],
        ['segundo_nombre', 'Segundo nombre', 'Ingrese el segundo nombre'],
        ['primer_apellido', 'Primer apellido', 'Ingrese el primer apellido', 'el primer apellido'],
        ['segundo_apellido', 'Segundo apellido', 'Ingrese el segundo apellido'],
        ['correo', 'Correo electrónico', 'correo@institucion.edu.co', 'el correo electrónico', 'email'],
        ['contraseña', 'Contraseña', '', '', 'password'],
        ['numero_documento', 'Número de documento', 'Documento de identidad', 'el número de documento'],
        ['codigo_personal', 'Código personal', 'Código del usuario'],
        ['titulo_academico', 'Título académico', 'Ej. Ingeniero de Sistemas']
    ].map(([key, label, placeholder, req, type]) => ({ key, label, placeholder, req, type }));
    const COLUMNAS = [
        ['nombre_completo', 'USUARIO'], ['correo', 'CORREO'], ['codigo_personal', 'CÓDIGO'],
        ['titulo_academico', 'TÍTULO ACADÉMICO'], ['estado', 'ESTADO', 'status']
    ].map(([key, label, type]) => ({ key, label, type, sortable: !type }));

    const nuevo = () => ({
        usuario_id: null, ...Object.fromEntries(CAMPOS.map((c) => [c.key, ''])), rol_id: 1, estado: true
    });

    let usuarios = $state([]);
    let cargando = $state(true);
    let guardando = $state(false);
    let editando = $state(false);
    let modalAbierto = $state(false);
    let accesoVerificado = $state(false);
    let confirmacion = $state(null);
    let permiso = $state({});
    let form = $state(nuevo());
    let avisos; // <Alerta /> (bind:this)

    // alerta('Título', 'Texto', 'warning' | 'error' | 'success' | 'info')
    const alerta = (title, text, icon = 'warning') => avisos[TIPOS[icon] ?? 'advertencia'](title, text);
    const permitir = (k, accion) =>
        permiso[k] || (alerta('Acceso denegado', `No tienes permiso para ${accion}.`), false);

    const t = (v) => String(v ?? '').trim();
    const leer = (u, k) => [k, ...(ALIAS[k] ?? [])].map((a) => u?.[a]).find((v) => v != null);
    const idUsuario = (u) => u?.usuario_id ?? u?.user_id ?? u?.id ?? null;
    const nombreCompleto = (u) =>
        u?.nombre_completo || u?.nombre ||
        ['primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido'].map((k) => u?.[k]).filter(Boolean).join(' ') ||
        'Usuario sin nombre';
    const activo = (u) => {
        const e = u?.estado ?? u?.activo;
        return e == null || (typeof e === 'string' ? !INACTIVOS.includes(e.trim().toLowerCase()) : typeof e === 'number' ? e === 1 : !!e);
    };

    const filas = $derived(
        usuarios.map((u) => ({
            usuario_id: idUsuario(u),
            nombre_completo: nombreCompleto(u),
            correo: leer(u, 'correo') ?? 'Sin correo',
            codigo_personal: leer(u, 'codigo_personal') ?? 'Sin código',
            titulo_academico: leer(u, 'titulo_academico') ?? 'Sin título',
            estado: activo(u),
            _raw: u
        }))
    );

    function verificarPermisos() {
        let m;
        try {
            m = JSON.parse(sessionStorage.getItem('usuario_modulos') || '[]').find((m) =>
                MODULOS.includes(t(m.nombre ?? m.nombre_modulo).toLocaleLowerCase('es')));
        } catch {}
        permiso = Object.fromEntries(PERMISOS.map((k) => [k, [true, 1, 'true', '1'].includes(m?.[k])]));
        accesoVerificado = true;
    }

    async function cargarUsuarios() {
        if (!permiso.puede_ver) return (cargando = false);
        cargando = true;
        try {
            const d = await usuariosApi.listar();
            usuarios = [d, d?.data, d?.usuarios].find(Array.isArray) ?? [];
        } catch (e) {
            usuarios = [];
            await alerta('Error al consultar', e.message || 'No se pudieron cargar los usuarios.', 'error');
        } finally {
            cargando = false;
        }
    }

    onMount(() => {
        verificarPermisos();
        cargarUsuarios();
    });

    function abrirModalCrear() {
        if (!permitir('puede_crear', 'crear usuarios')) return;
        form = nuevo();
        editando = false;
        modalAbierto = true;
    }

    function abrirModalEditar({ _raw: u }) {
        if (!permitir('puede_editar', 'editar usuarios')) return;
        const id = idUsuario(u);
        if (!id) return alerta('Error', 'No se pudo identificar el usuario seleccionado.', 'error');

        form = {
            ...Object.fromEntries(CAMPOS.map(({ key }) => [key, leer(u, key) ?? ''])),
            usuario_id: id,
            contraseña: '',
            rol_id: u.rol_id ?? u.id_rol ?? 1,
            estado: activo(u)
        };
        editando = true;
        modalAbierto = true;
    }

    async function guardarUsuario() {
        const edicion = editando;
        if (!permitir(edicion ? 'puede_editar' : 'puede_crear', 'realizar esta operación')) return;

        const faltante = CAMPOS.find((c) => c.req && !t(form[c.key]));
        if (faltante) return alerta('Campo requerido', `Ingresa ${faltante.req}.`);
        if (!edicion && !t(form.contraseña))
            return alerta('Campo requerido', 'Ingresa una contraseña para el usuario.');

        guardando = true;
        const datos = {
            ...Object.fromEntries(CAMPOS.filter((c) => c.type !== 'password').map(({ key }) => [key, t(form[key]) || null])),
            rol_id: Number(form.rol_id),
            estado: !!form.estado,
            // En edición, la contraseña solo se envía si se escribió.
            ...(t(form.contraseña) && { contraseña: t(form.contraseña) })
        };

        try {
            await (edicion ? usuariosApi.actualizar(form.usuario_id, datos) : usuariosApi.crear(datos));
            modalAbierto = false;
            form = nuevo();
            await cargarUsuarios();
            avisos.toastExito(edicion ? 'Usuario actualizado correctamente' : 'Usuario registrado correctamente');
        } catch (e) {
            await alerta(
                edicion ? 'Error al actualizar' : 'Error al registrar',
                e.message || 'No se pudo completar la operación.',
                'error'
            );
        } finally {
            guardando = false;
        }
    }

    async function confirmarEliminacion({ usuario_id: id, nombre_completo }) {
        if (!permitir('puede_eliminar', 'eliminar usuarios')) return;
        if (!id) return alerta('Error', 'No se pudo identificar el usuario.', 'error');

        await confirmacion.eliminar({
            nombre: `al usuario ${nombre_completo}`,
            accion: async () => {
                try {
                    await usuariosApi.eliminar(id);
                    usuarios = usuarios.filter((u) => Number(idUsuario(u)) !== Number(id));
                    await confirmacion.exito('El usuario se eliminó correctamente.');
                } catch (e) {
                    await confirmacion.error(e.message || 'No se pudo eliminar el usuario.');
                }
            }
        });
    }
</script>

<svelte:head>
    <title>Usuarios | Acta Docente</title>
</svelte:head>

{#snippet centrado(contenido)}
    <div class="card border-0 shadow-sm rounded-4">
        <div class="card-body text-center py-5">{@render contenido()}</div>
    </div>
{/snippet}

<Header />
<Navbar />

<main class="bg-light min-vh-100 p-4">
    <div class="container-fluid px-2 px-md-4">
        {#if !accesoVerificado}
            {#snippet verificando()}
                <div class="spinner-border" style:color={COLOR} role="status"></div>
                <p class="text-muted mt-3 mb-0">Verificando permisos de acceso...</p>
            {/snippet}
            {@render centrado(verificando)}
        {:else if !permiso.puede_ver}
            {#snippet denegado()}
                <i class="bi bi-shield-lock-fill fs-2 text-danger"></i>
                <h3 class="fw-bold">Acceso no autorizado</h3>
                <p class="text-muted mb-0">Tu rol no tiene permisos para acceder al módulo de Usuarios.</p>
            {/snippet}
            {@render centrado(denegado)}
        {:else}
            <div class="card border-0 shadow-sm rounded-4 mb-4">
                <div class="card-body p-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
                    <div>
                        <h2 class="fw-bold mb-1">Usuarios</h2>
                        <p class="text-muted mb-0">Gestión de usuarios del sistema.</p>
                    </div>
                    <div class="d-flex flex-wrap gap-2">
                        {#if permiso.puede_crear}
                            <button class="btn text-white px-4 py-2 fw-semibold" style:background={COLOR} onclick={abrirModalCrear}>
                                <i class="bi bi-person-plus-fill me-2"></i>Registrar usuario
                            </button>
                        {/if}
                        <button class="btn btn-outline-secondary px-3 py-2" onclick={cargarUsuarios} disabled={cargando}>
                            <i class="bi bi-arrow-clockwise me-1"></i>Actualizar
                        </button>
                    </div>
                </div>
            </div>

            <DataTable
                title="Listado de usuarios"
                rows={filas}
                columns={COLUMNAS}
                loading={cargando}
                emptyMessage="No hay usuarios registrados."
                pageSize={5}
                onEdit={permiso.puede_editar ? abrirModalEditar : undefined}
                onDelete={permiso.puede_eliminar ? confirmarEliminacion : undefined}
            />
        {/if}
    </div>
</main>

<ModalFormulario
    bind:abierto={modalAbierto}
    titulo={editando ? 'Editar usuario' : 'Registrar usuario'}
    subtitulo="Completa la información del usuario"
    textoGuardar={editando ? 'Guardar cambios' : 'Registrar usuario'}
    cargando={guardando}
    onGuardar={guardarUsuario}
    onCerrar={() => (form = nuevo())}
>
    <div class="row g-3">
        {#each CAMPOS as c (c.key)}
            {@const pass = c.type === 'password'}
            <div class="col-12 col-md-6">
                <label for={c.key} class="form-label fw-semibold text-secondary">
                    {c.label}
                    {#if pass && editando}<span class="text-muted fw-normal">(opcional)</span>{/if}
                </label>
                <input
                    id={c.key}
                    type={c.type ?? 'text'}
                    class="form-control"
                    bind:value={form[c.key]}
                    placeholder={pass ? (editando ? 'Dejar en blanco para conservar' : 'Ingrese una contraseña') : c.placeholder}
                    autocomplete={pass ? 'new-password' : undefined}
                    required={pass ? !editando : !!c.req}
                />
            </div>
        {/each}

        <div class="col-12 col-md-6">
            <label for="estadoSelect" class="form-label fw-semibold text-secondary">Estado</label>
            <select id="estadoSelect" class="form-select" bind:value={form.estado}>
                <option value={true}>Activo</option>
                <option value={false}>Inactivo</option>
            </select>
        </div>
    </div>
</ModalFormulario>

<Alerta bind:this={avisos} />
<Confirmacion bind:api={confirmacion} />
<Footer />