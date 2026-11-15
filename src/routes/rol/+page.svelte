<script>
    import { onMount } from 'svelte';
    import { peticion } from '$lib/api/CargaDocenteApi.js';
    import Header from '$lib/components/Header.svelte';
    import Navbar from '$lib/components/Navbar.svelte';
    import Footer from '$lib/components/Footer.svelte';

    const COLOR = '#0f3460';
    const ACCIONES = [
        { key: 'puede_ver', label: 'Ver', icon: 'bi-eye' },
        { key: 'puede_crear', label: 'Crear', icon: 'bi-plus-circle' },
        { key: 'puede_editar', label: 'Editar', icon: 'bi-pencil-square' },
        { key: 'puede_eliminar', label: 'Eliminar', icon: 'bi-trash3' }
    ];
    const CLAVES = ACCIONES.map(a => a.key);

    let roles = $state([]);
    let modulos = $state([]);
    let permisos = $state([]);
    let rolSeleccionado = $state(null);
    let cargando = $state(true);
    let guardando = $state(false);

    const traer = async url => {
        const d = await peticion(url);
        return Array.isArray(d) ? d : [];
    };

    const indice = $derived.by(() => {
        const porRol = new Map();
        const activos = new Map();
        for (const p of permisos) {
            const r = +p.role_id;
            if (!porRol.has(r)) porRol.set(r, new Map());
            porRol.get(r).set(+p.module_id, p);
            if (CLAVES.some(k => p[k])) activos.set(r, (activos.get(r) || 0) + 1);
        }
        return { porRol, activos };
    });
    const rolId = $derived(+rolSeleccionado?.rol_id);
    const permisosRol = $derived(indice.porRol.get(rolId) ?? new Map());
    const activosRol = $derived(indice.activos.get(rolId) || 0);

    // SweetAlert2 se carga bajo demanda.
    const fire = async o => (await import('sweetalert2')).default.fire(o);
    const alerta = (title, text) => fire({ icon: 'error', title, text, confirmButtonColor: COLOR });
    const aviso = (title, text) =>
        fire({ toast: true, position: 'top-end', icon: 'success', title, text, timer: 1800, timerProgressBar: true, showConfirmButton: false });
    const confirmar = async (title, text) =>
        (await fire({
            icon: 'warning', title, text, confirmButtonText: 'Sí, eliminar',
            showCancelButton: true, cancelButtonText: 'Cancelar',
            confirmButtonColor: '#dc3545', cancelButtonColor: '#6c757d',
            reverseButtons: true, focusCancel: true
        })).isConfirmed;

    async function guardar(accion, mensaje, alFallar) {
        if (guardando) return;
        guardando = true;
        try {
            await accion();
        } catch (e) {
            await alFallar?.();
            alerta('Error', e?.message || mensaje);
        } finally {
            guardando = false;
        }
    }

    async function cargarDatos() {
        cargando = true;
        try {
            [roles, modulos, permisos] = await Promise.all([traer('/roles/'), traer('/modulos/'), traer('/modulos-rol/')]);
            rolSeleccionado = roles.find(x => +x.rol_id === rolId) ?? roles[0] ?? null;
        } catch (e) {
            alerta('Error de conexión', e.message || 'No se pudieron cargar los datos.');
        } finally {
            cargando = false;
        }
    }

    onMount(cargarDatos);

    async function agregarRol() {
        const { value } = await fire({
            title: 'Nuevo rol', input: 'text', inputLabel: 'Nombre del rol',
            inputPlaceholder: 'Ej: Administrador, Docente...',
            showCancelButton: true, confirmButtonText: 'Guardar',
            cancelButtonText: 'Cancelar', confirmButtonColor: COLOR,
            inputValidator: v => (v?.trim() ? undefined : 'Ingresa un nombre.')
        });
        const nombre = value?.trim();
        if (!nombre) return;

        await guardar(async () => {
            const nuevo = await peticion('/roles/', { method: 'POST', body: { nombre_rol: nombre, estado: true } });
            if (nuevo?.rol_id != null) {
                roles = [...roles, nuevo];
                rolSeleccionado = nuevo;
            } else {
                roles = await traer('/roles/');
                rolSeleccionado = roles.find(r => r.nombre_rol === nombre) ?? rolSeleccionado;
            }
            aviso('Rol creado', `El rol "${nombre}" se registró correctamente.`);
        }, 'No se pudo crear el rol.');
    }

    async function eliminarRol(rol) {
        if (!await confirmar('¿Eliminar este rol?', `Se eliminará "${rol.nombre_rol}" y podría afectar usuarios o permisos.`)) return;

        await guardar(async () => {
            const id = +rol.rol_id;
            await peticion(`/roles/${id}`, { method: 'DELETE' });
            roles = roles.filter(r => +r.rol_id !== id);
            permisos = permisos.filter(p => +p.role_id !== id);
            if (rolId === id) rolSeleccionado = roles[0] ?? null;
            aviso('Rol eliminado', `El rol "${rol.nombre_rol}" se eliminó.`);
        }, 'No se pudo eliminar el rol. Comprueba sus relaciones.');
    }

    async function cambiarPermiso(modulo, tipo, { currentTarget: input }) {
        if (!rolSeleccionado || guardando) return;

        const existente = permisosRol.get(+modulo.modulos_id);
        const datos = {
            role_id: rolId,
            module_id: +modulo.modulos_id,
            ...Object.fromEntries(CLAVES.map(k => [k, !!existente?.[k]])),
            estado: true
        };
        datos[tipo] = !datos[tipo];

        await guardar(async () => {
            const guardado = await peticion(
                existente ? `/modulos-rol/${existente.modules_rol_id}` : '/modulos-rol/',
                { method: existente ? 'PUT' : 'POST', body: datos }
            );
            if (guardado?.modules_rol_id != null) {
                const id = +guardado.modules_rol_id;
                permisos = [...permisos.filter(p => +p.modules_rol_id !== id), guardado];
            } else {
                permisos = await traer('/modulos-rol/');
            }
            aviso('Permiso guardado', 'La configuración se guardó correctamente.');
        }, 'No se pudo guardar el permiso.', async () => {
            input.checked = !!existente?.[tipo];
            try { permisos = await traer('/modulos-rol/'); } catch {}
        });
    }

    async function eliminarPermiso(modulo, permiso) {
        if (!await confirmar('¿Eliminar permisos?', `Se quitarán los permisos de "${modulo.nombre_modulo}" para "${rolSeleccionado.nombre_rol}".`)) return;

        await guardar(async () => {
            const id = +permiso.modules_rol_id;
            await peticion(`/modulos-rol/${id}`, { method: 'DELETE' });
            permisos = permisos.filter(p => +p.modules_rol_id !== id);
            aviso('Permisos eliminados', 'La configuración se eliminó correctamente.');
        }, 'No se pudo eliminar la configuración.');
    }
</script>

<svelte:head>
    <title>Roles y Permisos | Acta Docente</title>
</svelte:head>

{#snippet vacio(icono, titulo, texto)}
    <div class="text-center py-5 px-3 texto-suave">
        <i class="bi {icono} fs-1"></i>
        <h5 class="mt-3 fw-bold">{titulo}</h5>
        <p class="mb-0">{texto}</p>
    </div>
{/snippet}

<div class="pagina d-flex flex-column min-vh-100">
    <Header />
    <Navbar />

    <main class="flex-grow-1 pb-5">
        <div class="container-fluid px-3 px-md-4 mt-4">
            <div class="tarjeta mb-4 d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 py-3 px-4">
                <div>
                    <h1 class="h3 fw-bold mb-1">Roles y permisos</h1>
                    <p class="texto-suave mb-0 small">Define qué puede hacer cada rol en cada módulo.</p>
                </div>
                <div class="d-flex flex-wrap gap-2">
                    <button class="btn btn-marca px-3 fw-semibold" onclick={agregarRol} disabled={cargando || guardando}>
                        <i class="bi bi-plus-lg me-1"></i>Nuevo rol
                    </button>
                    <button class="btn btn-contorno px-3 fw-semibold" onclick={cargarDatos} disabled={cargando || guardando}>
                        <i class="bi bi-arrow-clockwise me-1"></i>Actualizar
                    </button>
                </div>
            </div>

            {#if cargando}
                <div class="tarjeta text-center py-5">
                    <div class="spinner-border texto-marca mb-3" role="status"></div>
                    <h5>Cargando roles y permisos</h5>
                    <p class="texto-suave mb-0">Consultando información del sistema...</p>
                </div>
            {:else}
                <div class="row g-4">
                    <div class="col-12 col-lg-4 col-xl-3">
                        <div class="tarjeta h-100">
                            <div class="cabecera">
                                <h2 class="h5 fw-bold"><i class="bi bi-people-fill me-2 texto-marca"></i>Roles <span class="contador">{roles.length}</span></h2>
                                <small class="texto-suave">Selecciona un rol para editar sus permisos.</small>
                            </div>
                            <div class="p-3 d-flex flex-column gap-2">
                                {#each roles as rol (rol.rol_id)}
                                    {@const activo = +rol.rol_id === rolId}
                                    {@const total = indice.activos.get(+rol.rol_id) || 0}
                                    <div class="d-flex gap-1">
                                        <button class="rol-item flex-grow-1" class:rol-activo={activo} aria-pressed={activo} onclick={() => (rolSeleccionado = rol)} disabled={guardando}>
                                            <span class="avatar"><i class="bi bi-person-badge-fill fs-5"></i></span>
                                            <span class="text-start text-break">
                                                <span class="d-block fw-semibold">{rol.nombre_rol}</span>
                                                <small class="detalle">{total ? `${total} módulos con acceso` : 'Sin permisos activos'}</small>
                                            </span>
                                        </button>
                                        <button class="btn btn-quitar rounded-3 px-3" title={`Eliminar ${rol.nombre_rol}`} aria-label={`Eliminar ${rol.nombre_rol}`} onclick={() => eliminarRol(rol)} disabled={guardando}>
                                            <i class="bi bi-trash3"></i>
                                        </button>
                                    </div>
                                {:else}
                                    <p class="text-center texto-suave py-4">No hay roles registrados.</p>
                                {/each}
                            </div>
                        </div>
                    </div>

                    <div class="col-12 col-lg-8 col-xl-9">
                        <div class="tarjeta">
                            <div class="cabecera d-flex flex-column flex-md-row justify-content-between gap-3">
                                <div>
                                    <h2 class="h5 fw-bold">Permisos de <span class="texto-marca">{rolSeleccionado?.nombre_rol || '—'}</span></h2>
                                    {#if rolSeleccionado}
                                        <small class="texto-suave">{activosRol} de {modulos.length} módulos con acceso.</small>
                                    {/if}
                                </div>
                                {#if guardando}
                                    <span class="guardando" role="status"><span class="spinner-border spinner-border-sm me-2"></span>Guardando...</span>
                                {/if}
                            </div>

                            {#if !rolSeleccionado}
                                {@render vacio('bi-person-check', 'Selecciona un rol', 'Elige un rol para administrar sus permisos.')}
                            {:else if !modulos.length}
                                {@render vacio('bi-grid-3x3-gap', 'No hay módulos', 'No existen módulos registrados.')}
                            {:else}
                                <div class="table-responsive">
                                    <table class="table tabla align-middle mb-0 w-100">
                                        <thead>
                                            <tr>
                                                <th class="ps-4">Módulo</th>
                                                {#each ACCIONES as a (a.key)}
                                                    <th class="text-center"><i class="bi {a.icon} me-1"></i>{a.label}</th>
                                                {/each}
                                                <th class="text-center pe-4">Configuración</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each modulos as modulo (modulo.modulos_id)}
                                                {@const permiso = permisosRol.get(+modulo.modulos_id)}
                                                <tr>
                                                    <td class="ps-4">
                                                        <div class="d-flex align-items-center py-1">
                                                            <span class="avatar me-3"><i class="bi bi-grid-fill"></i></span>
                                                            <div>
                                                                <div class="fw-semibold">{modulo.nombre_modulo}</div>
                                                                <small class="etiqueta">{permiso ? 'Configurado' : 'Sin configurar'}</small>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {#each ACCIONES as a (a.key)}
                                                        <td class="text-center">
                                                            <input class="interruptor" type="checkbox" role="switch" checked={!!permiso?.[a.key]} disabled={guardando} onchange={e => cambiarPermiso(modulo, a.key, e)} aria-label={`${a.label} ${modulo.nombre_modulo}`} />
                                                        </td>
                                                    {/each}
                                                    <td class="text-center pe-4">
                                                        {#if permiso}
                                                            <button class="btn btn-sm btn-quitar px-2" disabled={guardando} onclick={() => eliminarPermiso(modulo, permiso)}>
                                                                <i class="bi bi-x-circle me-1"></i>Quitar
                                                            </button>
                                                        {:else}
                                                            <span class="texto-suave">—</span>
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
                </div>
            {/if}
        </div>
    </main>
    <Footer />
</div>

<style>
    .pagina{--marca:#0f3460;--medio:#1d5aa8;--cielo:#3b8fd9;--claro:#d9e8f8;--niebla:#eef4fb;--borde:#dbe5f1;--suave:#5b6b82;background:#f5f8fc;color:#12233d}
    .texto-marca{color:var(--medio)}
    .texto-suave,.detalle{color:var(--suave)}
    .tarjeta{background:#fff;border:1px solid var(--borde);border-radius:16px;box-shadow:0 6px 24px #0f346014;overflow:hidden}
    .cabecera{padding:1.25rem 1.5rem;border-bottom:1px solid var(--borde)}
    .contador,.etiqueta{padding:.1rem .55rem;border-radius:999px;background:var(--claro);color:var(--marca);font-size:.8rem}
    .guardando{display:inline-flex;align-items:center;padding:.45rem 1rem;border:1px solid var(--claro);border-radius:999px;background:var(--niebla);color:var(--medio)}
    .btn-marca{background:var(--marca);border:1px solid var(--marca);color:#fff}
    .btn-marca:hover:not(:disabled){background:#0b2447;color:#fff}
    .btn-contorno{background:#fff;border:1px solid var(--marca);color:var(--marca)}
    .btn-contorno:hover:not(:disabled){background:var(--niebla)}
    .btn-quitar{background:#fff;border:1px solid var(--borde);color:var(--suave)}
    .btn-quitar:hover:not(:disabled){background:#fdecee;border-color:#f1b0b7;color:#c0392b}
    .rol-item{display:flex;align-items:center;gap:.75rem;min-width:0;padding:.75rem;border:1px solid var(--borde);border-radius:12px;background:#fff;color:inherit}
    .rol-item:hover:not(:disabled):not(.rol-activo){background:var(--niebla);border-color:var(--cielo)}
    .rol-activo,.rol-activo:hover{background:linear-gradient(120deg,var(--marca),var(--medio));border-color:var(--marca);color:#fff}
    .rol-activo .detalle{color:#ffffffc7}
    .avatar{display:flex;flex-shrink:0;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:var(--niebla);color:var(--marca)}
    .rol-activo .avatar{background:#ffffff33;color:#fff}
    .tabla{--bs-table-bg:transparent}
    .tabla thead th{padding:.9rem .5rem;background:var(--niebla);color:var(--marca);font-size:.875rem;white-space:nowrap;border-bottom:1px solid var(--borde)}
    .tabla tbody td{padding:.7rem .5rem;border-bottom:1px solid var(--niebla)}
    .tabla tbody tr:last-child td{border-bottom:0}
    .tabla tbody tr:hover td{background:#f5f8fc}
    .interruptor{appearance:none;position:relative;width:2.6rem;height:1.45rem;margin:0;border:0;border-radius:999px;background:#c9d8ea;cursor:pointer;transition:background .2s}
    .interruptor::after{content:'';position:absolute;top:3px;left:3px;width:calc(1.45rem - 6px);height:calc(1.45rem - 6px);border-radius:50%;background:#fff;box-shadow:0 1px 3px #0b24474d;transition:transform .2s}
    .interruptor:checked{background:linear-gradient(120deg,var(--marca),var(--cielo))}
    .interruptor:checked::after{transform:translateX(1.15rem)}
    .interruptor:disabled{opacity:.55;cursor:not-allowed}
    .interruptor:focus-visible,.rol-item:focus-visible,.btn:focus-visible{outline:3px solid #3b8fd980;outline-offset:2px}
    @media(prefers-reduced-motion:reduce){.rol-item,.interruptor,.interruptor::after{transition:none}}
</style>